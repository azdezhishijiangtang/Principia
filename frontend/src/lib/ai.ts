/**
 * AI 答疑服务：OpenAI 兼容接口的配置管理与流式对话。
 * 用户的 API Key 仅保存在浏览器 localStorage，不会上传到任何服务器。
 */

/** AI 服务配置 */
export interface AiConfig {
  /** 思考模式：quick 快速回答（直接给答案）；deep 深度思考（先思考再作答） */
  thinkingMode?: 'quick' | 'deep';
  /** @deprecated 旧版「推理强度」字段，仅用于读取历史存档后迁移到 thinkingMode */
  reasoningEffort?: 'off' | 'low' | 'medium' | 'high';
  /** 接口基础地址，如 https://api.deepseek.com/v1 */
  baseUrl: string;
  apiKey: string;
  /** 模型名，如 deepseek-flash / kimi-k3 / glm-5.3 */
  model: string;
}

/**
 * 思考模式：
 * - quick 快速回答：直接给出答案，不展示思考过程
 * - deep  深度思考：先展示思考过程，再给出解答
 */
export type ThinkingMode = 'quick' | 'deep';

/**
 * 解析生效的思考模式。
 * 兼容旧存档：历史存的是推理强度 reasoningEffort，
 * 这里把 medium/high 视为深度思考，其余视为快速回答。
 */
export const resolveThinkingMode = (cfg: AiConfig): ThinkingMode =>
  cfg.thinkingMode ??
  (cfg.reasoningEffort === 'medium' || cfg.reasoningEffort === 'high' ? 'deep' : 'quick');

/** 各模式的输出预算与采样温度：快速回答更短更聚焦，深度思考给足推理空间 */
const MODE_PLAN = {
  quick: { maxTokens: 2048, temperature: 0.3, thinkingBudget: 512 },
  deep: { maxTokens: 16384, temperature: 0.2, thinkingBudget: 8192 },
} as const;

/**
 * 各模式追加到系统提示词的作答要求。
 *
 * 为什么需要它：各家「开启思考」的参数互不通用——OpenAI 用 reasoning_effort，
 * DeepSeek/GLM/Kimi 用 thinking，通义千问用 enable_thinking。只发参数时，
 * 遇到不支持的服务商会被静默忽略。因此把模式要求同时写进提示词，
 * 保证「快速 / 深度」的差异一定可感知。
 */
const MODE_GUIDANCE = {
  quick: '作答方式：快速回答。直接给出结论与关键步骤，不展开思考过程、不做多角度比较，力求简洁准确、直奔答案。',
  deep: '作答方式：深度思考。先充分分析（枚举可能思路并比较、识别关键条件与易错陷阱），再严格分步推导，最后给出结论；回答可以详尽，但不要堆砌废话。',
} as const;

/** 取某模式应追加到系统提示词的作答要求 */
export const getModeGuidance = (mode: ThinkingMode): string => MODE_GUIDANCE[mode];

/**
 * 按服务商 / 模型决定「开启或关闭思考」的参数写法（各家并不统一）。
 * deep 开启思考；quick 显式关闭（否则部分模型默认就会思考，快不起来）。
 */
const thinkingParams = (
  baseUrl: string,
  model: string,
  mode: ThinkingMode,
): Record<string, unknown> => {
  const url = baseUrl.toLowerCase();
  const m = model.toLowerCase();
  const on = mode === 'deep';
  // 通义千问（阿里云百炼）：enable_thinking + thinking_budget
  if (url.includes('dashscope') || m.startsWith('qwen')) {
    return { enable_thinking: on, thinking_budget: MODE_PLAN[mode].thinkingBudget };
  }
  // DeepSeek / Kimi(Moonshot) / 智谱 GLM：thinking 开关
  if (
    url.includes('deepseek') ||
    url.includes('moonshot') ||
    url.includes('bigmodel') ||
    m.includes('deepseek') ||
    m.startsWith('kimi') ||
    m.includes('glm')
  ) {
    return { thinking: { type: on ? 'enabled' : 'disabled' } };
  }
  // SiliconFlow 等聚合平台：按模型名判断
  if (url.includes('siliconflow')) {
    if (m.includes('deepseek') || m.includes('glm') || m.includes('kimi')) {
      return { thinking: { type: on ? 'enabled' : 'disabled' } };
    }
    if (m.includes('qwen')) {
      return { enable_thinking: on, thinking_budget: MODE_PLAN[mode].thinkingBudget };
    }
  }
  // OpenAI 系：深度思考用 reasoning_effort=high；快速回答不发送该参数
  return on ? { reasoning_effort: 'high' } : {};
};

