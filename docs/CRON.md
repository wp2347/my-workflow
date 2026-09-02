# 定时任务系统文档

## 架构概览

系统使用**双调度器分工**模式，避免同一个定时任务被重复执行：

```
┌─────────────────────────────────────────────────────────┐
│                    instrumentation.ts                     │
│              Next.js 服务端启动时执行                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  startScheduler()              initCronSystem()            │
│  [轮询调度器]                   [BullMQ Cron 系统]          │
│       │                              │                   │
│       ▼                              ▼                   │
│  每 30s 检查                      连接 Redis              │
│  workflow.schedule                  │                    │
│  (HH:MM 旧版)                     ▼                     │
│                               cleanupOldRepeatableJobs() │
│                              → 清理遗留孤儿任务            │
│                                     │                    │
│                                     ▼                     │
│                               registerCronJob()           │
│                              → upsertJobScheduler         │
│                              → 写入 Redis Job Scheduler    │
│                                     │                    │
│                                     ▼                     │
│                               startCronWorker()           │
│                              → 监听队列，触发时执行          │
└──────────────────────────────────────────────────────────┘
```

- **轮询调度器** → 只处理 `workflow.schedule` (旧版 HH:MM 格式，如 `"08:30"`)
- **BullMQ Worker** → 只处理 `WorkflowCronJob` (cron 表达式格式，如 `"30 8 * * *"`)

## 核心文件

| 文件 | 职责 |
|------|------|
| `src/lib/cron-worker.ts` | BullMQ 核心：队列管理、Job Scheduler 注册/移除、Worker 启动 |
| `src/lib/cron-init.ts` | 系统初始化：从 DB 加载任务、清理遗留、同步到 Redis |
| `src/lib/scheduler.ts` | 轮询调度器：30s 间隔检查 HH:MM 格式定时 |
| `src/lib/scheduler-init.ts` | 轮询器启动入口 |
| `src/lib/cron-helper.ts` | 工具函数：计算下次执行时间（UI 显示用） |
| `src/lib/cron-worker-start.ts` | 独立进程启动脚本（生产环境解耦） |
| `src/instrumentation.ts` | Next.js 启动钩子：启动两个调度器 |
| `src/types/workflow.ts` | `NodeType` 包含 `"cron_trigger"` |
| `src/engine/nodes/cron_trigger.ts` | 定时触发器节点执行器（透传 input） |
| `src/engine/executor.ts` | 工作流引擎：`executeCronTriggerNode` 已注册 |

## 数据库模型

### WorkflowCronJob

```prisma
model WorkflowCronJob {
  id         String    @id @default(cuid())
  workflowId String    @map("workflow_id")
  name       String                                         // 任务显示名称
  cronExpr   String    @map("cron_expr")                    // cron 表达式
  timezone   String    @default("Asia/Shanghai")            // 时区
  enabled    Boolean   @default(true) @map("enabled")
  input      Json      @default("{}")                       // 触发时传入的 payload
  lastRunAt  DateTime? @map("last_run_at")                  // 上次执行时间
  nextRunAt  DateTime? @map("next_run_at")                  // 预计下次执行（仅显示）
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  workflow Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@unique([workflowId, name])                               // 同一工作流下任务名唯一
}
```

### Workflow.schedule（旧版）

```prisma
model Workflow {
  schedule String?  // 旧版 HH:MM 格式，如 "08:30"
}
```

## Cron 表达式说明

系统使用标准 5 段 cron 表达式（分 时 日 月 周）：

| 表达式 | 含义 |
|--------|------|
| `0 * * * *` | 每小时整点 |
| `30 8 * * *` | 每天 08:30 |
| `0 9 * * 1-5` | 工作日 09:00 |
| `0 9 * * 1` | 每周一 09:00 |
| `*/15 * * * *` | 每 15 分钟 |

## 调度流程

### 启动时

```
initCronSystem()
  1. cleanupOldRepeatableJobs()
     → 扫描 Redis 中所有 legacy repeatable jobs
     → 逐个移除（旧代码因 key 格式错误从未真正移除）

  2. prisma.workflowCronJob.findMany({ enabled: true })
     → 加载所有启用的 CronJob

  3. 遍历每个 CronJob:
     registerCronJob(job.id, workflowId, cronExpr, timezone, input)
       → queue.upsertJobScheduler(jobId, { pattern, tz }, { data })
       → CronExpressionParser.parse() 计算 nextRunAt
       → prisma.workflowCronJob.update({ nextRunAt })

  4. startCronWorker()
     → new Worker(queue, handler, { concurrency: 3 })
```

### 触发时

```
CronExpr 匹配 → BullMQ 产出 Job → Worker 处理:
  1. prisma.workflow.findUnique({ include: { nodes, edges } })
  2. 检查 workflow.enabled (已禁用则跳过)
  3. 转换 nodes/edges → 引擎格式
  4. executeWorkflow(nodes, edges, input, workflowId, execId)
     → cron_trigger 节点 → 下游节点链 → output
  5. prisma.execution.create()          (持久化执行记录)
  6. prisma.workflowCronJob.update({ lastRunAt })  (更新执行时间)
```

### 轮询调度器（旧版 HH:MM）

