# 本科数学系全课程内容补全计划

> 目标：全面覆盖本科数学系（数学与应用数学专业）所有内容。
> 现有 18 门课程 51 个专题 → 补全为 **22 门课程 166 个专题**。
> 本文件是所有内容生成代理的唯一大纲依据：**id / chapter / title 必须严格按本文件执行，不得自行改动**。

图例：**[保]** = 文件中已存在的专题（重写其 content 为超详细讲解，元信息一字不改）；
**[增]** = 新增专题（追加到文件数组中，relatedProblemIds 固定为 `[]`）。

---

## 一、已有 18 门课程的补全

### 1. calculus.ts 高等数学（3 → 10）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| limits | 第一章 函数与极限 | 极限与连续性 | [保] |
| derivatives | 第二章 一元函数微分学 | 导数与微分 | [增] |
| mean-value-theorem | 第二章 一元函数微分学 | 微分中值定理及其应用 | [增] |
| taylor | 第二章 一元函数微分学 | 泰勒展开 | [保] |
| integrals | 第三章 一元函数积分学 | 不定积分与定积分 | [保] |
| integral-applications | 第三章 一元函数积分学 | 定积分的应用 | [增] |
| multivariable-differential | 第四章 多元函数微分学 | 多元函数微分学 | [增] |
| multiple-integrals | 第五章 重积分 | 二重积分与三重积分 | [增] |
| line-surface-integrals | 第六章 曲线积分与曲面积分 | 曲线积分、曲面积分与场论初步 | [增] |
| infinite-series | 第七章 无穷级数 | 数项级数与幂级数 | [增] |

### 2. linear-algebra.ts 线性代数（2 → 9）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| determinants | 第一章 行列式 | 行列式的定义与计算 | [保] |
| matrix-operations | 第二章 矩阵及其运算 | 矩阵运算、逆矩阵与初等变换 | [增] |
| linear-systems | 第三章 线性方程组 | 线性方程组的解法与结构 | [增] |
| vector-spaces | 第四章 向量空间 | 向量空间、基与维数 | [增] |
| linear-transformations | 第五章 线性变换 | 线性变换及其矩阵 | [增] |
| eigen | 第六章 特征值与相似矩阵 | 特征值与特征向量 | [保] |
| similar-jordan | 第六章 特征值与相似矩阵 | 相似标准形与若尔当标准形 | [增] |
| quadratic-forms | 第七章 二次型 | 二次型的标准形与正定性 | [增] |
| inner-product-spaces | 第八章 内积空间 | 内积空间与正交对角化 | [增] |

### 3. mathematical-analysis.ts 数学分析（3 → 12）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| real-numbers | 第一章 实数与数列极限 | 实数完备性与确界原理 | [保] |
| limits-continuity | 第二章 函数极限与连续性 | 函数极限与连续性 | [增] |
| derivatives-ma | 第三章 导数与微分 | 导数与微分 | [增] |
| mean-value-ma | 第四章 微分中值定理 | 微分中值定理与泰勒公式 | [增] |
| integrals-ma | 第五章 积分学 | 黎曼积分 | [增] |
| integral-apps-ma | 第六章 定积分的应用 | 定积分的应用与反常积分 | [增] |
| uniform-convergence | 第七章 函数项级数 | 一致收敛性 | [保] |
| parameter-integrals | 第八章 含参变量积分 | 含参变量积分 | [保] |
| multivariable-ma | 第九章 多元函数微分学 | 多元函数微分学 | [增] |
| multiple-integrals-ma | 第十章 重积分与曲线曲面积分 | 重积分与曲线曲面积分 | [增] |
| fourier-series-ma | 第十一章 傅里叶级数 | 傅里叶级数 | [增] |

### 4. analytic-geometry.ts 解析几何（3 → 6）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| vector-algebra | 第一章 向量代数 | 向量代数与空间坐标系 | [保] |
| plane-line | 第二章 平面与直线 | 平面与空间直线 | [保] |
| quadric-surfaces | 第三章 二次曲面 | 二次曲面与坐标变换 | [保] |
| coordinate-transforms | 第四章 坐标变换 | 坐标变换与二次曲面分类 | [增] |
| conic-theory | 第五章 二次曲线的一般理论 | 二次曲线的一般理论 | [增] |
| isometries | 第六章 等距变换与仿射变换 | 等距变换与仿射变换 | [增] |