/** 常用服务商预设（均为 OpenAI 兼容协议） */
export interface AiPreset {
  name: string;
  baseUrl: string;
  /** 默认模型（该服务商当前主力型号） */
  model: string;
  hint: string;
  /**
   * 内置参考模型目录：实时拉取 GET /models 失败时使用。
   * 随站点版本更新；用户 Key 可用时始终以服务商实时列表为准。
   */
  fallbackModels?: string[];
}

/**
 * 服务商预设（模型名单更新于 2026-10，以各官网站点为准）。
 * 说明：模型目录由 modelCatalog 实时拉取 + 内置参考双保险，
 * 预设里的默认模型只作为「未拉取到列表时」的兜底。
 */
export const AI_PRESETS: AiPreset[] = [
  {
    name: 'DeepSeek',
    // 官方文档当前 base_url 为 https://api.deepseek.com（/v1 亦可兼容）
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    hint: 'V4.1-Flash 极速低价；V4-Pro 旗舰推理',
    fallbackModels: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat（已退役）', 'deepseek-reasoner（已退役）'],
  },
  {
    name: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3',
    hint: 'K3 旗舰；moonshot-v1 系列已全部下线',
    fallbackModels: ['kimi-k3', 'kimi-k2.6', 'kimi-k2.5', 'moonshot-v1-8k（已下线）'],
  },
  {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3-max',
    hint: '阿里云百炼，qwen3-max 旗舰',
    fallbackModels: ['qwen3-max', 'qwen-plus', 'qwen-flash', 'qwen-turbo', 'qwen3-coder-plus'],
  },
  {
    name: '智谱 AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3',
    hint: 'GLM-5.3 旗舰；glm-4.5-flash 免费',
    fallbackModels: ['glm-5.3', 'glm-5.3-flash', 'glm-5.2', 'glm-5.1', 'glm-4.7', 'glm-4.6', 'glm-4.5-flash'],
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-luna',
    hint: 'GPT-5.6 Luna 低成本；Astra 旗舰',
    fallbackModels: ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-mini', 'gpt-5-mini'],
  },
  {
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V4-Flash',
    hint: '聚合平台百款模型，按 厂商/模型 命名',
    fallbackModels: [
      'deepseek-ai/DeepSeek-V4-Pro',
      'deepseek-ai/DeepSeek-V4-Flash',
      'deepseek-ai/DeepSeek-V3.2',
      'Qwen/Qwen3-8B',
      'Qwen/Qwen3-Coder-Plus',
      'THUDM/GLM-5.3',
      'moonshotai/Kimi-K2.6',
      'Pro/deepseek-ai/DeepSeek-R1',
    ],
  },
];

const CONFIG_KEY = 'mathlens-ai-config';
const PROFILES_KEY = 'mathlens-ai-profiles';
const ACTIVE_KEY = 'mathlens-ai-active-profile';

/** 接口存档数量：三套独立配置，互不覆盖 */
export const AI_PROFILE_COUNT = 3;
export const AI_PROFILE_LABELS = ['存档 1', '存档 2', '存档 3'];

/** 单个存档：配置 + 用户备注名 */
export interface AiProfile extends AiConfig {
  /** 备注名，如「DeepSeek 主力」 */
  name?: string;
}

const isValid = (p: AiProfile | null | undefined): p is AiProfile =>
  Boolean(p && p.baseUrl && p.apiKey && p.model);

/** 读取三个存档（旧版单配置会自动迁移到存档 1） */
export const readAiProfiles = (): (AiProfile | null)[] => {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as (AiProfile | null)[];
      return Array.from({ length: AI_PROFILE_COUNT }, (_, i) => (isValid(arr[i]) ? arr[i]! : null));
    }
    // 迁移：旧版单配置 → 存档 1
    const legacy = localStorage.getItem(CONFIG_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as AiProfile;
      const list: (AiProfile | null)[] = [isValid(parsed) ? parsed : null, null, null];
      localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
      return list;
    }
  } catch {
    /* 忽略损坏数据 */
  }
  return [null, null, null];
};

