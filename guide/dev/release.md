# Release 打包与发布流程

> 本文说明 Deepsight 预构建二进制发布包的设计、打包流程和推送到 GitHub 公开仓库 `xixiangzheng/Deepsight`
> GitHub Releases 的方式。用户安装说明见[安装 Deepsight](/guide/use/install)，官网与文档站边界见[官网与文档站维护](/guide/dev/site-maintenance)，Claude Code 接入见[Claude Code MCP 接入](/guide/dev/claude-code-mcp)。

---

## 一、发布模型

Deepsight 的用户发布目标是预构建 tarball：

```text
deepsight-linux-amd64-v0.2.0.tar.gz
deepsight-linux-amd64-v0.2.0.tar.gz.sha256
```

发布包包含同一 release 的配套组件：

- `deepsight-server`
- `deepsight-probe`
- `deepsight-mcp-stdio`
- `deepsight-init-client`
- `install.sh`
- 配置模板
- preset 配置
- Claude Code 客户端示例
- systemd unit 模板
- 包内 checksum
- 安装 README

Probe 和 Server 运行时分离，但 wire contract 来自同一 repo 的 `proto/`，所以发布时必须同版本配套。当前 TaskChannel 契约已经完成 lockstep breaking replacement，不支持旧 stream shape 混用，也不支持混合版本 Probe/Server。不要只发布裸二进制，否则用户还需要手写配置、systemd unit 和安装路径。

---

## 二、目录与脚本

当前 release 相关文件：

```text
VERSION

deploy/
  release/
    README.txt
  systemd/
    deepsight-server.service
    deepsight-probe.service

scripts/
  release/
    package.sh

Makefile
```

职责：

- `deploy/systemd/*.service`：发布包里的 systemd unit 模板。
- `deploy/release/install.sh`：一键部署运行时脚本，只服务 release 包根目录布局。
- `scripts/dev/install-from-build.sh`：源码仓库侧的开发者安装入口；将 `build/` staging 成
  release 风格目录后，再调用 `deploy/release/install.sh`。
- `deploy/release/README.txt`：发布包内的离线安装说明。
- `scripts/release/package.sh`：组装已构建的二进制和模板文件。
- `VERSION`：默认发布版本号，不带 `v` 前缀。
- `make package`：先构建，再调用打包脚本；默认读取 `VERSION` 并补 `v` 前缀。

当前只支持 `linux/amd64`。不要通过修改文件名来伪装其他平台；后续如需多架构，需要先补真实 cross-build 和 eBPF/CO-RE 验证。

---

## 三、打包产物结构

运行 `make package VERSION=v0.2.0` 后，生成：

```text
build/release/
  deepsight-linux-amd64-v0.2.0.tar.gz
  deepsight-linux-amd64-v0.2.0.tar.gz.sha256
  deepsight-linux-amd64-v0.2.0/
    bin/
      deepsight-server
      deepsight-probe
      deepsight-mcp-stdio
      deepsight-init-client
    install.sh
    configs/
      server.example.yaml
      probe.example.yaml
    presets/
      single-node-demo/
        server.yaml
        probe.yaml
      split-server/
        server.yaml
      split-probe/
        probe.yaml
    examples/
      claude-code/
        .mcp.json.example
    systemd/
      deepsight-server.service
      deepsight-probe.service
    README.txt
    checksums.txt
```

`checksums.txt` 是包内文件 checksum。`*.tar.gz.sha256` 是 GitHub Release 页面上用于校验 tarball 的 checksum。

`install.sh` 面向常见 systemd 常驻部署：默认安装二进制到 `/usr/local/bin`、配置到
`/etc/deepsight/`、状态目录到 `/var/lib/deepsight/`，并可通过 `--preset`
直接选择 `single-node-demo`、`split-server`、`split-probe` 等场景，
再通过参数覆盖 TCP 场景下的 gRPC/MCP 监听地址与是否自动启服。`single-node-demo`
固定使用 UDS `/run/deepsight/grpc.sock` 连接 `server` 与 `probe`。该脚本只认
release 包根目录布局，不直接理解源码仓库里的 `build/` / `deploy/` 结构。

当前权限模型：

- `--role server` / `--role all` 会自动创建 `deepsight` 系统用户/组，并让
  `deepsight-server.service` 以该非 root 账号运行。
- `--role probe` 仍按 root 路径部署 `deepsight-probe.service`，因为 Probe 真实运行需要
  eBPF 加载/attach 权限。

---

## 四、本地打包流程

从仓库根目录执行：

```bash
. scripts/dev/env.sh
make package
```

也可以显式覆盖版本：

```bash
. scripts/dev/env.sh
make package VERSION=v0.2.0
```

`make package` 会执行：

```text
make build
  -> make bpf
  -> make proto
  -> build/deepsight-probe
  -> build/deepsight-server
  -> build/deepsight-mcp-stdio
scripts/release/package.sh v0.2.0 linux amd64
```

单独调用脚本也可以，但它只打包已存在的二进制，不会构建：

```bash
scripts/release/package.sh v0.2.0 linux amd64
```

如果缺少 `build/deepsight-server` 或 `build/deepsight-probe`，脚本会失败并提示先运行 `make build`。

---

## 五、发布前检查

最低检查：

```bash
bash -n scripts/release/package.sh
. scripts/dev/env.sh
make test
make package VERSION=v0.2.0
cd build/release
sha256sum -c deepsight-linux-amd64-v0.2.0.tar.gz.sha256
cd ../..
```

