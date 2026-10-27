/**
 * 选中文字 → 生成矢量示意图（SVG）。
 *
 * 用户存档的 API 均为对话/文本模型，无法直接产出位图。
 * 这里用"模型无关"的通用技能：让任意文本模型绘制一张自包含 SVG，
 * 再由前端渲染为矢量图，并支持导出 SVG / PNG。
 * 相比 DALL·E 类艺术图，SVG 坐标精确、标注清晰、可无损缩放，更适合数学/物理插图。
 *
 * 图像类型是分档的：函数图像 / 思维导图 / 物理示意 / 几何图形 / 电路图 / 统计图表 / 通用示意。
 * 每类各有专属的绘图规范（见 KIND_GUIDE），因为「画对了」的标准完全不同；
 * 用户可手动指定，也可交给打分式自动识别（detectKindDetailed）。
 */

/** 可选的图像类型（auto 表示由程序自动判断） */
export type DiagramKind =
  | 'auto'
  | 'function'
  | 'mindmap'
  | 'physics'
  | 'geometry'
  | 'circuit'
  | 'chart'
  | 'general';

/** 具体类型（不含 auto），用于提示词与评分表 */
export type ResolvedKind = Exclude<DiagramKind, 'auto'>;

export const DIAGRAM_KIND_LABELS: Record<DiagramKind, string> = {
  auto: '自动识别',
  function: '函数图像',
  mindmap: '思维导图',
  physics: '物理示意',
  geometry: '几何图形',
  circuit: '电路图',
  chart: '统计图表',
  general: '通用示意',
};

/** 选择面板里的一句话说明 */
export const DIAGRAM_KIND_HINTS: Record<DiagramKind, string> = {
  auto: '根据文字内容自动挑选最合适的类型',
  function: '画坐标系、曲线、渐近线，标注极值与交点',
  mindmap: '中心主题 + 分支结构，梳理概念层级',
  physics: '受力图、光路、波动、场图，矢量带标注',
  geometry: '三角形/圆等图形，标注顶点、角度、辅助线',
  circuit: '标准元件符号与回路，标注电流电压',
  chart: '柱状图/折线图/饼图，带坐标轴与图例',
  general: '框图 + 箭头，表达流程与逻辑关系',
};

/* ------------------------------------------------------------------ *
 * 关键词评分表：每个类型一组带权关键词，命中即累加
 * ------------------------------------------------------------------ */

type Rule = { re: RegExp; w: number };

const RULES: Record<ResolvedKind, Rule[]> = {
  function: [
    { re: /\bf\s*\(\s*[xyt]\s*\)\s*=/, w: 6 },
    { re: /\by\s*=/, w: 5 },
    { re: /函数图像|函数图象|图像如下|曲线图|画出.{0,4}(函数|曲线)图/, w: 5 },
    { re: /定义域|值域|单调|递增|递减|极值|极大值|极小值|最值/, w: 4 },
    { re: /渐近线|凹凸|拐点|驻点|零点|交点/, w: 4 },
    { re: /导数|微分|切线|斜率|积分上限|原函数/, w: 3 },
    { re: /sin|cos|tan|cot|log|ln|exp|e\^|x\^2|x²/, w: 3 },
    { re: /\$[^$]*[xy]\s*=/, w: 3 },
    { re: /坐标轴|横坐标|纵坐标|x轴|y轴/, w: 2 },
  ],
  mindmap: [
    { re: /思维导图|脑图|知识结构|知识框架|概念图/, w: 8 },
    { re: /要点.{0,4}(包括|有|如下)|主要(包括|包含)|如下几(点|条|个)|可(分为|分成)/, w: 6 },
    { re: /梳理|总结|归纳|分类|分为|包括以下几|要点|条目/, w: 4 },
    { re: /第一[、，,]|第二[、，,]|首先.*其次/, w: 3 },
    { re: /①|②|③|④|⑤|1[.、)]\s|2[.、)]\s|3[.、)]\s/, w: 3 },
    { re: /特点|性质|分类|应用|定义|概念/, w: 2 },
    { re: /框架|体系|流程|步骤|要素|维度/, w: 2 },
  ],
  physics: [
    { re: /受力分析|受力图|自由体|隔离体/, w: 8 },
    { re: /牛顿|加速度|动量|冲量|力矩|转动惯量/, w: 5 },
    { re: /电场|磁场|电势|电荷|库仑|磁感线|电力线/, w: 5 },
    { re: /折射|反射|透镜|焦距|物距|像距|光屏|焦点|干涉|衍射|偏振|光路|光线/, w: 6 },
    { re: /波长|频率|振幅|相位|简谐|驻波|多普勒/, w: 5 },
    { re: /重力|摩擦力|支持力|张力|浮力|压强|弹力/, w: 5 },
    { re: /速度|位移|轨迹|抛体|斜抛|圆周运动|角速度/, w: 4 },
    { re: /热力学|熵|内能|等温|绝热|卡诺/, w: 4 },
    { re: /光子|电子|原子核|量子|能级|跃迁|势垒/, w: 4 },
    { re: /能量守恒|机械能|动能|势能|做功/, w: 3 },
  ],
  geometry: [
    { re: /三角形|四边形|平行四边形|梯形|菱形|矩形|正方形/, w: 6 },
    { re: /圆|半径|直径|弦|切线|弧|圆心角|圆周角/, w: 4 },
    { re: /全等|相似|垂直平分|角平分线|中线|高线/, w: 5 },
    { re: /顶点|边长|内角|外角|周长|面积/, w: 3 },
    { re: /坐标系|直线|平面|交点|平行|垂直/, w: 2 },
    { re: /证明|作图|辅助线/, w: 3 },
  ],
  circuit: [
    { re: /电路|回路|干路|支路|串联|并联/, w: 8 },
    { re: /电阻|电容|电感|二极管|三极管|电源|电池/, w: 5 },
    { re: /电流表|电压表|安培表|伏特表|滑动变阻器/, w: 6 },
    { re: /欧姆定律|基尔霍夫|节点电压|戴维南|诺顿/, w: 5 },
    { re: /开关|短接|断路|短路|接地/, w: 3 },
    { re: /电压|电动势|内阻/, w: 2 },
  ],
  chart: [
    { re: /柱状图|条形图|折线图|饼图|扇形图|散点图/, w: 8 },
    { re: /统计|频数|频率分布|直方图|占比/, w: 5 },
    { re: /样本|调查|问卷|数据表|增长率/, w: 3 },
    { re: /图例|横轴|纵轴|误差棒|置信区间/, w: 4 },
    { re: /同比|环比|百分比|个百分点/, w: 3 },
  ],
  general: [],
};

