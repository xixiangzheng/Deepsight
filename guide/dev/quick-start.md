# 一键部署

> 配置详情请参考[开发环境配置](/guide/dev/setup)
> 配置系统分层与运行时覆盖规则请参考[配置系统设计](/guide/dev/config)
> Protobuf 契约与模块扩展规则请参考[Protobuf 契约设计](/guide/dev/proto/proto)
> Claude Code + Deepsight MCP 接入见[Claude Code MCP 接入](/guide/dev/claude-code-mcp)

**注意**：eBPF 开发**必须**在 Linux 环境下进行（当前验证版本为Linux 6.12.74+deb13+1-amd64），Mac/Windows 用户请使用虚拟机或 WSL2。

验证内核支持：

```bash
# expected not empty
ls -la /sys/kernel/btf/vmlinux
```

## 快速开始 (推荐)

对于新成员加入或在全新机器上进行二次开发，强烈推荐使用我们提供的自动化配置脚本，这涵盖了代码库克隆、依赖管理及开发环境的极速拉起。

### 1. 代码克隆

由于项目中以 Git Submodule 形式引入了 `libbpf`，必须确保子模块也被完整拉取：

```bash
git clone --recursive https://github.com/xixiangzheng/Deepsight.git
cd deepsight
```

> [!NOTE]
> 如果已经使用了普通克隆 (`git clone https://...`)，请进入项目目录后补充执行以下命令以同步子模块：
>
> ```bash
> git submodule update --init --recursive
> ```

### 2. 自动化环境配置

`scripts/setup/` 目录下提供了环境配置脚本，拆分为系统级和项目级以实现环境隔离：

- 系统级初始化 (`scripts/setup/init.sh`)：
  1. 操作系统和内核环境前置校验（检查 Ubuntu 版本及 BTF 支持）
  2. 一键安装所需的 APT C 基础环境包（`clang`, `llvm`, `build-essential` 等）
  3. 一键编译并安装全特性版 `bpftool`
  4. 自动检测并下载配置 Go 本体（当前锁定 `1.26.2` 版本）

- 项目级初始化 (`scripts/setup/setup.sh`)：
  1. 自动同步和更新项目所需的 Git Submodule（如 `libbpf`）
  2. 执行 Go 环境依赖整理 (`go mod tidy`)，拉取项目插件
  3. 自动生成核心文件（如提取 `vmlinux.h` 头文件）
  4. 动态生成基于当前 `$PWD` 的 `.clangd` 配置
  5. 自动配置 Git Pre-commit Hook 拦截不规范代码提交

通过**依次**运行这两个脚本，即可完成所有配置：

```bash
# 1. 初始化系统依赖 (需要 sudo 权限)
./scripts/setup/init.sh

# 2. 如果是脚本新安装的 Go，请确保其二进制路径在环境变量中生效后再进行下一步：
# export PATH=$PATH:/usr/local/go/bin

# 3. 初始化项目内部配置
./scripts/setup/setup.sh
```

## 依赖管理策略

为了确保不同开发者在不同机器上能够获得一致的编译和开发体验，我们采取了如下版本控制策略：

- **C 基础组件**：如 Clang、LLVM 和 bpftool 等属于系统级依赖，无法直接随代码库分发，主要通过本文档规范所需版本，并统一交由 `init.sh` 脚本自动安装（包含 `protoc v34.1`）。
- **Go 插件和依赖**：利用 `go.mod` 和 `go.sum` 文件天然记录和锁定依赖及工具版本。开发团队只需将这两个文件提交到 Git，其他人拉取代码后运行 `go mod tidy` 即可恢复统一版本。
  - **依赖锚点**：项目中引入了 `internal/deps/anchor.go`（使用 `//go:build tools` 标签），强行锁定底层外部运行时（如 `ebpf`, `grpc`），防止其在代码未生成时被 `go mod tidy` 误删。
  - **契约显式追踪**：尽管底层 eBPF 绑定代码 (`*_bpfel.go`) 不被追踪，但 gRPC/Protobuf 生成的契约代码（`api/` 目录）被明确纳入 Git 追踪，旨在确保裸机克隆后 `go mod tidy` 能够顺利找到本地依赖包并正确解析内部模块引用。
- **libbpf (C底层库)**：Git submodule 会将拉取的第三方库锁定在特定 Git Commit Hash 上，天然具备版本一致性保障。
  - **锁定**：本地将其 `checkout` 到特定的 release tag 后，在主项目中 `git commit 3rd/libbpf` (注意末尾不带斜杠，否则Git会把里面发生修改的具体文件添加到缓存区，造成不可预测的索引错误)。
  - **升级**：`checkout` 到新标签后，主项目提交 `git commit` 即可；其他成员只需执行 `git submodule update` 即可同步。
- **本地工程门禁 (Git Hooks)**：项目在 `setup.sh` 中将本地 Git 钩子路径劫持至 `.githooks/`，强制实施防御性提交策略：
  - **契约防篡改**：提交前自动触发 `make proto`，强制覆盖任何对 `api/v1` 目录下生成的 Go 契约的非法手动修改，确保契约与 `.proto` 定义 100% 同步。
  - **规范对齐**：强制挂载 `make fmt` (解决 eBPF 代码格式化的包含顺序限制) 与 `make lint`，将潜在的构建异常拦截在开发者本地。

## Makefile管理

项目采用 `Makefile` 驱动，核心目标遵循 **“代码生成 -> 编译构建 -> 质量守卫”** 的分层逻辑：

| 指令         | 职责                                       | 依赖关系                            |
| :----------- | :----------------------------------------- | :---------------------------------- |
| `make proto` | 生成 gRPC/Protobuf 契约代码 (Go)           | 自举编译项目局部 `protoc` 插件      |
| `make bpf`   | 驱动 `bpf2go` 编译内核态 C 为 Go 绑定      | 强依赖 Clang/LLVM 环境              |
| `make build` | **一键编译** 生成 `probe` 和 `server`      | 隐式触发 `make proto` 和 `make bpf` |
| `make fmt`   | 全局格式化 Go 源码与内核态 C 代码          | 保护 `vmlinux.h` 包含顺序           |
| `make lint`  | 静态代码分析与逻辑漏洞校验                 | 提交代码前必运行                    |
| `make clean` | 深度清理所有构建产物与生成的临时代码       | 包含 `api/*` 与 BPF 绑定代码        |
| `make all`   | **全链路扫描** (Fmt + Lint + Test + Build) | CI/CD 与发版前的终极校验            |

---

## 闭环验证与测试

普通用户态逻辑验证通过 `make` 和 Go test 完成：

```bash
. scripts/dev/env.sh
make test
make build
```

涉及 proto 契约时，还需要运行：

```bash
. scripts/dev/env.sh
make proto
```

真实 Probe E2E 不再由 `scripts/` 下的触发或验证脚本承载。Probe E2E 的触发、
编排和断言统一放在 `tests/probe-e2e/`，具体分层、目录和人工 root 执行方式见
[Probe 测试框架](/guide/dev/probe-test)。

当前约定：

- fake/mock 测试只能报告 Unit / In-Process 行为通过。
- real Probe E2E 必须启动真实 `deepsight-probe --config &lt;probe.yaml&gt;` 子进程。
- 真实 eBPF 或网络刺激必须由 Go E2E harness 编排，并在测试二进制内部完成
  protobuf 强类型断言。
- 人类以 root 权限运行已编译的 E2E binary，并把 stdout/stderr 写入固定
  `/tmp/deepsight-probe-e2e-&lt;module&gt;.log`，供 Agent 读取。