解包检查：

```bash
mkdir -p /tmp/deepsight-release-check
tar -xzf build/release/deepsight-linux-amd64-v0.2.0.tar.gz -C /tmp/deepsight-release-check
cd /tmp/deepsight-release-check/deepsight-linux-amd64-v0.2.0
sha256sum -c checksums.txt
```

eBPF/Probe 真实加载验证仍需要 root 和目标内核环境。发布前如改动了 eBPF、Probe loader/executor/transformer/exporter 或配置/传输行为，应按[Probe 测试框架](/guide/dev/probe-test)补真实 Probe E2E 记录。

---

## 六、推送到 GitHub Releases

公开 artifact 由 GitHub 公开仓库 `xixiangzheng/Deepsight` 的 GitHub Releases 承载，网站仓库源码树只放文档站和下载链接，不提交二进制本体。

### 6.1 使用 gh CLI

前提：

- 本地已安装 `gh`。
- 已登录有权限发布 `xixiangzheng/Deepsight` release 的 GitHub 账号。
- `gh repo view xixiangzheng/Deepsight` 能正常返回仓库信息。
- 如 owner 发生变化，将命令中的 `xixiangzheng/Deepsight` 替换为实际 GitHub owner 和仓库名。

创建 release 并上传 artifact：

```bash
gh release create v0.2.0 \
  build/release/deepsight-linux-amd64-v0.2.0.tar.gz \
  build/release/deepsight-linux-amd64-v0.2.0.tar.gz.sha256 \
  --repo xixiangzheng/Deepsight \
  --title "Deepsight v0.2.0" \
  --notes-file /tmp/deepsight-v0.2.0-notes.md
```

如果 release 已存在，只上传 artifact：

```bash
gh release upload v0.2.0 \
  build/release/deepsight-linux-amd64-v0.2.0.tar.gz \
  build/release/deepsight-linux-amd64-v0.2.0.tar.gz.sha256 \
  --repo xixiangzheng/Deepsight \
  --clobber
```

不要把 `build/release/*.tar.gz` 复制进 GitHub 公开仓库的 `guide/`、`public/` 或其他网站源码目录。

### 6.2 手动网页发布

也可以在 GitHub 网页操作：

1. 打开 GitHub 公开仓库 `xixiangzheng/Deepsight`。
2. 进入 Releases。
3. Draft a new release。
4. Tag 填写 `v0.2.0`。
5. 上传：
   - `deepsight-linux-amd64-v0.2.0.tar.gz`
   - `deepsight-linux-amd64-v0.2.0.tar.gz.sha256`
6. 在 release notes 中说明系统要求、checksum、已知限制和安装文档链接。

---

## 七、CI 发布思路

如果后续由 CI 自动发布，建议边界如下：

```text
Private Deepsight source repo
  -> run tests
  -> make package VERSION=&lt;tag&gt;
  -> upload tarball + checksum to xixiangzheng/Deepsight GitHub Releases

xixiangzheng/Deepsight GitHub public repo
  -> GitHub Pages builds docs site
  -> Release page serves binary artifacts
```

CI 需要的 secret：

- GitHub token，最小权限应能对 GitHub 公开仓库 `xixiangzheng/Deepsight` 创建 release 和上传 artifact。
- 不应把 Deepsight 主源码、Go/eBPF/proto 实现源码复制到 GitHub 公开仓库。

CI 触发建议：

- 只在显式 tag，例如 `v0.2.0`，或手动 workflow dispatch 时发布。
- 普通分支 push 只跑测试和构建，不发布公开 artifact。

---

## 八、Release Notes 模板

```markdown
# Deepsight v0.2.0

## Artifacts

- deepsight-linux-amd64-v0.2.0.tar.gz
- deepsight-linux-amd64-v0.2.0.tar.gz.sha256

## System Requirements

- Linux kernel >= 5.x
- cgroup v2
- BTF: /sys/kernel/btf/vmlinux
- Probe requires root or equivalent eBPF capability

## Install

See the installation guide:
&lt;docs-url&gt;/guide/install

## Known Limitations

- TLS/mTLS is not implemented; tls.enabled must be false.
- The release tarball includes `deepsight-server`, `deepsight-probe`, and
  `deepsight-mcp-stdio`; the stdio adapter is intended for local IDE/developer
  MCP clients and bridges to the Server MCP Streamable HTTP endpoint.
- TaskChannel control plane, in-memory TaskState/ticket, internal query DTOs,
  MCP Streamable HTTP, Resources, Tools, Prompts, and stdio adapter are
  implemented for the current preview baseline.
- Task results and tickets remain volatile across Server restart.
- `completion/complete`, resource subscription, and `logging/setLevel` remain
  feature-disabled.
- Probe and Server must come from the same release; mixed TaskChannel stream
  shapes are not supported.
- Pod/Container attribution is best-effort.
```

---

## 九、维护纪律

- Release 包只引用 `build/` 里的构建产物，不从 `probe/`、`server/` 源码目录直接复制实现文件。
- `deploy/systemd/` 和 `deploy/release/` 是发布模板源，不写机器私有配置。
- 发布包内配置使用 `.example.yaml`，用户安装后再复制为真实运行配置。
- GitHub Releases 可以公开 artifact，但不能反向要求主源码公开。
- 私有或受控 artifact 不应放公开 GitHub Releases，应使用 private release、私有对象存储或带鉴权下载服务。