/** 各类别的保底分：都命中不了时倾向这些，避免空手而归 */
const PRIOR: Record<ResolvedKind, number> = {
  function: 0,
  mindmap: 0,
  physics: 0,
  geometry: 0,
  circuit: 0,
  chart: 0,
  general: 1,
};

/** 评分明细，供 UI 展示「为什么这样判断」 */
export type KindScores = Record<ResolvedKind, number>;

export type Detection = {
  kind: ResolvedKind;
  scores: KindScores;
  /** 次优类型与最优的差距；差距小说明识别不确信，应提示用户手动选择 */
  margin: number;
  confident: boolean;
};

/** 打分式识别：比「物理优先」的硬判断更贴近真实语义 */
export const detectKindDetailed = (text: string): Detection => {
  const t = text || '';
  const scores = {} as KindScores;
  for (const key of Object.keys(RULES) as ResolvedKind[]) {
    let s = PRIOR[key];
    for (const { re, w } of RULES[key]) if (re.test(t)) s += w;
    scores[key] = s;
  }

  /*
   * 结构性加分：不看关键词，看「排版形状」。
   * 大段用顿号/分号罗列多项内容的文字，几乎都是要画层级结构图而不是数学曲线；
   * 出现明确等式（含 = 与自变量）才更像函数图像。这类信号比关键词更可靠。
   */
  const listMarks = (t.match(/、/g) ?? []).length;
  if (listMarks >= 3) scores.mindmap += 5;
  if (/[:：]\s*\S+\s*[、，,]\s*\S+\s*[、，,]/.test(t)) scores.mindmap += 3;
  if (/[（(]\s*\d+\s*[)）]|^\s*\d+[.、]/m.test(t)) scores.mindmap += 2;

  const ranked = (Object.keys(scores) as ResolvedKind[]).sort(
    (a, b) => scores[b] - scores[a],
  );
  const best = ranked[0];
  const margin = scores[best] - (scores[ranked[1]] ?? 0);
  // 只有「明显领先」才算可信：至少拿 5 分且领先次优 3 分
  const confident = scores[best] >= 5 && margin >= 3;
  return { kind: best, scores, margin, confident };
};

/** 兼容旧调用：只要最终类型 */
export const detectKind = (text: string): ResolvedKind =>
  detectKindDetailed(text).kind;

/**
 * 每类图像各自的画法要点。
 * 关键：不同类型对「什么算画对了」的要求完全不同，
 * 函数图要精确坐标，思维导图要层级布局，物理图要矢量箭头——
 * 所以必须分类型给提示词，不能一句「画个示意图」了事。
 */