export const saveAiProfile = (index: number, profile: AiProfile): void => {
  const list = readAiProfiles();
  list[index] = profile;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  setActiveProfile(index);
};

export const clearAiProfile = (index: number): void => {
  const list = readAiProfiles();
  list[index] = null;
  localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  // 清掉的正好是当前生效的：切到另一个已配置的存档，否则清空生效配置
  if (getActiveProfile() === index) {
    const next = list.findIndex(isValid);
    if (next >= 0) setActiveProfile(next);
    else {
      localStorage.removeItem(CONFIG_KEY);
      localStorage.setItem(ACTIVE_KEY, String(index));
    }
  }
};

export const getActiveProfile = (): number => {
  const raw = Number(localStorage.getItem(ACTIVE_KEY));
  return Number.isInteger(raw) && raw >= 0 && raw < AI_PROFILE_COUNT ? raw : 0;
};

export const setActiveProfile = (index: number): void => {
  localStorage.setItem(ACTIVE_KEY, String(index));
  const p = readAiProfiles()[index];
  if (isValid(p)) localStorage.setItem(CONFIG_KEY, JSON.stringify(p));
  else localStorage.removeItem(CONFIG_KEY);
};

export const readAiConfig = (): AiConfig | null => {
  try {
    const p = readAiProfiles()[getActiveProfile()];
    if (isValid(p)) return { baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model, reasoningEffort: p.reasoningEffort };
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiConfig;
    if (!parsed?.baseUrl || !parsed?.apiKey || !parsed?.model) return null;
    return parsed;
  } catch {
    return null;
  }
};

/** 读取指定存档序号的配置（未配置或序号越界返回 null） */
export const readProfileConfig = (index: number): AiConfig | null => {
  const p = readAiProfiles()[index];
  if (isValid(p)) return { baseUrl: p.baseUrl, apiKey: p.apiKey, model: p.model, reasoningEffort: p.reasoningEffort };
  return null;
};

/** 保存当前生效存档（兼容旧调用） */
export const saveAiConfig = (config: AiConfig): void => {
  const i = getActiveProfile();
  const prev = readAiProfiles()[i];
  saveAiProfile(i, { ...config, name: prev?.name });
};

export const clearAiConfig = (): void => {
  clearAiProfile(getActiveProfile());
};

/**
 * 用当前 API Key 拉取该服务商可用的模型列表（OpenAI 兼容的 GET /models）。
 * 返回模型 id 数组（已排序）；失败时抛出可读的中文错误。
 * signal 可由调用方传入，用于超时控制。
 */
export const fetchModels = async (
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(describeAiError(new Error(`${res.status} ${detail.slice(0, 200)}`)));
  }
  const json = (await res.json()) as { data?: { id?: string }[] };
  const ids = (json.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) throw new Error('该接口没有返回可用模型，请手动填写模型名。');
  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
};

/** 对话消息（与 OpenAI 接口对齐） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 数学助教的系统提示词 */
export const MATH_TUTOR_SYSTEM_PROMPT = `你是 Principia 的本科数学与物理助教，服务对象是数学、物理专业本科生与考研学生。

回答规范：
1. 使用简体中文，语气像耐心的助教：先给直观思路，再分步推导，最后点明关键。
2. 公式一律使用 LaTeX：行内公式用 $...$ 包裹（如 $f'(x)$），独立公式用 $$...$$ 单独成行。公式中的反斜杠、花括号必须按标准 LaTeX 书写。
3. 引用定理时给出名称与适用条件；题目先分析题型再选择方法。
4. 如果题目条件不足或你有不确定的地方，明确说明，绝不编造定理或数据。
5. 回答控制在必要长度：概念问题讲透为止，计算问题完整呈现关键步骤，不要堆砌废话。`;

