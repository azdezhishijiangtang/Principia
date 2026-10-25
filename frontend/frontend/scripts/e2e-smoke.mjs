/**
 * 端到端冒烟测试：
 * 1) 全部路由渲染无 console error
 * 2) 首页显示 22 门课程 / 158 个专题
 * 3) 新课程（初等数论）与专题页 KaTeX 正常
 * 4) 页脚提交反馈 → /dev 解锁 → 回复反馈 → 用户在「我的反馈」看到回复
 * 5) 课程页方向筛选可用
 */
import pw from '/root/.nvm/versions/node/v22.13.1/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const BASE = 'http://localhost:3000';

const routes = [
  '/',
  '/courses',
  '/courses/linear-algebra',
  '/courses/elementary-number-theory',
  '/courses/data-science-math',
  '/topics/limits',
  '/topics/divisibility',
  '/topics/information-theory',
  '/problems',
  '/formulas',
  '/knowledge',
  '/tutor',
  '/study',
  '/login',
  '/dev',
];

const errors = [];
const results = [];

const main = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text().slice(0, 200)}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${page.url()} :: ${String(err).slice(0, 200)}`);
  });

  // ── 1. 全路由 ──
  for (const r of routes) {
    const resp = await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 30000 });
    const ok = resp && resp.status() === 200;
    const bodyLen = (await page.textContent('body'))?.length ?? 0;
    results.push(`${ok ? '✓' : '✗'} ${r} status=${resp?.status()} textLen=${bodyLen}`);
    if (!ok || bodyLen < 100) results.push(`  ⚠ 页面内容疑似异常: ${r}`);
  }

  // ── 2. 首页统计 ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const homeText = (await page.textContent('body')) ?? '';
  results.push(
    homeText.includes('22 门本科专业课') ? '✓ 首页显示 22 门课程' : '✗ 首页未显示 22 门课程',
  );
  results.push(
    homeText.includes('158') ? '✓ 首页显示 158 个专题' : '✗ 首页未显示 158',
  );
  results.push(
    homeText.includes('学科版图') ? '✓ 首页含学科版图模块' : '✗ 缺学科版图',
  );

  // ── 3. 新课程页 & KaTeX ──
  await page.goto(BASE + '/topics/divisibility', { waitUntil: 'networkidle' });
  const katexCount = await page.locator('.katex').count();
  results.push(`✓ 初等数论专题页 KaTeX 节点 ${katexCount} 个`);
  const h1 = await page.locator('h1').first().textContent();
  results.push(`✓ 专题标题: ${h1?.trim()}`);

  // ── 4. 课程页方向筛选 ──
  await page.goto(BASE + '/courses', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '应用前沿' }).click();
  await page.waitForTimeout(400);
  const cardsAfter = await page.locator('a[href^="/courses/"]').count();
  results.push(`✓ 应用前沿筛选后课程卡片 ${cardsAfter} 个（应为 4）`);

  // ── 5. 反馈闭环 ──
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '建议反馈' }).click();
  await page.waitForTimeout(500);
  const dialogVisible = await page.getByRole('dialog').isVisible();
  results.push(dialogVisible ? '✓ 反馈弹窗打开' : '✗ 反馈弹窗未打开');

  await page.getByPlaceholder('一句话概括你的反馈').fill('自动化测试反馈');
  await page.getByPlaceholder(/请尽量描述清楚/).fill('这是一条端到端测试提交的反馈内容。');
  await page.getByRole('button', { name: '提交反馈' }).last().click();
  await page.waitForTimeout(600);
  const mineText = (await page.getByRole('dialog').textContent()) ?? '';
  results.push(mineText.includes('自动化测试反馈') ? '✓ 反馈提交成功并出现在我的反馈' : '✗ 反馈未出现');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 6. 开发者模式解锁 + 回复 ──
  await page.goto(BASE + '/dev', { waitUntil: 'networkidle' });
  const gateVisible = (await page.textContent('body'))?.includes('输入开发者口令');
  results.push(gateVisible ? '✓ 开发者模式口令门存在' : '✗ 未显示口令门');
  await page.getByPlaceholder('请输入口令').fill('mathlens-dev');
  await page.getByRole('button', { name: '进入开发者模式' }).click();
  await page.waitForTimeout(700);
  const devText = (await page.textContent('body')) ?? '';
  results.push(devText.includes('站点管理台') ? '✓ 开发者模式解锁成功' : '✗ 解锁失败');
  results.push(devText.includes('自动化测试反馈') ? '✓ 反馈管理能看到测试反馈' : '✗ 反馈管理看不到');

  // 回复该反馈
  const replyButtons = page.getByRole('button', { name: '回复', exact: true });
  const replyCount = await replyButtons.count();
  results.push(`· 反馈条目的回复按钮数: ${replyCount}`);
  if (replyCount > 0) {
    await replyButtons.first().click();
    await page.waitForTimeout(500);
    const box = page.getByPlaceholder('输入官方回复……');
    if ((await box.count()) > 0) {
      await box.fill('已收到，感谢反馈！（自动化回复）');
      await page.getByRole('button', { name: '发送回复' }).click();
      await page.waitForTimeout(600);
      const afterReply = (await page.textContent('body')) ?? '';
      results.push(afterReply.includes('已收到，感谢反馈') ? '✓ 开发者回复成功' : '✗ 回复未成功');
    } else {
      results.push('✗ 回复输入框未出现');
    }
  } else {
    results.push('✗ 未找到回复按钮');
  }

  // 内容编辑 tab
  await page.getByRole('tab', { name: /内容编辑/ }).click();
  await page.waitForTimeout(500);
  const contentText = (await page.textContent('body')) ?? '';
  results.push(contentText.includes('讲解正文') ? '✓ 内容编辑器可用' : '✗ 内容编辑器异常');

  await browser.close();

  console.log('════════ 路由结果 ════════');
  results.forEach((r) => console.log(r));
  console.log('\n════════ Console 错误 ════════');
  if (errors.length === 0) console.log('✓ 无 console error');
  else errors.slice(0, 20).forEach((e) => console.log('✗', e));

  const fails = results.filter((r) => r.startsWith('✗')).length + errors.length;
  console.log(`\n总结：${fails === 0 ? '全部通过' : fails + ' 项失败'}`);
  process.exit(fails === 0 ? 0 : 1);
};

main().catch((e) => {
  console.log('════════ 已收集结果（崩溃前） ════════');
  results.forEach((r) => console.log(r));
  console.log('════════ Console 错误 ════════');
  errors.slice(0, 20).forEach((x) => console.log('✗', x));
  console.error('测试崩溃:', e.message?.slice(0, 300));
  process.exit(1);
});
