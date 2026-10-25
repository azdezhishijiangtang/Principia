#!/usr/bin/env node
/**
 * Principia 一键部署脚本（GitHub Pages，legacy /docs 模式）
 *
 * 用法：
 *   GITHUB_TOKEN=ghp_xxx node scripts/deploy.mjs [commit message]
 *
 * 流程：
 *   1. 以 base=/Principia/ 构建生产包到 dist/（GitHub Pages 项目站路径）
 *   2. 通过 Git Database API 推送：
 *      frontend/ 源码（不含 node_modules/dist/docs）→ 仓库 frontend/
 *      dist/ 构建产物                          → 仓库 docs/
 *      .gitignore                              → 仓库根目录
 *      - 先建 blob，再分块建内层树（内层路径不带顶层前缀），根目录只挂一次 frontend/docs
 *      - 规避 frontend/frontend、docs/docs 双重嵌套问题
 *   3. 推送成功后以默认 base 重建 dist/，供本地预览服务器使用
 *
 * 安全：Token 只从环境变量读取，绝不写入仓库或任何文件。
 */
import { execSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND = join(__dirname, '..');
const DIST = join(FRONTEND, 'dist');
const REPO_ROOT = join(FRONTEND, '..');
const GITIGNORE = join(REPO_ROOT, '.gitignore');

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'azdezhishijiangtang/Principia';
const API = 'https://api.github.com';
const MESSAGE = process.argv[2] || 'deploy: update site';
const DRY_RUN = process.argv.includes('--dry-run');

if (!TOKEN && !DRY_RUN) {
  console.error('请先设置环境变量 GITHUB_TOKEN（fine-grained PAT，需 Contents 写权限）');
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      const res = await fetch(url, {
        method,
        headers: HEADERS,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 200 || res.status === 201 || res.status === 204) {
        return res.json();
      }
      const text = await res.text();
      console.error(`  [retry ${attempt + 1}] HTTP ${res.status}: ${text.slice(0, 200)}`);
    } catch (e) {
      console.error(`  [retry ${attempt + 1}] ${String(e).slice(0, 150)}`);
    }
    await sleep(4000 * (attempt + 1));
  }
  throw new Error(`请求失败: ${method} ${url}`);
}

/** 递归收集文件：{ rel, abs, tree }（tree = 在仓库中归属的顶层目录） */
async function walk(dir, relBase, tree, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    // frontend/ 下的 dist 与 docs 不重复推送（docs 由 dist 单独组装）
    if (tree === 'frontend' && relBase === '' && (e.name === 'dist' || e.name === 'docs')) continue;
    const abs = join(dir, e.name);
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(abs, rel, tree, out);
    else out.push({ rel, abs, tree });
  }
}

async function createBlob(absPath) {
  const data = await readFile(absPath);
  const r = await api('POST', `/repos/${REPO}/git/blobs`, {
    content: data.toString('base64'),
    encoding: 'base64',
  });
  return r.sha;
}

async function tryTree(items) {
  try {
    const res = await fetch(`${API}/repos/${REPO}/git/trees`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ tree: items }),
    });
    if (res.status === 201) return (await res.json()).sha;
  } catch {
    /* 走分块 */
  }
  return null;
}

/** 分块建树：单次超限时按 80 个一组递归拆分 */
async function buildTree(items) {
  const direct = await tryTree(items);
  if (direct) return direct;
  const chunks = [];
  for (let i = 0; i < items.length; i += 80) chunks.push(items.slice(i, i + 80));
  const merged = [];
  for (let i = 0; i < chunks.length; i += 1) {
    merged.push({
      path: `__chunk_${String(i).padStart(3, '0')}`,
      mode: '040000',
      type: 'tree',
      sha: await buildTree(chunks[i]),
    });
  }
  return buildTree(merged);
}