/** 把网络/接口错误翻译成用户看得懂的中文提示 */
export const describeAiError = (err: unknown): string => {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return '已停止生成。';
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return '网络请求失败：可能是网络不通，或该服务商不允许浏览器跨域直连（CORS）。可尝试更换服务商，或检查网络代理设置。';
  }
  if (/401|invalid.*api key|unauthorized/i.test(msg)) {
    return 'API Key 无效或已过期（401），请检查密钥是否正确、账户是否欠费。';
  }
  if (/403|forbidden/i.test(msg)) {
    return '访问被拒绝（403）：密钥可能没有该模型的权限，或触发了服务商的访问限制。';
  }
  if (/429|rate limit/i.test(msg)) {
    return '请求过于频繁（429），已被服务商限流。请稍等片刻再试。';
  }
  if (/404|model.*not/i.test(msg)) {
    return '接口或模型不存在（404）：请检查接口地址与模型名是否匹配（不同服务商的模型名不同）。';
  }
  if (/500|502|503/i.test(msg)) {
    return '服务商内部错误（5xx），可能是临时故障，稍后重试或更换服务商。';
  }
  return msg;
};

/**
 * 流式对话：通过 fetch + SSE 逐段产出回复文本。
 * 调用方可用 AbortController 中断。
 */
/** 接口返回的元信息：模型名与 token 用量 */
export interface ChatMeta {
  model?: string;
  usage?: { prompt: number; completion: number; total: number };
}

export async function* streamChat(
  config: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
  onMeta?: (meta: ChatMeta) => void,
  /** 思考过程回调：推理模型的 reasoning_content 会逐段回传，供 UI 展示 */
  onReasoning?: (text: string) => void,
): AsyncGenerator<string, void, unknown> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  /**
   * 组装请求体。withThinking=false 时不发送任何厂商推理参数，
   * 用于服务商不认识这些参数（400）时的降级重试。
   */
  const buildBody = (withThinkingParams: boolean): string => {
    const mode = resolveThinkingMode(config);
    const plan = MODE_PLAN[mode];
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      // 快速回答：输出更短更聚焦；深度思考：给足推理与作答空间
      temperature: plan.temperature,
      max_tokens: plan.maxTokens,
    };
    // withThinkingParams=false 用于服务商不认识这些参数（400）时的降级重试
    if (withThinkingParams) {
      Object.assign(body, thinkingParams(config.baseUrl, config.model, mode));
    }
    return JSON.stringify(body);
  };

  const post = (withThinking: boolean) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: buildBody(withThinking),
      signal,
    });

  let res: Response;
  try {
    res = await post(true);
    // 服务商不认识思考参数（400）时自动降级重试，避免「选了深度思考就报错」
    if (!res.ok && res.status === 400) {
      res = await post(false);
    }
  } catch (err) {
    throw new Error(describeAiError(err));
  }

  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message ?? data?.message ?? '';
    } catch {
      /* 忽略非 JSON 错误体 */
    }
    throw new Error(
      `接口返回 ${res.status}${detail ? `：${detail}` : ''}`,
    );
  }
  if (!res.body) throw new Error('接口未返回数据流');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 数据以 \n\n 分隔
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        if (json.model || json.usage) {
          onMeta?.({
            model: json.model,
            usage: json.usage
              ? {
                  prompt: json.usage.prompt_tokens ?? 0,
                  completion: json.usage.completion_tokens ?? 0,
                  total: json.usage.total_tokens ?? 0,
                }
              : undefined,
          });
        }
        const choice = json.choices?.[0];
        // 思考过程：多数推理模型在 delta.reasoning_content 中输出思维链
        const reasoningDelta: string | undefined =
          choice?.delta?.reasoning_content ??
          choice?.delta?.reasoning ??
          choice?.message?.reasoning_content;
        if (reasoningDelta) onReasoning?.(reasoningDelta);
        const delta: string | undefined =
          choice?.delta?.content ??
          choice?.message?.content;
        if (delta) yield delta;
      } catch {
        /* 忽略无法解析的行 */
      }
    }
  }
}

/** 一次性对话（非流式），用于学习总结等后台任务 */
export const chatOnce = async (
  config: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> => {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
      signal,
    });
  } catch (err) {
    throw new Error(describeAiError(err));
  }
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error?.message ?? data?.message ?? '';
    } catch {
      /* 忽略 */
    }
    throw new Error(`接口返回 ${res.status}${detail ? `：${detail}` : ''}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
};
