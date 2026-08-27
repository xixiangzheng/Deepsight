# 官网与文档站维护

本文档说明 Deepsight 官网、文档站和公开二进制下载入口的维护边界。主开发仓库不通过 GitLab CI 发布网站；公开网站副本与 GitHub Releases 维护在 GitHub 公开仓库 `xixiangzheng/Deepsight` 中。

## 1. 仓库分工

```text
Deepsight/             # GitLab 主仓库
├── docs/              # 文档真源，包含内部文档与公开文档候选
├── probe/
├── server/
├── proto/
└── ...

Deepsight/             # GitHub 公开官网仓库，远端为 xixiangzheng/Deepsight
├── index.md           # 官网首页
├── guide/             # 从 Deepsight/docs 同步出的公开文档副本
├── public/assets/     # 从 Deepsight/docs/assets 同步出的公开图片副本
├── public/brand/      # 官网品牌资源
├── Releases           # GitHub Releases 承载公开二进制 artifact，不进入 Git 历史
├── scripts/           # 文档同步脚本
├── .vitepress/        # VitePress 配置与主题
└── .github/workflows/ # GitHub Pages 自动部署
```

- `Deepsight/docs/` 是唯一文档真源，日常文档修改只在这里进行。
- GitHub 公开仓库 `xixiangzheng/Deepsight` 的 `guide/` 是公开网站副本，由同步脚本生成后提交到 GitHub。
- GitHub 公开仓库 `xixiangzheng/Deepsight` 的 `public/assets/` 是公开图片副本，由同步脚本从 `docs/assets/` 生成后提交到 GitHub。
- GitHub 公开仓库 `xixiangzheng/Deepsight` 的 GitHub Releases 可用于发布 `deepsight-probe`、`deepsight-server`
  等预构建二进制 artifact、checksum 和版本说明；打包和上传流程见
  [Release 打包与发布流程](/guide/dev/release)。
- GitHub 公开仓库 `xixiangzheng/Deepsight` 不包含 Go 源码、eBPF 源码、私有配置或主仓库完整历史。

## 2. 公开边界

`Deepsight/docs/` 可以同时包含内部文档和公开文档。发布到官网前，必须由 GitHub 公开仓库 `xixiangzheng/Deepsight` 中的 `scripts/sync-docs.mjs` 控制同步范围，只同步允许公开的文档。

建议同步脚本采用 allowlist，而不是递归发布全部 `docs/`：

```js
const publicDocs = [
  ["01_deepsight.md", "guide/overview.md"],
  ["02_data-pipeline.md", "guide/data-pipeline.md"],
  ["03_RPC-contract.md", "guide/rpc-contract.md"],
  ["04_server-state.md", "guide/server-state.md"],
  ["05_MCP-integration.md", "guide/mcp-integration.md"],
  ["dev/quick-start.md", "guide/quick-start.md"],
  ["dev/setup.md", "guide/dev-setup.md"],
  ["dev/release.md", "guide/dev-release.md"],
  ["use/install.md", "guide/install.md"],
  ["use/config.md", "guide/config.md"]
];
```

如果某份文档包含内部实现细节、凭据、未公开路线图或学校内部信息，不应加入公开同步列表。

## 3. 本地同步与预览

本地建议保持两个仓库平级。因为主开发仓库和 GitHub 公开仓库都叫 `Deepsight`，本地公开仓库 checkout 可以命名为 `DeepsightPublic`，但它的 `origin` 仍应指向 `xixiangzheng/Deepsight`：

```text
/home/xixiangzheng/Github/
├── Deepsight/        # 主开发仓库
└── DeepsightPublic/  # GitHub 公开仓库 xixiangzheng/Deepsight 的本地目录
```

更新文档后，先在主仓库提交文档真源：

```bash
cd /home/xixiangzheng/Github/Deepsight
git add docs
git commit -m "docs: update deepsight docs"
git push origin main
```

然后在网站仓库同步公开副本并本地预览：

