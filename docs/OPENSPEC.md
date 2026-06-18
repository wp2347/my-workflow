# My Workflow — OpenSpec

## 概述

AI 工作流平台，允许用户通过可视化拖拽方式搭建 AI 工作流。支持 LLM 调用、HTTP 请求、飞书集成、定时任务、知识库搜索等。

**技术栈**: Next.js 16 (App Router) · React Flow (XYFlow) · Zustand · shadcn/ui · Prisma + PostgreSQL · BullMQ + Redis · Vercel AI SDK

---

## 架构层次

```
┌──────────────────────────────────────────────────────────────┐
│                      入口层 (Entry)                          │
│  layout.tsx → scheduler-init + cron-init (自动启动)           │
│  cron-worker-start.ts → 独立 Worker 进程                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                      API 层 (13 endpoints)                   │
│  /api/workflow/*        CRUD + Run                          │
│  /api/workflow/cron     定时任务管理                          │
│  /api/workflow/executions 执行历史                            │
│  /api/webhook/[id]      Webhook 触发器                       │
│  /api/feishu/callback   飞书事件回调                          │
│  /api/documents/*       知识库文档                            │
│  /api/credentials/*     凭证管理                              │
│  /api/rag/search        RAG 检索                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    引擎层 (Engine)                            │
│  executor.ts            DAG 拓扑排序 + 带重试的顺序执行        │
│  nodes/input.ts         输入节点                               │
│  nodes/llm.ts           LLM 节点 (9 providers + RAG + Tools)  │
│  nodes/output.ts        输出节点                               │
│  nodes/http.ts          HTTP 节点 (认证 + 变量解析)            │
│  nodes/condition.ts     条件分支 (13 operators)               │
│  nodes/feishu.ts        飞书连接器 (双向)                       │
│  nodes/merge.ts         汇聚节点 (4 strategies)                │
│  nodes/cron_trigger.ts  定时触发器                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    工具层 (Lib)                               │
│  prisma.ts · redis.ts · providers.ts · expression.ts         │
│  crypto.ts · embedding.ts · chunker.ts · feishu-callback.ts  │
│  scheduler.ts · cron-worker.ts · cron-init.ts                │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    状态层 (Stores)                            │
│  workflow.ts · chat.ts · locale.ts                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                    视图层 (Components)                        │
│  canvas/ · panels/ · nodes/ · chat/ · ui/                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 模块职责

### 1. 类型系统 (`src/types/workflow.ts`)
定义所有节点的数据结构。`NodeType` 联合类型是全局核心，8 种节点类型统一通过 `WorkflowNode` 携带。

### 2. 执行引擎 (`src/engine/`)
- **executor.ts**: 工作流执行入口。对节点 DAG 进行拓扑排序，按序执行，支持指数退避重试和条件分支。
- **8 个节点执行器**: 各自实现 `NodeExecutor` 接口，独立完成节点逻辑。

### 3. 状态管理 (`src/stores/`)
- **workflow.ts**: 画布状态（节点、连线、选中），导出给所有 Canvas 组件。
- **chat.ts**: 聊天调试面板状态。
- **locale.ts**: 语言切换 (zh/en)，持久化到 localStorage。

### 4. 工具库 (`src/lib/`)
| 模块 | 职责 |
|------|------|
| `prisma.ts` | 数据库客户端单例 |
| `redis.ts` | Redis 客户端 (BullMQ) |
| `providers.ts` | 9 家 AI 厂商 + 30+ 模型注册表 |
| `expression.ts` | `{{ $node.id.field }}` 变量解析引擎 |
| `crypto.ts` | AES-256-GCM 凭证加密 |
| `embedding.ts` | OpenAI text-embedding-3-small |
| `chunker.ts` | 文本分块 (智能段落/句号断点) |
| `scheduler.ts` | 简单调度器 (HH:MM + cron 表达式) |
| `cron-worker.ts` | BullMQ 分布式定时 Worker |
| `cron-init.ts` | 启动恢复 + CRUD 同步 |

### 5. API 路由 (`src/app/api/`)
13 个 API 端点，覆盖工作流 CRUD、执行、定时管理、飞书回调、知识库、凭证、RAG 搜索。

### 6. 页面和组件
- **dashboard** 路由组: 首页、工作流列表、编辑器、执行历史、知识库、凭证管理
- **独立页面**: 聊天测试、Web Widget 嵌入
- **画布组件**: React Flow 画布 + 节点面板 + 配置面板
- **8 个节点 UI**: Input / LLM / Output / HTTP / Condition / Merge / Feishu / Cron Trigger
- **13 个 shadcn/ui 组件**: 基础 UI 组件库

---

## 数据流

```
用户拖拽节点 → Canvas(onDrop) → store.addNode() → React Flow 渲染
     ↓
配置节点 → NodeConfigPanel → store.updateNodeData()
     ↓
保存 → Toolbar(handleSave) → PUT /api/workflow → Prisma
     ↓
执行 → POST /api/workflow/run → executor.executeWorkflow()
     ↓
结果 → Execution 记录 → 执行历史页
```

---

## 定时任务流

```
用户配 Cron → 保存 → /api/workflow → auto-register WorkflowCronJob
     ↓
cron-worker-start.ts → initCronSystem() → registerCronJob()
     ↓
BullMQ Worker → 到点触发 → executeWorkflow() → 推送飞书
```

## 飞书消息流

```
用户发消息 → 飞书回调 → /api/feishu/callback
     ↓
查询所有 enabled + 含 receive 节点的工作流
     ↓
executeWorkflow({ message, chatId, ... }) → LLM → 飞书 send
```

---

## 节点类型

| 节点 | 输入 | 输出 | 核心功能 |
|------|------|------|---------|
| Input | - | source | 定义输入 schema |
| LLM | target | source | 9 providers, RAG, 记忆, JSON, FC |
| Output | target | - | 格式化输出 |
| HTTP | target | source | REST API + 认证 |
| Condition | target | true/false | IF/ELSE 13 种比较 |
| Merge | target | source | 多分支汇聚 |
| Feishu | target | source | 飞书收发双向 |
| Cron Trigger | - | source | 定时启动工作流 |

---

## 国际化

124 个翻译键，zh.json + en.json，通过 `useTranslation()` hook 访问。语言选择持久化到 localStorage。