/** 把 { rel, sha } 列表组装成嵌套树（内层路径不带顶层前缀） */
async function treeFromEntries(entries) {
  const files = new Map();
  const dirs = new Map();
  for (const [rel, sha] of entries) {
    const slash = rel.indexOf('/');
    if (slash === -1) files.set(rel, sha);
    else {
      const head = rel.slice(0, slash);
      if (!dirs.has(head)) dirs.set(head, []);
      dirs.get(head).push([rel.slice(slash + 1), sha]);
    }
  }
  const items = [...files].map(([p, sha]) => ({ path: p, mode: '100644', type: 'blob', sha }));
  for (const [d, sub] of dirs) {
    items.push({ path: d, mode: '040000', type: 'tree', sha: await treeFromEntries(sub) });
  }
  return buildTree(items);
}

const main = async () => {
  console.log('── 1/3 构建 GitHub Pages 包（base=/Principia/）──');
  if (DRY_RUN) {
    console.log('（dry-run：跳过构建，使用当前 dist/）');
  } else {
    execSync('npx vite build --base=/Principia/', { cwd: FRONTEND, stdio: 'inherit' });
  }

  console.log('── 2/3 收集并推送文件 ──');
  const files = [];
  await walk(FRONTEND, '', 'frontend', files);
  await walk(DIST, '', 'docs', files);
  files.push({ rel: '.gitignore', abs: GITIGNORE, tree: 'root' });
  console.log(`待推送: frontend ${files.filter((f) => f.tree === 'frontend').length} 个源码 + docs ${files.filter((f) => f.tree === 'docs').length} 个产物 + .gitignore`);

  if (DRY_RUN) {
    const fe = files.filter((f) => f.tree === 'frontend');
    const dc = files.filter((f) => f.tree === 'docs');
    console.log('frontend 顶层目录:', [...new Set(fe.map((f) => f.rel.split('/')[0]))].sort().join(', '));
    console.log('docs 顶层目录:', [...new Set(dc.map((f) => f.rel.split('/')[0]))].sort().join(', '));
    console.log('dry-run 完成，未推送。');
    return;
  }
  const ref = await api('GET', `/repos/${REPO}/git/ref/heads/main`);
  const head = ref.object.sha;
  const commit = await api('GET', `/repos/${REPO}/git/commits/${head}`);
  const rootTree = await api('GET', `/repos/${REPO}/git/trees/${commit.tree.sha}`);
  console.log('当前仓库根目录:', rootTree.tree.map((e) => e.path).join(', '));

  // 并发建 blob
  const blobs = new Map();
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const f = files[cursor++];
      blobs.set(`${f.tree}\u0000${f.rel}`, await createBlob(f.abs));
      done += 1;
      if (done % 100 === 0) console.log(`  blobs: ${done}/${files.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const entriesOf = (tree) =>
    [...blobs.entries()].filter(([k]) => k.startsWith(`${tree}\u0000`)).map(([k, sha]) => [k.slice(tree.length + 1), sha]);

  const frontendTree = await treeFromEntries(entriesOf('frontend'));
  const docsTree = await treeFromEntries(entriesOf('docs'));

  const newRoot = [
    { path: '.gitignore', mode: '100644', type: 'blob', sha: blobs.get('root\u0000.gitignore') },
    { path: 'frontend', mode: '040000', type: 'tree', sha: frontendTree },
    { path: 'docs', mode: '040000', type: 'tree', sha: docsTree },
  ];
  const rootSha = await buildTree(newRoot);

  const newCommit = await api('POST', `/repos/${REPO}/git/commits`, {
    message: MESSAGE,
    tree: rootSha,
    parents: [head],
  });
  await api('PATCH', `/repos/${REPO}/git/refs/heads/main`, { sha: newCommit.sha });
  console.log('DEPLOY_OK', newCommit.sha);
  console.log('线上地址: https://azdezhishijiangtang.github.io/Principia/');

  console.log('── 3/3 重建本地预览包（默认 base）──');
  execSync('npx vite build', { cwd: FRONTEND, stdio: 'inherit' });
  console.log('完成。');
};

main().catch((e) => {
  console.error('部署失败:', e.message ?? e);
  process.exit(1);
});
