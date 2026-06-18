# My Workflow

可视化拖拽式 AI 工作流平台（类似 Dify / Coze），基于 Next.js + React Flow 构建。

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) + React 19 |
| 画布引擎 | [React Flow](https://reactflow.dev/) (节点拖拽/连线) |
| 状态管理 | [Zustand](https://github.com/pmndrs/zustand) |
| UI 组件 | [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS 4 |
| 数据库 | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| ORM | [Prisma 7](https://www.prisma.io/) |
| 消息队列 | [BullMQ](https://docs.bullmq.io/) (Redis) |
| AI SDK | [Vercel AI SDK](https://sdk.vercel.ai/) |

## 启动命令

### 一键启动（推荐）

```bash
npm run dev:feishu
```

这条命令会依次执行：
| 步骤 | 命令 | 作用 |
|------|------|------|
| 1 | `kill $(lsof -ti:3000)` | 杀掉旧 Dev Server |
| 2 | `pkill -9 -f ngrok` | 杀掉旧 ngrok 隧道 |
| 3 | `pkill -9 -f cron-worker-start` | 杀掉旧定时 Worker |
| 4 | `npx tsx src/lib/cron-worker-start.ts &` | **启动定时任务 Worker**（监听 BullMQ 执行定时工作流） |
| 5 | `ngrok http 3000 &` | 启动内网穿透（飞书回调用） |
| 6 | `next dev --webpack` | 启动 Next.js 开发服务器 |

### 单独启动 Worker

```bash
npm run worker
```

Worker 负责：从数据库加载定时任务 → 注册到 BullMQ → 到点触发工作流执行。

### 启动数据库

```bash
npm run docker:up
```
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
DATABASE_URL="postgresql://workflow:workflow@localhost:5432/workflow"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 3. 初始化数据库

```bash
# 生成 Prisma Client
npx prisma generate

# 同步数据库 schema（开发环境）
npx prisma db push

# 或使用 migrate（生产环境）
npx prisma migrate dev --name init
```

### 4. 启动开发服务器

```bash
npm run dev:webpack
# 访问 http://localhost:3000
```

## 可用脚本

```bash
npm run dev          # 开发服务器 (Turbopack)
npm run dev:webpack  # 开发服务器 (Webpack, 兼容性更好)
npm run build        # 生产构建
npm run start        # 生产启动
npm run lint         # ESLint 检查
npm run typecheck    # TypeScript 类型检查

# 数据库相关
npm run db:generate  # 生成 Prisma Client
npm run db:push      # 推送到数据库（开发）
npm run db:migrate   # 创建迁移文件
npm run db:studio    # 打开 Prisma Studio

# Docker 相关
npm run docker:up    # 启动 PostgreSQL + Redis
npm run docker:down  # 停止服务
```

## 项目结构

```
src/
├── app/                        # Next.js App Router
│   ├── (dashboard)/            # 工作台布局（含侧边栏）
│   │   ├── page.tsx            # 首页
│   │   ├── workflows/page.tsx  # 工作流列表
│   │   └── workflow/[id]/page.tsx  # 工作流编辑器
│   ├── chat/[id]/page.tsx      # 聊天调试页面
│   └── api/workflow/           # 工作流 API
│       ├── route.ts            # GET (列表) / POST (创建)
│       ├── [id]/route.ts       # GET / PUT / DELETE
│       └── run/route.ts        # POST (执行)
├── components/
│   ├── canvas/                 # React Flow 画布组件
│   │   ├── Canvas.tsx          # 画布主组件
│   │   ├── NodePanel.tsx       # 节点面板（拖拽源）
│   │   └── ConfigPanel.tsx     # 配置面板外壳
│   ├── nodes/                  # 自定义节点
│   │   ├── InputNode.tsx       # 输入节点
│   │   ├── LLMNode.tsx         # LLM 调用节点
│   │   └── OutputNode.tsx      # 输出节点
│   ├── panels/                 # 功能面板
│   │   ├── NodeConfigPanel.tsx # 节点配置表单
│   │   └── Toolbar.tsx         # 顶部工具栏
│   ├── chat/ChatPanel.tsx      # 聊天调试面板
│   └── ui/                     # shadcn/ui 组件库
├── engine/                     # 工作流执行引擎
│   ├── executor.ts             # 核心执行器
│   └── nodes/                  # 各节点执行逻辑
│       ├── input.ts
│       ├── llm.ts
│       └── output.ts
├── lib/                        # 工具库
│   ├── prisma.ts               # Prisma 客户端
│   ├── ai.ts                   # AI SDK 封装
│   └── utils.ts                # cn() 工具
├── stores/                     # Zustand 状态管理
│   ├── workflow.ts             # 工作流编辑器状态
│   └── chat.ts                 # 聊天调试状态
└── types/workflow.ts           # 全局类型定义
```

## 数据模型

```
Workflow (工作流)
├── id, name, description
├── config: JSON
├── nodes → WorkflowNode[]     # 关联节点
├── edges → WorkflowEdge[]     # 关联连线
└── executions → Execution[]   # 执行记录

WorkflowNode (节点)
├── id, type (input|llm|output)
├── positionX, positionY        # 画布坐标
└── data: JSON                  # 节点配置

WorkflowEdge (连线)
├── id, source, target
├── sourceHandle, targetHandle  # 连接端口
└── workflowId

Execution (执行记录)
├── id, status (pending|running|completed|failed)
├── input, output: JSON
├── error, startedAt, finishedAt
└── durationMs
```

## API 接口

### 工作流 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/workflow` | 获取工作流列表 |
| `POST` | `/api/workflow` | 创建工作流 |
| `GET` | `/api/workflow/[id]` | 获取工作流详情 |
| `PUT` | `/api/workflow/[id]` | 更新工作流 |
| `DELETE` | `/api/workflow/[id]` | 删除工作流 |

### 工作流执行

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/workflow/run` | 执行工作流 |

请求体示例：
```json
{
  "workflowId": "clx...",
  "input": {
    "message": "Hello, how are you?"
  }
}
```

响应示例：
```json
{
  "executionId": "clx...",
  "workflowId": "clx...",
  "status": "completed",
  "logs": [
    {
      "nodeId": "input-123",
      "nodeType": "input",
      "status": "completed",
      "output": { "message": "Hello, how are you?", "raw": "Hello, how are you?" }
    },
    {
      "nodeId": "llm-456",
      "nodeType": "llm",
      "status": "completed",
      "output": { "text": "...", "raw": "...", "model": "gpt-4o-mini", "usage": {...} }
    },
    {
      "nodeId": "output-789",
      "nodeType": "output",
      "status": "completed",
      "output": { "output": "...", "raw": "...", "format": "text" }
    }
  ],
  "output": { "output": "I'm doing great!", "raw": "I'm doing great!", "format": "text" },
  "durationMs": 1234
}
```

## 节点类型

### Input Node（输入节点）
- 定义工作流的输入参数
- 配置：变量名、类型（text/number/boolean/json）、是否必填、默认值
- 端口：1 个 source（输出）

### LLM Node（LLM 节点）
- 调用大语言模型
- 配置：模型选择、System Prompt、Temperature、Max Tokens
- 端口：1 个 target（输入） + 1 个 source（输出）
- 支持模型：GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo, Claude 3.5 Sonnet, Claude 3 Haiku

### Output Node（输出节点）
- 格式化并返回最终结果
- 配置：输出格式（text/json/markdown）、模板
- 端口：1 个 target（输入）

## 执行引擎工作原理

1. **解析工作流**：从数据库加载节点和连线
2. **拓扑排序**：将 DAG 图转换为线性执行顺序
3. **顺序执行**：按拓扑序依次执行每个节点
4. **数据传递**：每个节点的输出存入 `ExecutionContext.nodeResults`，后续节点可读取上游节点的结果
5. **返回结果**：取最后一个 Output Node 的结果作为最终输出

## Docker 服务

```yaml
postgres: pgvector/pgvector:pg16  # 5432 端口
redis:    redis:7-alpine           # 6379 端口
```

## Phase 1 已实现

- [x] 可视化工作流编辑器（React Flow）
- [x] 三种基础节点（Input / LLM / Output）
- [x] 节点配置面板
- [x] 工作流保存/加载（CRUD API + PostgreSQL）
- [x] 后端执行引擎（DAG 拓扑排序）
- [x] Chat 调试 UI
- [x] 执行日志和追踪

## 下一步 (Phase 2 规划)

- 更多节点类型：RAG 知识库、HTTP 请求、Code 执行、条件判断
- 工作流版本管理
- 执行日志持久化和搜索
- 流式输出优化（SSE / WebSocket）
- 错误重试和断点续跑
