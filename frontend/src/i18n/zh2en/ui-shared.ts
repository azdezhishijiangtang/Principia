/**
 * 跨页面共享的短文案词典：学科名、课程分类名、难度标签。
 * 这些中文串来自 SUBJECT_META / courseCategories / difficultyLabel，
 * 在显示处以 t(...) 包裹后查此表。
 */
const dict: Record<string, string> = {
  // 学科（SUBJECT_META）
  数学区: 'Mathematics',
  数学: 'Math',
  物理区: 'Physics',
  物理: 'Physics',
  大学数学本科知识解答: 'Undergraduate mathematics, explained',
  大学物理本科知识解答: 'Undergraduate physics, explained',

  // 课程分类（courseCategories）
  分析: 'Analysis',
  代数与几何: 'Algebra & Geometry',
  概率统计: 'Probability & Statistics',
  方程与计算: 'Equations & Computation',
  离散与逻辑: 'Discrete Math & Logic',
  应用前沿: 'Applied Frontiers',
  经典物理: 'Classical Physics',
  理论物理: 'Theoretical Physics',
  凝聚态与材料: 'Condensed Matter & Materials',
  方法与计算: 'Methods & Computation',
  天体与粒子: 'Astrophysics & Particles',

  // 难度标签（difficultyLabel）
  基础: 'Basic',
  中等: 'Intermediate',
  较难: 'Advanced',
};

export default dict;
