# My Workflow

可视化拖拽式 AI 工作流平台（类 Dify / Coze），基于 Next.js 16 + React 19 + React Flow 构建。支持 RAG 知识库、Agent 工具调用、技能包（Skills/Prompts/MCP）市场、Office 文件生成、飞书集成与定时任务。

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | Next.js 16 (App Router) + React 19 + React Flow |
| UI | shadcn/ui + Tailwind CSS 4 + lucide-react |
| 状态管理 | Zustand（`src/stores/`） |
| 数据库 | PostgreSQL + pgvector（Prisma 7） |
| 队列 | BullMQ + Redis（Cron 定时、异步任务） |
| AI SDK | Vercel AI SDK（OpenAI / Anthropic / Gemini / DeepSeek / Groq / Mistral / xAI） |
| 测试 | Vitest + happy-dom（156 用例） |

## 快速开始

```bash
# 1. 启动数据库（PostgreSQL + Redis）
npm run docker:up

# 2. 配置环境变量（见 .env 模板：DATABASE_URL、REDIS_URL、各厂商 API Key）
# 3. 初始化数据库
npx prisma generate
npx prisma db push

# 4. 启动开发服务器
npm run dev:webpack          # http://localhost:3000
```

一键飞书模式（内置 ngrok 内网穿透 + Cron Worker）：

```bash
npm run dev:feishu
```

独立启动定时 Worker：

```bash
npm run worker
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev:webpack` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | ESLint（已忽略 `.worktrees/`） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | Vitest 全量测试 |
| `npm run db:push` / `db:migrate` | 同步 / 迁移数据库 |
| `npm run db:studio` | Prisma Studio |
| `npm run docker:up` / `down` | Docker 服务启停 |

## 项目结构

```
src/
├── app/
│   ├── (dashboard)/          # 工作台（页面路由）
│   │   ├── workflows/        # 工作流列表
│   │   ├── workflow/[id]/    # 编辑器（画布 + 配置面板 + 聊天调试）
│   │   ├── history/          # 执行历史（状态筛选 / 重跑）
│   │   ├── knowledge/        # 知识库（RAG 文档管理）
│   │   ├── credentials/      # 全局凭据
│   │   ├── templates/        # 模板库（一键创建）
│   │   ├── extensions/       # 扩展中心（Skills/Prompts/MCP/技能包市场）
│   │   ├── chat/             # 聊天调试
│   │   └── widget/           # 嵌入组件
│   └── api/                  # Route Handlers
│       ├── workflow/         # 工作流 CRUD / 执行 / executions
│       ├── rag/              # 知识库检索
│       ├── documents/        # 文档上传/分块/向量化
│       ├── extensions/       # 扩展资源 API（skills/prompts/mcp）
│       ├── packs/            # 技能包市场：导入/安装/卸载
│       ├── feishu/           # 飞书回调
│       ├── webhook/          # 外部触发执行
│       ├── fs/               # 本地文件系统（目录浏览/允许目录）
│       ├── storage/          # storage 目录文件列表
│       ├── music/            # 音乐生成文件流
│       ├── credentials/      # 凭据 CRUD
│       └── templates/        # 模板元数据
├── components/
│   ├── canvas/               # React Flow 画布、节点面板
│   ├── nodes/                # 节点 UI 组件（13 种）
│   ├── panels/
│   │   ├── configs/          # 各节点独立配置组件（13 个）
│   │   └── ...               # 面板工具（凭据选择、目录选择、调试）
│   ├── chat/                 # 聊天调试面板
│   ├── extensions/           # 扩展中心 UI（编辑器/Picker/市场）
│   └── ui/                   # shadcn/ui 组件
├── engine/
│   ├── executor.ts           # 核心执行器（DAG 拓扑排序、条件分支、重试）
│   ├── nodes/                # 各节点执行逻辑（含单元/集成测试）
│   └── extensions/           # Skills/Prompts/MCP 加载器、绑定合并
├── lib/
│   ├── rag.ts                # 知识库检索（向量 + 全文兜底）
│   ├── expression.ts         # {{ }} 表达式解析
│   ├── chunker.ts            # 文本分块
│   ├── embedding.ts          # embedding 生成
│   ├── ai.ts / providers.ts  # AI 模型封装与供应商列表
│   ├── credential.ts / crypto.ts  # 凭据解析与加密
│   └── cron-*.ts             # 定时任务 Worker
├── mcp/office/               # Office MCP Server（docx/xlsx/pptx/pdf 转换）
├── packs/                    # 内置技能包清单（filesystem / office）
├── stores/                   # Zustand 状态（workflow/chat/runResults）
├── types/                    # 全局类型定义
└── i18n/                     # zh/en 国际化
```

