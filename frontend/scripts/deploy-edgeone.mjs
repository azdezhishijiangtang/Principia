#!/usr/bin/env node
/**
 * Principia 一键部署到腾讯 EdgeOne Pages（Makers）
 *
 * 为什么需要它：GitHub Pages 有两个先天问题——
 *   1. 国内访问 `*.github.io` 经常被墙 / 极慢 / 偶发 503，且没有可用 CDN；
 *   2. legacy 的 /docs 模式属于「项目站」，资源要挂在 /Principia/ 子路径下，
 *      一旦后面少了斜杠或直接访问深链接（如 /problems），就会 404。
 * EdgeOne Pages 部署在站点根路径、走腾讯云边缘节点，且支持 SPA 回源兜底，
 * 这两类问题都消失。
 *
 * 用法：
 *   # 方式一：API Token（推荐，可放进 CI 的 Secret）
 *   EDGEONE_API_TOKEN=xxx node scripts/deploy-edgeone.mjs "commit message"
 *
 *   # 方式二：已在本机执行过 edgeone login
 *   node scripts/deploy-edgeone.mjs
 *
 *   # 方式三：匿名部署（无需账号，得到一个临时体验域名，之后可在控制台认领）
 *   node scripts/deploy-edgeone.mjs --anonymous
 *
 * 环境变量：
 *   EDGEONE_API_TOKEN / EDGEONE_TOKEN  控制台「API Token」页生成的令牌
 *   EDGEONE_PROJECT                    EdgeOne 项目名，默认 principia
 *   EDGEONE_ENV                        production | preview，默认 production
 *   EDGEONE_AREA                       global | overseas，默认 global（仅首次创建项目时生效）
 *
 * 安全：Token 只从环境变量读取，绝不写入仓库或任何文件。
 */