const KIND_GUIDE: Record<ResolvedKind, string> = {
  function: `这是【函数图像】，必须按解析几何标准绘制：
- 画直角坐标系，x 轴向右、y 轴向上，末端带箭头，标出 x / y 与原点 O；两个轴都要有均匀刻度数字。
- 曲线用平滑 path（C/Q 贝塞尔），必须与真实函数走势一致：极值点、拐点、增减区间、渐近行为都要对。
- 按定义域裁剪曲线，不要画到定义域外；定义域端点用实心/空心圆区分包含与不包含。
- 渐近线用虚线（stroke-dasharray），并在旁边标注方程。
- 极值点、零点、交点用 <circle> 标出，并在旁注坐标（如 (1, 2)）。
- 右上角或图内空白处放置函数表达式，例如 f(x)=x²-2x。
- 若涉及多条曲线，用不同颜色区分并在图例中说明。`,

  mindmap: `这是【思维导图】，必须按放射状/树状结构绘制：
- 中心是一个圆角矩形节点，写核心主题，字号最大（20~24），背景用主色填充、文字白色。
- 从中心向四周（上/下/左/右或左右对称）伸出 3~6 条主分支，每条主分支一个主题。
- 主分支下再挂 2~4 条子分支；层级用字号与颜色深浅区分（一级 > 二级 > 三级）。
- 连接线用平滑曲线（三次贝塞尔），从父节点边缘连到子节点边缘，线条粗细逐级变细。
- 每个分支用不同色系，同组分支颜色统一；节点内文字左对齐或居中，不要把文字压在连线上。
- 节点间保持均匀间距，整体左右对称，避免交叉。
- 不要画坐标轴。文字要短（每条不超过 12 字），长内容要提炼关键词而不是整句照抄。`,

  physics: `这是【物理示意图】，必须符合物理规范：
- 受力分析：物体画成矩形/圆/斜面等实体，所有力从作用点画起，用带实心箭头的线段表示，箭头旁标注符号与大小（如 F=10N、mg、N、f）；重力竖直向下，支持力垂直接触面，摩擦力沿接触面。
- 光学：画出界面（水平/竖直实线）与法线（虚线），入射光线与反射光线带箭头并标注角度 θ₁、θ₂；透镜用椭圆/双箭头符号，标出焦点 F 与光心 O。
- 波动：画正弦/余弦曲线，标出振幅 A、波长 λ，用双向箭头标注一个完整波长。
- 场：电力线从正电荷发出指向负电荷（箭头），磁感线标 N/S 极，线条密度体现强弱。
- 运动学：画轨迹曲线、初速度矢量、加速度矢量，标出关键位置。
- 所有矢量必须是「线段 + 三角形箭头」，不要只用一条线冒充矢量。`,

  geometry: `这是【几何图形】，必须按尺规作图标准绘制：
- 用精确的几何形状，顶点用 <circle> 标注并写字母（A、B、C…）。
- 边长、角度标注写清（如 AB=5、∠A=60°），角度可用弧线标出。
- 题目涉及的辅助线用虚线（stroke-dasharray），实线表示原图边。
- 直角用直角小方框符号表示，平行关系用双箭头短标记。
- 圆要标出圆心 O、半径 r，必要时画切线与半径的垂直关系。
- 图形尽量保持真实比例（如等边三角形要看起来等边），不要画成随意形状。
- 若提供坐标，则附带坐标系并标出各点坐标。`,

  circuit: `这是【电路图】，必须用标准电路元件符号：
- 电源：长短线对（长线为正极），标 +/− 与电动势 ε 或 U。
- 电阻：矩形框或锯齿线，标 R₁、R₂ 与阻值。
- 电容：两条平行短线，标 C；电感：连续半圆弧，标 L。
- 电流表 A、电压表 V 用圆圈内写字母，电流表串联、电压表并联。
- 开关用断开的斜线表示，标 S。
- 所有连线用直角折线（横平竖直），节点处画实心圆点（junction）。
- 电流方向用箭头 + I 标注。
- 回路必须闭合（除非是课本特意画的开路），布局横平竖直、元件间距均匀。`,

  chart: `这是【统计图表】，必须按数据可视化规范绘制：
- 柱状图：等宽柱体，底部对齐 x 轴，柱顶标数值，柱间留等距间隙。
- 折线图：数据点用圆点标出，折线连接，必要时加趋势线。
- 饼图：按比例分扇区，标出百分比与图例，扇区用不同颜色。
- 直方图：柱子紧邻无间隙，体现频数分布。
- 必须有：带刻度的坐标轴、轴标题（如「年份」「销量/万元」）、图例。
- 数值必须与文字中的数据一致；若文字只给趋势没给数据，用示意性数值但要在图中注明「示意」。
- 配色统一，避免超过 5 种颜色。`,

  general: `这是【通用示意图】，用框图表达结构或流程：
- 用圆角矩形作为节点，节点内写关键词（不超过 12 字）。
- 用带箭头的折线连接，表示流程方向或从属关系。
- 层级清晰的用树状布局（上→下），流程清晰的用横向（左→右）。
- 同类节点颜色一致，用底色区分层级。
- 在节点旁加简短说明文字，必要时加分组边框（虚线框 + 组名）。`,
};