```bash
cd /home/xixiangzheng/Github/DeepsightPublic
git remote -v
DEEPSIGHT_DOCS_DIR=/home/xixiangzheng/Github/Deepsight/docs npm run docs:sync
npm run docs:build
npm run docs:dev
```

确认页面、导航、图片和链接都正常后，提交网站仓库：

```bash
git add guide public/assets index.md .vitepress public/brand scripts package.json package-lock.json
git commit -m "docs: sync Deepsight docs"
git push origin main
```

## 4. GitHub Pages 部署

GitHub 公开仓库 `xixiangzheng/Deepsight` 使用 GitHub Actions 构建并发布 GitHub Pages。GitHub Actions 只读取公开仓库内容，不访问学校 GitLab 仓库。

因此，`guide/` 和 `public/assets/` 在 GitHub 公开仓库 `xixiangzheng/Deepsight` 中需要纳入版本控制。它们虽然是从主开发仓库 `Deepsight/docs/` 生成的副本，但它们是 GitHub Actions 构建网站时可见的公开输入。

GitHub 公开仓库 `xixiangzheng/Deepsight` 中不应提交：

- `node_modules/`
- `.vitepress/cache/`
- `.vitepress/dist/`
- `deepsight-probe`、`deepsight-server` 等发布二进制
- 任何来自 Deepsight 主仓库的 Go、eBPF、proto 实现源码
- 未经筛选的内部文档

## 5. 二进制发布边界

GitHub 公开仓库 `xixiangzheng/Deepsight` 可以作为公开下载入口，但二进制不应提交到网站源码目录。
推荐使用 GitHub Releases 管理公开 artifact：

```text
Deepsight private source repo
  -> CI build deepsight-server / deepsight-probe
  -> publish artifacts + checksums to xixiangzheng/Deepsight GitHub Releases
  -> xixiangzheng/Deepsight guide links to the release download page
```

发布原则：

- Probe 和 Server 是同一 Deepsight release 的配套组件，推荐同版本下载和部署。
- Release artifact 可以公开下载，但不要求公开 Deepsight 主源码。
- 每个 release 应至少包含 `deepsight-linux-amd64-vX.Y.Z.tar.gz`、对应 `.sha256`
  checksum 和版本说明。
- 如果 artifact 只面向受控用户，不应使用公开 GitHub Releases；改用 private release、
  私有对象存储或带鉴权的下载服务。
- GitHub 公开仓库 `xixiangzheng/Deepsight` 的 `guide/` 只放安装说明和下载链接，不存放二进制本体。

## 6. 自定义域名

自定义域名在 GitHub 公开仓库 `xixiangzheng/Deepsight` 的 Pages 设置中维护。Cloudflare 只负责 DNS 解析。

推荐使用子域名，例如：

```text
docs.example.com
```

Cloudflare DNS 建议先配置为：

```text
Type: CNAME
Name: docs
Target: &lt;github-user&gt;.github.io
Proxy status: DNS only
```

当前站点未使用自定义域名，直接使用 GitHub Pages 默认地址 `https://xixiangzheng.github.io/Deepsight/`，仓库根目录不保留 `CNAME` 文件。如未来启用自定义域名，需重新添加 `CNAME` 并同步调整构建时的 `SITE_BASE`。

## 7. 维护纪律

- 主仓库 `Deepsight` 不放 `site/`、`.gitlab-ci.yml` 或网站部署脚本。
- 文档真源只维护 `Deepsight/docs/`。
- 公开网站副本只维护在 GitHub 公开仓库 `xixiangzheng/Deepsight` 的 `guide/` 和 `public/assets/`。
- 公开二进制只通过 GitHub Releases 或外部 artifact 服务发布，不提交进网站源码树。
- 同步脚本必须显式控制公开范围，避免把内部文档发布到 GitHub。
- 网站样式、首页、导航和品牌资源只在 GitHub 公开仓库 `xixiangzheng/Deepsight` 中维护。