### 5. probability.ts 概率论与数理统计（2 → 8）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| bayes | 第一章 随机事件与概率 | 条件概率与贝叶斯公式 | [保] |
| distributions | 第二章 随机变量及其分布 | 常见概率分布 | [保] |
| random-vectors | 第二章 随机变量及其分布 | 多维随机变量及其分布 | [增] |
| characteristic-functions | 第二章 随机变量及其分布 | 特征函数 | [增] |
| numerical-characteristics | 第三章 数字特征 | 数学期望、方差与协方差 | [增] |
| limit-theorems | 第四章 大数定律与中心极限定理 | 大数定律与中心极限定理 | [增] |
| estimation | 第五章 参数估计 | 参数估计 | [增] |
| hypothesis-testing | 第六章 假设检验 | 假设检验 | [增] |

### 6. discrete-math.ts 离散数学（2 → 6）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| logic | 第一章 命题逻辑 | 命题逻辑与范式 | [保] |
| predicate-logic | 第二章 谓词逻辑 | 谓词逻辑与量词推理 | [增] |
| sets-relations | 第三章 集合与关系 | 集合、关系与函数 | [增] |
| graphs | 第四章 图论基础 | 图论基础与树 | [保] |
| graph-algorithms | 第五章 图算法 | 图的遍历与最短路 | [增] |
| counting-basics | 第六章 组合计数初步 | 基本计数原理 | [增] |

### 7. ode.ts 常微分方程（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| first-order-ode | 第一章 一阶微分方程 | 一阶微分方程的解法 | [保] |
| higher-linear-ode | 第二章 高阶线性微分方程 | 高阶线性微分方程 | [保] |
| existence-uniqueness | 第三章 解的存在唯一性 | 皮卡存在定理与唯一性 | [增] |
| ode-systems | 第四章 方程组与稳定性 | 微分方程组与稳定性初步 | [保] |
| constant-coefficient-systems | 第五章 常系数线性方程组 | 常系数线性方程组的解法 | [增] |
| phase-plane | 第六章 相平面与定性理论 | 相平面与定性分析 | [增] |
| stability-theory | 第七章 稳定性理论 | 李雅普诺夫稳定性 | [增] |

### 8. pde.ts 偏微分方程（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| typical-pde | 第一章 典型方程与定解问题 | 三类典型方程与定解问题 | [保] |
| fourier-separation | 第二章 傅里叶级数与分离变量 | 傅里叶级数与分离变量法 | [保] |
| green-functions | 第三章 格林函数法 | 格林函数与调和方程 | [保] |
| heat-equation | 第四章 热传导方程 | 热传导方程 | [增] |
| wave-equation | 第五章 波动方程 | 波动方程与达朗贝尔公式 | [增] |
| laplace-equation | 第六章 调和方程 | 狄利克雷问题与泊松公式 | [增] |
| characteristics | 第七章 特征线法 | 一阶方程的特征线法 | [增] |

### 9. complex-analysis.ts 复变函数（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| analytic-functions | 第一章 解析函数 | 解析函数 | [保] |
| cauchy-theory | 第二章 柯西积分理论 | 柯西积分定理与公式 | [保] |
| residues | 第三章 留数理论 | 留数定理 | [保] |
| power-series | 第四章 幂级数展开 | 解析函数的幂级数表示 | [增] |
| argument-principle | 第五章 辐角原理与鲁歇定理 | 辐角原理及其应用 | [增] |
| conformal-mapping | 第六章 共形映射 | 共形映射 | [增] |
| analytic-continuation | 第七章 解析开拓 | 解析开拓与黎曼面 | [增] |

### 10. abstract-algebra.ts 抽象代数（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| group-theory | 第一章 群论 | 群论基础 | [保] |
| group-actions | 第二章 群的作用 | 群作用与西罗定理 | [增] |
| rings-fields | 第三章 环与域 | 环与域 | [保] |
| ufd-polynomials | 第四章 唯一分解整环 | 唯一分解整环与多项式环 | [增] |
| field-extensions | 第五章 域的扩张 | 代数扩张与有限域 | [增] |
| galois | 第六章 伽罗瓦理论 | 伽罗瓦理论初步 | [保] |
| modules | 第七章 模论初步 | 模与主理想整环上的分解 | [增] |

### 11. combinatorics.ts 组合数学（3 → 6）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| generating-functions | 第一章 生成函数 | 生成函数 | [保] |
| inclusion-exclusion | 第二章 容斥与鸽巢 | 容斥原理与鸽巢原理 | [保] |
| polya | 第三章 波利亚计数 | 波利亚计数与组合设计 | [保] |
| counting-identities | 第四章 组合恒等式 | 组合恒等式与组合释义 | [增] |
| ramsey-theory | 第五章 拉姆齐理论 | 拉姆齐定理 | [增] |
| designs | 第六章 组合设计 | 区组设计与有限几何 | [增] |