/** 学术插图大师的系统提示词——"不论什么模型都能画好图"的核心技能 */
export const buildSvgSystemPrompt = (kind: DiagramKind = 'auto', text = ''): string => {
  const resolved: ResolvedKind = kind === 'auto' ? detectKind(text) : kind;
  return `你是一位顶尖的学术插图大师，专门把数学与物理内容画成清晰、准确、专业的矢量示意图。你的唯一产出是一张自包含的 SVG 图片。

【本次要画的类型：${DIAGRAM_KIND_LABELS[resolved]}】
${KIND_GUIDE[resolved]}

硬性要求（必须全部满足）：
1. 只输出一个 <svg ...>...</svg>，根元素必须带 xmlns="http://www.w3.org/2000/svg" 与 viewBox。禁止输出任何解释文字，禁止用三反引号代码块包裹，禁止在 SVG 之外出现任何字符。
2. 画布宽度约 760，高度按内容取 420~620；背景填纯白 #ffffff 或极浅灰 #f8fafc。风格像严谨的教材插图，简洁、对齐、留白充分。
3. 克制的配色：主色靛蓝 #4f46e5，强调色琥珀 #f59e0b 或玫红 #e11d48，坐标轴/线条 #334155，文字 #0f172a。同类别元素颜色统一。
4. 所有文字用 <text>，font-size 不小于 15；西文与数字用 "Georgia, 'Times New Roman', serif"，中文用系统无衬线体。文本中的 & < > 必须写成 &amp; &lt; &gt;。文字置于元素上层，避免被图形遮挡。
5. 箭头统一用 <defs><marker> 定义，再以 marker-end 引用；不要手绘三角形充当所有箭头（物理矢量除外，矢量箭头需与线段等宽）。
6. 布局分层：先背景/网格，再主体图形，最后文字标注。坐标尽量用整数，图形元素居中对齐。
7. 严禁出现：<script>、外链图片或字体、<foreignObject>、动画、任何 onXxx 事件属性。确保 XML 合法、所有标签正确闭合。
8. 公式用普通文本呈现（如 f(x)=x²、∫、Σ、√ 直接用 Unicode 字符或清晰排版），不要依赖外部渲染。
9. 图中出现的所有数字与符号必须来自原文，不得凭空编造数据。`;
};

/** 构造给模型的用户消息 */
export const buildSvgUserPrompt = (text: string, kind: DiagramKind): string => {
  const resolved: ResolvedKind = kind === 'auto' ? detectKind(text) : kind;
  return `请把下面这段内容画成一张准确的【${DIAGRAM_KIND_LABELS[resolved]}】。
${KIND_GUIDE[resolved]}

内容是：
"""${text}"""

直接给出 SVG，不要任何额外说明。`;
};

/** 从模型输出中提取完整的 <svg>…</svg>（容忍 ```svg 包裹与前后杂文本） */
export const extractSvg = (raw: string): string | null => {
  if (!raw) return null;
  const start = raw.indexOf('<svg');
  if (start === -1) return null;
  const end = raw.lastIndexOf('</svg>');
  if (end === -1) return null;
  return raw.slice(start, end + 6).trim();
};

/** 净化 SVG：去脚本/事件/外链，供 innerHTML 安全注入 */
export const sanitizeSvg = (svg: string): string =>
  svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/gi, (m) =>
      /javascript:|https?:/i.test(m) ? '' : m,
    );

/** 读取 SVG 尺寸（优先 viewBox） */
const svgSize = (svg: string): { w: number; h: number } => {
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(svg);
  if (vb) {
    const parts = vb[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] };
    }
  }
  const w = /width\s*=\s*"([\d.]+)/i.exec(svg);
  const h = /height\s*=\s*"([\d.]+)/i.exec(svg);
  return { w: w ? Number(w[1]) : 760, h: h ? Number(h[1]) : 480 };
};

/** 把 SVG 栅格化为 PNG Blob（2x 清晰度，白底） */
export const svgToPngBlob = async (svg: string, scale = 2): Promise<Blob> => {
  let s = svg.trim();
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  // 去掉固定宽高，让 viewBox 决定比例
  s = s.replace(/(<svg[^>]*?)\s(width|height)\s*=\s*"[^"]*"/gi, '$1');
  const { w, h } = svgSize(svg);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG 栅格化失败'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 导出失败'))), 'image/png'),
  );
};

/** 触发浏览器下载 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const svgFilenameBase = (text: string): string => {
  const base = (text || '示意图').replace(/[\\/:*?"<>|\n\r]+/g, '').slice(0, 24);
  return `Principia-${base || '示意图'}`;
};
