/**
 * 自动识别准确性自测：把一批真实题型跑一遍 detectKindDetailed。
 * 用法：npx esbuild src/lib/textImage.ts --bundle --format=esm --outfile=/tmp/ti.mjs && npx esbuild scripts/check-detect.ts ...
 * 简化：直接 `npx tsx scripts/check-detect.ts`（若已装 tsx），否则见 README。
 */
import { detectKindDetailed, type ResolvedKind } from '../src/lib/textImage';

type Case = [text: string, want: ResolvedKind];

const CASES: Case[] = [
  ['f(x)=x^3-3x，求导数为零的点，画出函数图像', 'function'],
  ['已知函数 y=ln x 与 y=x-1 的交点，讨论单调性与渐近线', 'function'],
  ['请梳理一元二次函数的知识结构：定义、图像、判别式、根与系数的关系、应用', 'mindmap'],
  ['牛顿第二定律的要点包括：惯性参考系、合外力、加速度方向、质量与力的关系', 'mindmap'],
  ['斜面上的物块受到重力、支持力与摩擦力，画出受力分析图，倾角为 30°', 'physics'],
  ['平行光经凸透镜折射后汇聚于焦点，画出光路图并标注物距与像距', 'physics'],
  ['在三角形 ABC 中，AB=AC，D 为 BC 中点，证明 AD⊥BC，作辅助线', 'geometry'],
  ['圆 O 的半径为 5，弦 AB 长 8，求圆心到 AB 的距离', 'geometry'],
  ['电路中有电源、开关、两个并联的电阻 R1 和 R2，以及一个电流表，求干路电流', 'circuit'],
  ['用电压表和滑动变阻器测电阻，画出电路图', 'circuit'],
  ['把各年份销售额做成柱状图，并标注同比增长率', 'chart'],
  ['本次调查样本频数分布如下，请画直方图并标出置信区间', 'chart'],
  ['这个章节的框架包括三个维度：理论、方法、实践，形成一个体系', 'mindmap'],
];

let pass = 0;
for (const [text, want] of CASES) {
  const d = detectKindDetailed(text);
  const ok = d.kind === want;
  if (ok) pass += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${d.kind.padEnd(9)} (期望 ${want}) 置信=${d.confident} 领先=${d.margin} :: ${text.slice(0, 24)}`,
  );
  if (!ok) console.log('   scores:', JSON.stringify(d.scores));
}

console.log(`\n${pass}/${CASES.length} 通过`);
if (pass < CASES.length) process.exitCode = 1;