## 节点类型（13 种）

| 节点 | 说明 |
|------|------|
| **Input** | 输入参数（text/number/boolean/json/file），本地文件/目录选择器 |
| **LLM** | 大模型调用，支持 RAG 增强、多轮记忆、JSON 模式、**Agent 工具调用**（maxSteps 1-20 可配） |
| **Knowledge Search** | 知识库检索，召回相关片段传给下游 |
| **Output** | 结果输出与导出（download / local / remote），文本产物命名导出 |
| **Code** | 执行自定义 JS（注入 input/items/query；静态检查 + worker 超时强杀） |
| **Delay** | 延时等待（最长 5 分钟） |
| **Loop** | 遍历数组逐项处理（硬上限 1000，防失控） |
| **Condition** | IF/ELSE 分支判断 |
| **Merge** | 合并多分支结果 |
| **HTTP** | 调用外部 API |
| **Feishu** | 飞书消息收发 |
| **Cron Trigger** | Cron 表达式定时触发 |
| **Music** | 音乐生成 API（异步轮询） |

## Agent 工具调用

LLM 节点通过「扩展绑定」注入三路工具：

- **Skills**：技能包（Markdown 定义的步骤指南）
- **Prompts**：提示词模板
- **MCP Servers**：本地/远程 MCP 工具（stdio 进程池 + HTTP/SSE）

执行时每轮工具调用（名称/参数/结果/耗时）记录到执行日志，历史页与聊天面板可视化展示。

## 技能包市场（Packs）

内置两个官方技能包：

- **filesystem**：读取 storage/ 目录下的本地文件
- **office**：生成 docx / xlsx / pptx / pdf（纯 JS，无 Chromium）

可在扩展中心安装/导入第三方 `.zip` 技能包，`{packId}` 自动绑定其 Skills/Prompts/MCP。

## RAG 知识库

1. 知识库页面上传 txt/md/csv/json 文档
2. 自动分块 + embedding 向量化（pgvector，默认 OpenAI text-embedding-3-small）
3. 检索走 `searchKnowledge()`（向量优先，全文检索兜底）
4. LLM 节点绑定 `knowledgeId` 或使用 Knowledge Search 节点

## 定时任务

- `WorkflowCronJob` 存 Cron 表达式 + 时区 + input payload
- BullMQ Worker（`npm run worker`）注册任务，到点触发执行
- 兼容旧版 HH:MM 定时格式

## 飞书集成

- **发送**：webhook 或应用级 App 凭据
- **接收**：`/api/feishu/callback`（需 ngrok 暴露公网地址，见 `dev:feishu`）

## 执行引擎

1. 拓扑排序 DAG 确定执行顺序（条件节点跳过不匹配分支）
2. 按序执行节点（支持指数退避重试）
3. 各节点输出写入 `ExecutionContext.nodeResults`，表达式按 `{{ }}` 引用
4. 错误不中断整体流程——错误处理节点可捕获继续
5. 完整执行日志 + duration 持久化为 Execution 记录

## 国际化

- 全部 UI 文案经 `useTranslation()` 读取 `zh.json` / `en.json`
- 侧边栏底部 🌐 切换语种，选择存于 localStorage（`workflow-locale`）

## 测试

```bash
npm run test          # 全量（需 DB 时先 npm run docker:up）
npm run test:watch    # 监听模式
npx vitest run src/engine/nodes/llm.test.ts   # 单文件
```

覆盖：节点执行器（含工具调用步骤装配）、RAG 检索、文本分块、表达式、扩展加载、executor 集成（拓扑/分支/失败路径）、模板注册表、Office 转换、技能包服务等。

## Docker

```yaml
postgres: pgvector/pgvector:pg16   # 5432
redis:    redis:7-alpine            # 6379
```

## 发展路线

完整规格见 `docs/superpowers/specs/2026-08-27-roadmap-design.md`。

- [x] Phase 1：LLM 节点 Agent 化（maxSteps 可配、工具调用步骤可观测）
- [x] Phase 2：RAG 知识库落地（共用检索函数 + 知识库检索节点）
- [x] Phase 3：文件批处理场景链路（输出导出打磨 + 批量报告/数据洞察模板）
- [x] Phase 4：控制流节点（code / delay / loop）
- [x] Phase 5：工程收尾（executor 测试、NodeConfigPanel 拆分、历史增强、本 README）
- [ ] 后续：飞书对话助手 / 定时资讯场景扩展、（已延期）多用户、工作流版本管理