```
setInterval(checkScheduledWorkflows, 30000):
  1. prisma.workflow.findMany({ enabled: true, schedule: { not: null } })
  2. 遍历: if (wf.schedule === currentTime("HH:MM"))
  3. runLog 防重入检查 (同一任务 60s 内不重复)
  4. executeWorkflow(nodes, edges, input, wf.id, execId)
  5. prisma.execution.create()
```

## API 同步机制

### 创建工作流 (POST /api/workflow)

```
1. 创建 Workflow + Nodes + Edges
2. 检出 cron_trigger 节点
3. prisma.workflowCronJob.upsert()     → DB 持久化
4. syncCronJob("create", job)          → Redis Job Scheduler
```

### 更新工作流 (PUT /api/workflow/[id])

**部分更新**（仅切换 enabled/schedule 等元数据）:
```
1. prisma.workflow.update({ data: { enabled, schedule, ... } })
2. 若 enabled 变化:
   for each cronJob:
     syncCronJob("update", { enabled: enabled && cronJob.enabled })
       → removeCronJob()  → 如果是 false 则停在这里
       → registerCronJob() → 如果是 true 则重新注册
```

**完整更新**（传入 nodes/edges 重建）:
```
1. 删除旧 nodes/edges
2. 重建 workflow + nodes + edges
3. 检出 cron_trigger 节点 → upsert + syncCronJob("update")
```

### 删除工作流 (DELETE /api/workflow/[id])

```
级联删除（onDelete: Cascade）
→ WorkflowCronJob 随 Workflow 自动清理
→ DB 记录已删，但 Redis 中 Job Scheduler 仍存在
→ 下次 initCronSystem() 会对比 DB 重新注册，旧 Scheduler 被覆盖
```

## 关键修复记录 (2026-06-26)

### 1. 双重调度修复

**问题**: `scheduler.ts` 的轮询检查与 `cron-worker.ts` 的 BullMQ Worker 同时处理 `WorkflowCronJob`，导致每个定时任务执行两次。

**修复**: `scheduler.ts` 移除 CronJob cron 表达式轮询检查，只保留旧版 HH:MM 格式。

### 2. 模块级自动执行副作用

**问题**: `cron-init.ts:45` 在模块 import 时自动调用 `initCronSystem()`，在构建阶段或非 Node 运行时可能触发 Redis 连接错误。

**修复**: 移除模块级 auto-call，改为在 `instrumentation.ts` 中显式调用。

### 3. 部分更新不触发 CronJob 同步

**问题**: PUT API 部分更新（仅切换 enabled）绕过了 cron 同步逻辑直接 return，导致 Redis 中 BullMQ Job Scheduler 状态与实际不一致。

**修复**: 在 enabled 变化后遍历所有关联 CronJob，调用 `syncCronJob` 同步。

### 4. BullMQ 遗留孤儿任务

**问题**: 旧代码使用 `q.add()` + `repeat` + `removeRepeatableByKey()` 管理定时任务，但 key 格式 `"queueName:jobId:repeat"` 不匹配 BullMQ 内部的 md5 hash key，导致 repeatable jobs 从未被真正移除。每次重启/保存都累加新任务，最终产生 N 条重复消息。

**修复**: 
- 改用官方 `upsertJobScheduler()` / `removeJobScheduler()` API
- 新增 `cleanupOldRepeatableJobs()` 一次性扫除所有遗留孤儿任务
- Worker 中使用 `job.name`（JobScheduler ID）更新 DB 而非 `job.id`（迭代 ID）

### 5. 时间选择器频率丢失

**问题**: `NodeConfigPanel.tsx` 中修改 cron 时间的小时/分钟时，`cronExpr` 始终设为每日格式 `* * *`，丢弃了工作日/每周等频率配置。

**修复**: 从现有的 `config.cronExpr` 中保留星期字段，只替换分钟/小时部分。

### 6. 缺少 Redis

**问题**: 开发环境中未安装 Redis，BullMQ 无法工作。`next.config.ts` 中虽然 Next.js 16 默认启用 instrumentation，但 Redis 不存在导致启动失败。

**修复**: 
- `brew install redis && brew services start redis`
- Next.js 16 默认支持 instrumentation.ts，无需 `experimental.instrumentationHook` 配置

## 环境依赖

| 组件 | 用途 | 默认地址 |
|------|------|---------|
| PostgreSQL | 存储工作流、CronJob、执行记录 | `localhost:5432` |
| Redis | BullMQ 消息队列 | `localhost:6379` |
| BullMQ | 定时任务调度（Job Scheduler + Worker） | 通过 `REDIS_URL` 环境变量连接 |

## 调试命令

```bash
# 查看 Redis 中的 Job Scheduler
redis-cli KEYS "*workflow-queue*"

# 查看所有 repeatable jobs（旧版遗留）
redis-cli KEYS "*repeat*"

# 手动清理遗留
npx tsx -e "
const { cleanupOldRepeatableJobs } = require('@/lib/cron-worker');
cleanupOldRepeatableJobs().then(() => process.exit(0));
"

# 启动独立 Worker（生产环境）
npx tsx src/lib/cron-worker-start.ts

# 查看 CronJob 数据库状态
npx prisma db execute --stdin <<< 'SELECT name, cron_expr, enabled, last_run_at, next_run_at FROM workflow_cron_jobs;'
```