### 12. real-analysis.ts 实变函数（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| lebesgue-measure | 第一章 勒贝格测度 | 勒贝格测度 | [保] |
| measurable-functions | 第二章 可测函数 | 可测函数与叶戈罗夫定理 | [增] |
| lebesgue-integral | 第三章 勒贝格积分 | 勒贝格积分 | [保] |
| convergence-theorems | 第三章 勒贝格积分 | 控制收敛定理及其应用 | [增] |
| lp-spaces | 第四章 Lp 空间 | Lp 空间与傅里叶级数 | [保] |
| differentiation | 第五章 微分与不定积分 | 有界变差与勒贝格微分定理 | [增] |
| product-measures | 第六章 乘积测度 | 乘积测度与富比尼定理 | [增] |

### 13. functional-analysis.ts 泛函分析（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| banach-spaces | 第一章 度量空间与巴拿赫空间 | 度量空间与巴拿赫空间 | [保] |
| dual-spaces | 第二章 对偶空间 | 线性泛函与对偶空间 | [增] |
| open-mapping | 第三章 基本定理 | 开映射、闭图像与一致有界原理 | [增] |
| hilbert-spaces | 第四章 希尔伯特空间 | 希尔伯特空间 | [保] |
| operators | 第五章 有界线性算子 | 有界线性算子 | [保] |
| spectral-theory | 第六章 谱理论 | 有界算子的谱理论 | [增] |
| compact-operators | 第七章 紧算子 | 紧算子与里斯–邵德尔理论 | [增] |

### 14. topology.ts 拓扑学（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| topological-spaces | 第一章 拓扑空间 | 拓扑空间与连续性 | [保] |
| continuous-maps | 第二章 连续映射与商空间 | 连续映射、同胚与商空间 | [增] |
| separation-axioms | 第三章 分离性公理 | 分离性公理与可数性 | [增] |
| compact-connected | 第四章 紧致性与连通性 | 紧致性与连通性 | [保] |
| covering-spaces | 第五章 覆叠空间 | 覆叠空间与提升定理 | [增] |
| fundamental-group | 第六章 基本群 | 基本群 | [保] |
| homology | 第七章 同调论初步 | 单纯同调初步 | [增] |

### 15. differential-geometry.ts 微分几何（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| curve-theory | 第一章 曲线论 | 曲线论：曲率与挠率 | [保] |
| regular-surfaces | 第二章 正则曲面 | 正则曲面与切空间 | [增] |
| surface-theory | 第三章 曲面论 | 曲面论：两个基本形式 | [保] |
| fundamental-forms | 第三章 曲面论 | 第一与第二基本形式的计算 | [增] |
| geodesics | 第四章 测地线 | 测地线与指数映射 | [增] |
| intrinsic-geometry | 第五章 内蕴几何 | 内蕴几何与高斯–博内定理 | [保] |
| differential-forms | 第六章 外微分形式 | 外微分形式与斯托克斯定理 | [增] |

### 16. stochastic-processes.ts 随机过程（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| markov-chains | 第一章 马尔可夫链 | 马尔可夫链 | [保] |
| ctmc | 第二章 连续时间马尔可夫链 | 连续时间马尔可夫链 | [增] |
| poisson-process | 第三章 泊松过程 | 泊松过程 | [保] |
| renewal-process | 第四章 更新过程 | 更新过程与更新定理 | [增] |
| brownian-martingale | 第五章 布朗运动与鞅 | 布朗运动与鞅 | [保] |
| stationary-processes | 第六章 平稳过程 | 平稳过程与遍历性 | [增] |
| stochastic-calculus | 第七章 随机分析初步 | 伊藤积分与伊藤引理 | [增] |

### 17. numerical-analysis.ts 数值分析（3 → 7）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| interpolation | 第一章 插值与逼近 | 插值与逼近 | [保] |
| function-approximation | 第一章 插值与逼近 | 函数逼近与最小二乘 | [增] |
| root-finding | 第二章 方程求根 | 非线性方程的数值解法 | [增] |
| numerical-integration | 第三章 数值积分与微分 | 数值积分与微分 | [保] |
| direct-methods | 第四章 线性方程组的直接法 | 高斯消去与矩阵分解 | [增] |
| iterative-methods | 第五章 线性方程组的迭代法 | 迭代法与条件数 | [增] |
| numerical-linear | 第六章 特征值问题 | 线性方程组与特征值数值解 | [保] |
| ode-numerical | 第七章 常微分方程数值解 | 常微分方程的数值解法 | [增] |

