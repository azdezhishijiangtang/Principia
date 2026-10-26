# 部署到腾讯 EdgeOne Pages（推荐主站）

GitHub Pages 作为主站有两个先天限制，这也是「打不开 / 很卡 / 404」的根因：

| 问题 | 现象 | EdgeOne Pages 的解决方式 |
| --- | --- | --- |
| 国内网络可达性差 | 打开慢、偶发 502/超时 | 腾讯云国内边缘节点分发，多线可用 |
| 项目站子路径 | 资源挂在 `/Principia/`，少一个斜杠就 404 | 部署在根路径 `/` |
| 没有 SPA 回源 | 刷新 `/problems` 等深链接直接 404 | `edgeone.json` 配置回源到 `index.html` |

---

## 一、一次性准备

1. 登录 EdgeOne 控制台：<https://console.cloud.tencent.com/edgeone/pages>
2. 新建一个 **Pages / Makers 项目**，类型选 **直接上传（Direct Upload）**
   - 如果选的是 Git 关联类型，CLI 无法直接上传，请改用下面「方式 B」。
3. 在控制台 **API Token** 页面生成令牌，保存好（只显示一次）。

---

## 二、部署

### 方式 A：命令行（推荐）

```bash
cd frontend

# 首次：填入控制台生成的 API Token
export EDGEONE_API_TOKEN=你的令牌

# 一键构建 + 部署
npm run deploy:edgeone
```

常用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `EDGEONE_API_TOKEN` | 无 | 控制台生成的令牌（也接受 `EDGEONE_TOKEN`） |
| `EDGEONE_PROJECT` | `principia` | EdgeOne 项目名，不存在会自动创建 |
| `EDGEONE_ENV` | `production` | `production` 或 `preview` |
| `EDGEONE_AREA` | `global` | `global` / `overseas`，仅首次创建项目时生效 |

其他参数：

```bash
node scripts/deploy-edgeone.mjs --skip-build   # 复用已有 dist/
node scripts/deploy-edgeone.mjs --dry-run      # 只打印将要执行的命令
```

### 方式 B：控制台关联 Git（无需令牌，零本地操作）

1. 新建项目时选择关联本仓库 `azdezhishijiangtang/Principia`
2. 根目录填 `frontend`
3. 构建命令 `npm run build`，输出目录 `dist`
4. 之后每次 push 自动构建部署

`frontend/edgeone.json` 已写好这些配置，平台会自动识别。

### 方式 C：匿名部署（不登录、先看效果）

```bash
cd frontend
node scripts/deploy-edgeone.mjs --anonymous
```

会返回一个临时域名，**1 小时内需在控制台认领**，否则项目被删除。脚本会一并打印认领地址，例如：

```bash
edgeone makers claim --sid <sid>
```

> ⚠️ 匿名部署**每执行一次都会新建一个项目**（域名里的随机串会变），旧的临时项目 1 小时后自动回收。
> 因此它只适合「先看看效果」。要让站点长期稳定在线，请务必走方式 A 或方式 B。

---

## 三、自动部署（GitHub Actions）

本仓库已包含 `.github/workflows/deploy-edgeone.yml`。

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中添加：

- `EDGEONE_API_TOKEN`：控制台令牌（必填）

可选：在 **Variables** 中添加 `EDGEONE_PROJECT` 覆盖项目名。

配置后，只要 `frontend/` 下有改动推送到 `main`，就会自动构建并部署；也可以在 Actions 页面手动触发。
未配置 token 时流水线会自动跳过（不会报红叉）。

---

## 四、绑定自己的域名

EdgeOne 控制台 → 你的 Pages 项目 → **域名管理** → 添加域名，然后把 DNS 的 CNAME 指向控制台给出的目标。

> 使用腾讯云**中国大陆**加速节点时，域名必须已完成 ICP 备案；未备案可选择海外（`overseas`）加速区域。

---

## 五、常见问题

**页面白屏、控制台一堆 404（`/assets/...` 找不到）**
构建时用了 `--base=/Principia/`（GitHub Pages 的子路径）。EdgeOne 部署必须是根路径，`deploy-edgeone.mjs` 已固定使用默认 `base=/`。

**刷新深链接还是 404**
确认 `edgeone.json` 已随产物上传（脚本会自动写入 `dist/edgeone.json`），内容应包含：

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

注意：上传到 EdgeOne 的那份**只保留 `rewrites`**，不能带 `buildCommand`，否则平台会再构建一次并失败（`Func build failed`）。

**部署报 `Func build failed`**
通常就是上面这条：`dist/edgeone.json` 里混入了构建命令。删掉后重新部署。

**两个站要不要都保留？**
可以。`npm run deploy` 仍发布 GitHub Pages（`/Principia/` 子路径，产物推到 `docs/`）；`npm run deploy:edgeone` 发布 EdgeOne（根路径）。互不影响。
