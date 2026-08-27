import { defineConfig } from "vitepress";

const base = process.env.SITE_BASE || "/";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default defineConfig({
  lang: "zh-CN",
  title: "Deepsight",
  description: "基于 eBPF 与 MCP 的 AI 原生可观测性底座",
  base,
  vite: {
    build: {
      chunkSizeWarningLimit: 700
    }
  },
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ["link", { rel: "icon", href: `${base}brand/favicon.svg` }],
    ["meta", { name: "theme-color", content: "#0b1220" }]
  ],
  appearance: true,
  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence;

      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const language = token.info.trim().split(/\s+/u)[0];

        if (language === "mermaid") {
          const encoded = encodeURIComponent(token.content);
          return `<div class="vp-mermaid" data-mermaid="${escapeHtml(encoded)}"></div>`;
        }

        return defaultFence
          ? defaultFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options);
      };
    }
  },
  themeConfig: {
    logo: `${base}brand/logo.svg`,
    siteTitle: "Deepsight",
    nav: [
      { text: "首页", link: "/" },
      { text: "快速开始", link: "/guide/use/install", activeMatch: "^/guide/use/" },
      {
        text: "文档",
        link: "/guide/overview",
        activeMatch: "^/guide/(overview|agent-guide|architecture|dev|modules|server)(/|$)"
      }
    ],
    sidebar: {
      "/guide/": [
        {
          text: "概览",
          collapsed: false,
          items: [
            { text: "项目概览", link: "/guide/overview" },
            { text: "架构总览", link: "/guide/architecture/data-pipeline" },
            { text: "RPC 契约", link: "/guide/architecture/rpc-contract" },
            { text: "服务端状态", link: "/guide/architecture/server-state" },
            { text: "MCP 集成", link: "/guide/architecture/mcp-integration" }
          ]
        },
        {
          text: "用户指南",
          collapsed: true,
          items: [
            {
              text: "安装与部署",
              collapsed: false,
              items: [
                { text: "安装说明", link: "/guide/use/install" },
                { text: "LLM 快速接入", link: "/guide/use/llm-quick-start" },
                { text: "单机完整演示", link: "/guide/use/single-node-demo" },
                { text: "分布式部署", link: "/guide/use/distributed-deploy" },
                { text: "手工运行与调试", link: "/guide/use/manual-run" }
              ]
            },
            {
              text: "运行配置",
              collapsed: true,
              items: [
                { text: "用户配置", link: "/guide/use/config" }
              ]
            }
          ]
        },
        {
          text: "开发指南",
          collapsed: true,
          items: [
            {
              text: "环境与接入",
              collapsed: false,
              items: [
                { text: "快速开始", link: "/guide/dev/quick-start" },
                { text: "开发环境", link: "/guide/dev/setup" },
                { text: "配置系统", link: "/guide/dev/config" },
                { text: "源码构建安装", link: "/guide/dev/install-from-source" },
                { text: "Claude Code MCP 接入", link: "/guide/dev/claude-code-mcp" }
              ]
            },
            {
              text: "开发专题",
              collapsed: true,
              items: [
                { text: "Hello-Arch 架构", link: "/guide/dev/hello-arch" },
                { text: "Probe API 接入", link: "/guide/dev/probe-api" },
                { text: "Release 发布流程", link: "/guide/dev/release" }
              ]
            },
            {
              text: "测试与维护",
              collapsed: true,
              items: [
                { text: "Probe 测试框架", link: "/guide/dev/probe-test" },
                { text: "Server 测试框架", link: "/guide/dev/server-test" },
                { text: "Agent 开发指南", link: "/guide/agent-guide" },
                { text: "站点维护", link: "/guide/dev/site-maintenance" }
              ]
            },
            {
              text: "协议与契约",
              collapsed: true,
              items: [
                { text: "设计总览", link: "/guide/dev/proto/proto" },
                { text: "Telemetry 总线", link: "/guide/dev/proto/telemetry-bus" },
                { text: "模块 Payload", link: "/guide/dev/proto/module-payloads" },
                { text: "兼容性规则", link: "/guide/dev/proto/compatibility" }
              ]
            }
          ]
        },
        {
          text: "架构设计",
          collapsed: true,
          items: [
            {
              text: "服务端架构",
              collapsed: false,
              items: [
                { text: "工程设计", link: "/guide/architecture/engineering-arch" },
                { text: "Server 总览", link: "/guide/server/server" },
                { text: "gRPC 接入层", link: "/guide/server/grpc" },
                { text: "记忆机制", link: "/guide/server/memory" },
                { text: "MCP Layer", link: "/guide/server/mcp" }
              ]
            },
            {
              text: "模块架构",
              collapsed: true,
              items: [
                {
                  text: "网络模块",
                  collapsed: true,
                  items: [
                    { text: "模块设计", link: "/guide/modules/network" },
                    { text: "Probe 设计", link: "/guide/modules/network-probe" },
                    { text: "gRPC 接入", link: "/guide/modules/network-grpc" }
                  ]
                },
                {
                  text: "进程模块",
                  collapsed: true,
                  items: [
                    { text: "模块设计", link: "/guide/modules/process" },
                    { text: "Probe 设计", link: "/guide/modules/process-probe" },
                    { text: "gRPC 接入", link: "/guide/modules/process-grpc" }
                  ]
                },
                {
                  text: "存储模块",
                  collapsed: true,
                  items: [
                    { text: "模块设计", link: "/guide/modules/storage" },
                    { text: "Probe 设计", link: "/guide/modules/storage-probe" },
                    { text: "gRPC 接入", link: "/guide/modules/storage-grpc" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/xixiangzheng/Deepsight", ariaLabel: "GitHub" }
    ],
    search: {
      provider: "local"
    },
    aside: true,
    outline: {
      level: [2, 3],
      label: "本页目录"
    },
    footer: {
      message: "Apache 2.0 Licensed",
      copyright: "Copyright © Deepsight"
    }
  }
});