### 18. mathematical-logic.ts 数理逻辑（3 → 6）

| id | chapter | title | 类型 |
|----|---------|-------|------|
| propositional-logic | 第一章 命题逻辑 | 命题逻辑与自然演绎 | [增] |
| first-order-logic | 第二章 一阶逻辑 | 一阶逻辑与完备性 | [保] |
| model-theory | 第三章 模型论初步 | 模型论基本概念 | [增] |
| incompleteness | 第四章 哥德尔不完备定理 | 哥德尔不完备定理 | [保] |
| computability | 第五章 可计算性理论 | 可计算性理论 | [保] |
| set-theory | 第六章 集合论基础 | 集合论与连续统假设 | [增] |

---

## 二、新增 4 门课程（各建一个专题文件）

### 19. elementary-number-theory.ts 初等数论（7）

| id | chapter | title |
|----|---------|-------|
| divisibility | 第一章 整除与素数 | 整除、素数与其计数 |
| gcd-bezout | 第二章 最大公约数 | 最大公约数、裴蜀定理与欧几里得算法 |
| congruences | 第三章 同余 | 同余理论与中国剩余定理 |
| primitive-roots | 第四章 原根与指数 | 原根、指数与阶 |
| quadratic-residues | 第五章 二次剩余 | 二次互反律 |
| diophantine | 第六章 不定方程 | 不定方程与费马大定理特例 |

（courseId: 'elementary-number-theory'，relatedProblemIds 均为 `[]`）

### 20. optimization.ts 最优化方法（6）

| id | chapter | title |
|----|---------|-------|
| convexity | 第一章 凸性与优化基础 | 凸集、凸函数与优化问题分类 |
| linear-programming | 第二章 线性规划 | 线性规划的标准形与图解法 |
| simplex | 第三章 单纯形法 | 单纯形法 |
| duality | 第四章 对偶理论 | 线性规划的对偶理论 |
| unconstrained | 第五章 无约束优化 | 最优性条件与牛顿法 |
| kkt | 第六章 约束优化 | KKT 条件与次梯度 |

（courseId: 'optimization'，relatedProblemIds 均为 `[]`）

### 21. cryptography.ts 密码学基础（6）

| id | chapter | title |
|----|---------|-------|
| classical-ciphers | 第一章 古典密码 | 置换、代换与频率分析 |
| block-ciphers | 第二章 对称加密 | 分组密码与工作模式 |
| hash-functions | 第三章 哈希函数 | 哈希函数与消息认证 |
| rsa | 第四章 公钥密码 | RSA 与数论基础 |
| ecc | 第五章 椭圆曲线密码 | 椭圆曲线与 ECC |
| signatures | 第六章 签名与协议 | 数字签名与密钥交换 |

（courseId: 'cryptography'，relatedProblemIds 均为 `[]`）

### 22. data-science-math.ts 数据科学数学（7）

| id | chapter | title |
|----|---------|-------|
| matrix-decomposition | 第一章 矩阵分解 | SVD 与低秩逼近 |
| pca | 第二章 降维 | 主成分分析 |
| statistical-inference | 第三章 统计推断 | 频率学派与贝叶斯推断 |
| ml-optimization | 第四章 机器学习中的优化 | 经验风险最小化与正则化 |
| kernels | 第五章 核方法 | 核技巧与支持向量机 |
| mcmc | 第六章 采样方法 | MCMC 与梅特罗波利斯算法 |
| information-theory | 第七章 信息论 | 熵、互信息与编码 |

（courseId: 'data-science-math'，relatedProblemIds 均为 `[]`）

---

## 三、文件组织要求

1. **[保] 专题**：只重写 content 字段，其他字段（id/courseId/chapter/title/summary/keyPoints/relatedProblemIds）逐字保留。
2. **[增] 专题**：完整新对象，按上表的 chapter/title/id；`relatedProblemIds: []`；
   summary 写 1-2 句导语；keyPoints 写 4-5 条。
3. 同一文件中专题的**数组顺序**按上表顺序排列（决定"上一个/下一个"导航）。
4. 每个专题 content 3000~4500 汉字，七节结构（见 topic-content-spec.md）。
5. 新课程文件（19-22）由主控统一注册到 courses.ts 与 data/topics.ts，代理只建专题数据文件，
   文件头写 `import type { Topic } from '@/types';`，导出名如 `export const elementary_number_theoryTopics: Topic[] = [...]`。