import { execFileSync, execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND = join(__dirname, '..');
const DIST = join(FRONTEND, 'dist');
const EDGEONE_JSON = join(FRONTEND, 'edgeone.json');

const TOKEN = process.env.EDGEONE_API_TOKEN || process.env.EDGEONE_TOKEN || '';
const PROJECT = process.env.EDGEONE_PROJECT || 'principia';
const ENV_NAME = process.env.EDGEONE_ENV || 'production';
const AREA = process.env.EDGEONE_AREA || 'global';
/** 匿名部署站点：china（腾讯云国内站）| global（国际站） */
const SITE = process.env.EDGEONE_SITE || 'china';
const ANONYMOUS = process.argv.includes('--anonymous');
const SKIP_BUILD = process.argv.includes('--skip-build');
const DRY_RUN = process.argv.includes('--dry-run');
const MESSAGE =
  process.argv.slice(2).find((a) => !a.startsWith('--')) || 'deploy: update site';

/**
 * 注意：EdgeOne Pages 部署在站点根路径（不是 /Principia/ 子路径），
 * 因此这里必须用 Vite 的默认 base="/"。若沿用 GitHub Pages 的
 * --base=/Principia/，所有静态资源都会 404。
 */
const build = () => {
  console.log('── 1/3 构建生产包（base=/，适配 EdgeOne 根路径）──');
  if (SKIP_BUILD) {
    console.log('（--skip-build：跳过构建，直接使用现有 dist/）');
    return;
  }
  rmSync(DIST, { recursive: true, force: true });
  execSync('npx tsc -b', { cwd: FRONTEND, stdio: 'inherit' });
  execSync('npx vite build', { cwd: FRONTEND, stdio: 'inherit' });
};

/** 把 edgeone.json 一并放进产物：CLI 以 dist 为项目根时才能读到路由规则 */
const prepareDist = () => {
  if (!existsSync(DIST)) throw new Error('dist/ 不存在，请先构建。');
  /**
   * 注意：这里只下发「路由/回源」规则，绝不能带 buildCommand / outputDirectory。
   * 因为 CLI 直传时会把 dist 当作项目根，平台若再执行一次 `npm run build`，
   * dist 里没有源码与 package.json，构建必然失败（Func build failed）。
   * 带构建命令的完整配置保留在项目根的 edgeone.json，供控制台 Git 关联构建使用。
   */
  const runtimeConfig = {
    $schema: 'https://edgeone.ai/schema/edgeone.json',
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
  };
  if (existsSync(EDGEONE_JSON)) {
    try {
      const parsed = JSON.parse(readFileSync(EDGEONE_JSON, 'utf8'));
      if (Array.isArray(parsed.rewrites) && parsed.rewrites.length > 0) {
        runtimeConfig.rewrites = parsed.rewrites;
      }
    } catch {
      /* 配置损坏时使用默认回源规则 */
    }
  }
  writeFileSync(join(DIST, 'edgeone.json'), JSON.stringify(runtimeConfig, null, 2));

  // 单页应用入口兜底文件（部分平台会优先匹配 404 页面）
  const indexHtml = join(DIST, 'index.html');
  if (existsSync(indexHtml)) copyFileSync(indexHtml, join(DIST, '404.html'));
};

/** 解析 edgeone 可执行文件：优先全局安装，其次走 npx */
const resolveEdgeoneBin = () => {
  try {
    execFileSync('edgeone', ['--version'], { stdio: 'ignore' });
    return { cmd: 'edgeone', prefix: [] };
  } catch {
    console.log('未检测到全局 edgeone CLI，改用 npx 临时调用（首次会下载）。');
    return { cmd: 'npx', prefix: ['--yes', 'edgeone@latest'] };
  }
};

const deploy = () => {
  console.log(`── 2/3 部署到 EdgeOne Pages（项目 ${PROJECT} · ${ENV_NAME}）──`);
  const { cmd, prefix } = resolveEdgeoneBin();

  const args = [...prefix, 'makers', 'deploy', DIST, '-n', PROJECT, '-e', ENV_NAME, '--json'];
  if (ANONYMOUS) {
    args.push('--anonymous', '--site', SITE);
  } else if (TOKEN) {
    args.push('-t', TOKEN);
  } else {
    console.log('未提供 EDGEONE_API_TOKEN，将使用本机已登录的 EdgeOne 凭据。');
    console.log('若未登录过，请先执行 edgeone login，或改用 --anonymous 匿名部署。');
  }
  if (AREA) args.push('-a', AREA);

  if (DRY_RUN) {
    console.log(`[dry-run] ${cmd} ${args.join(' ').replace(TOKEN || '\u0000', '***')}`);
    return null;
  }

  // token 通过参数传递，避免出现在日志里：这里手动打码后再输出
  console.log(`执行：${cmd} ${args.join(' ').split(TOKEN || '\u0000').join('***')}`);
  const out = execFileSync(cmd, args, {
    cwd: FRONTEND,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    env: { ...process.env, EDGEONE_DEPLOY_MESSAGE: MESSAGE },
  });
  process.stdout.write(out);
  return out.trim().split('\n').filter(Boolean).pop() || '';
};

/** 从 --json 输出里取部署地址 */
const extractUrl = (lastLine) => {
  if (!lastLine) return null;
  try {
    const json = JSON.parse(lastLine);
    const pick = (o) => o?.url || o?.previewUrl || o?.domain || o?.result?.url;
    return pick(json) || pick(json?.data) || null;
  } catch {
    const m = lastLine.match(/https:\/\/[^\s"'\\]+/);
    return m ? m[0] : null;
  }
};

const main = () => {
  console.log('Principia → 腾讯 EdgeOne Pages');
  build();
  prepareDist();
  const lastLine = deploy();

  console.log('── 3/3 完成 ──');
  const url = extractUrl(lastLine);
  if (url) {
    console.log(`线上地址: ${url}`);
  } else {
    console.log('部署已提交。可在控制台查看域名：https://console.cloud.tencent.com/edgeone/pages');
  }
  console.log(
    '\n提示：绑定自定义域名请在 EdgeOne 控制台 → Pages 项目 → 域名管理 中添加；' +
      '国内加速节点要求域名已完成 ICP 备案。',
  );
};

main();
