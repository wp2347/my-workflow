# My Workflow — CodeGraph

## 模块依赖图

```
                    ┌───────────────────┐
                    │   types/workflow  │ ← 零依赖，全局类型
                    └──────┬────────────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  stores/   │  │  engine/   │  │   lib/     │
    │ workflow   │  │ executor   │  │ expression │
    │ chat       │  │ nodes/*    │  │ providers  │
    │ locale     │  │            │  │ prisma     │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
          │               │               │
          ▼               ▼               ▼
    ┌──────────────────────────────────────────┐
    │              components/                  │
    │  canvas/  panels/  nodes/  chat/  ui/    │
    └──────────────────┬───────────────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────────┐
    │                app/                      │
    │  layout  pages  api/  chat/  widget/     │
    └──────────────────────────────────────────┘
```

## 文件调用链

### 工作流编辑 → 保存
```
workflow/[id]/page.tsx
  → Toolbar.tsx
    → handleSave()
      → PUT /api/workflow/[id]
        → prisma.workflow.update()
        → syncCronJob()          [cron-init.ts]
```

### 工作流执行
```
/api/workflow/run
  → prisma.workflow.findUnique()
  → executeWorkflow()           [engine/executor.ts]
    → topologicalSort()
    → executeNodeWithRetry()    // per node
      → nodeExecutors[type]()   [engine/nodes/*.ts]
        → resolveExpression()   [lib/expression.ts]  // HTTP/Feishu
        → generateText()        [ai SDK]              // LLM
        → fetch(wttr.in)                                // Weather tool
    → prisma.execution.create()                       // save logs
```

### 飞书消息接收 → 回复
```
/api/feishu/callback
  → prisma.workflow.findMany({ enabled: true, nodes: { type: feishu } })
  → executeWorkflow(workflow, { message, chatId, ... })
    → feishu.receive → llm → feishu.send
```

### 定时任务
```
cron-worker-start.ts           [启动]
  → initCronSystem()           [cron-init.ts]
    → prisma.workflowCronJob.findMany({ enabled: true })
    → registerCronJob()        [cron-worker.ts]
      → queue.add(jobId, data, { repeat: { pattern, tz } })
  → startCronWorker()          [cron-worker.ts]
    → new Worker(queue, async (job) => {
        executeWorkflow(workflow, input)
      })
```

### LLM 节点执行链路
```
executeLLMNode(node, context)
  ├─ getPreviousOutputs()          → 上游节点输出
  ├─ getProvider()                 → 查厂商配置
  ├─ createModel()                 → 初始化 SDK 客户端
  ├─ [RAG] fetch(/api/rag/search)  → 知识库检索
  ├─ [Memory] conversationMemory   → 多轮对话历史
  ├─ [Tools] weatherTool           → Function Calling
  ├─ generateText()                → AI SDK 调用
  └─ extract content from steps    → 提取文本
```

## 数据模型关系

```
Workflow ──< WorkflowNode       (1:N)
Workflow ──< WorkflowEdge       (1:N)
Workflow ──< Execution          (1:N)
Workflow ──< WorkflowCronJob    (1:N, unique: workflowId+name)
Document ──< DocumentChunk      (1:N)
Credential                       (独立)
```

## 组件树

```
RootLayout
  └─ TooltipProvider
      └─ DashboardLayout                    [侧边栏布局]
          ├─ /                    → DashboardPage
          ├─ /workflows           → WorkflowsPage
          ├─ /workflow/[id]       → WorkflowEditorPage
          │   ├─ Toolbar          [保存/执行/测试/Webhook]
          │   ├─ NodePanel        [拖拽节点列表]
          │   ├─ Canvas           [React Flow 画布]
          │   └─ ConfigPanel      → NodeConfigPanel [配置表单]
          ├─ /history             → HistoryPage
          │   └─ /history/[id]    → ExecutionDetailPage
          ├─ /knowledge           → KnowledgePage
          └─ /credentials         → CredentialsPage
      ├─ /chat/[id]               → ChatPage → ChatPanel
      └─ /widget/[id]             → WidgetPage
```

## API 路由树

```
/api
├─ /workflow
│   ├─ route.ts              GET (list)  POST (create)
│   ├─ /[id]/route.ts        GET  PUT  DELETE
│   ├─ /run/route.ts         POST (execute)
│   ├─ /cron/route.ts        GET  POST  DELETE
│   └─ /executions
│       ├─ route.ts          GET (list, paginated)
│       └─ /[id]/route.ts    GET (detail)
├─ /webhook/[id]/route.ts    POST (trigger)  GET (status)
├─ /feishu/callback/route.ts POST (event)
├─ /documents
│   ├─ route.ts              GET (list)  POST (upload)
│   └─ /[id]/route.ts        DELETE
├─ /credentials
│   ├─ route.ts              GET (list)  POST (create)
│   └─ /[id]/route.ts        GET (decrypt)  DELETE
└─ /rag/search/route.ts      POST (query)
```

## 进程模型

```
┌────────────────────────────────────────────────┐
│  终端 1: npm run dev:feishu                     │
│  ├─ next dev --webpack    (主服务 :3000)        │
│  ├─ ngrok http 3000       (内网穿透)            │
│  └─ tsx cron-worker-start (定时 Worker)         │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│  Docker: docker compose up -d                   │
│  ├─ PostgreSQL (pgvector)  :5432               │
│  └─ Redis                  :6379               │
└────────────────────────────────────────────────┘
```
