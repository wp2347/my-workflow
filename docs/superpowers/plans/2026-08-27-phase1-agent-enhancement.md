# Phase 1 —— LLM 节点 Agent 化增强 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让现有 LLM 节点成为可靠的 Agent 执行单元——迭代轮数可配置、每轮工具调用明细（名称/参数/结果摘要/耗时）记入执行日志并在历史页与聊天调试面板可查看。

**Architecture:** 新建纯函数模块 `llm-steps.ts` 负责 SDK 多步结果 → `ToolCallStep[]` 的装配（含耗时 FIFO 匹配与摘要截断）；`llm.ts` 消费该模块并在输出中携带 `steps`/`toolCalls`；executor 通用地把结果中的 `steps` 抄写进 `ExecutionLog`；UI 端 LLM 配置拆为独立组件 `LlmConfig.tsx` 并新增循环上限输入。

**Tech Stack:** Vercel AI SDK v6 (`generateText` 多步)、Vitest、React 19、Tailwind/shadcn-ui、zustand。

**Spec:** `docs/superpowers/specs/2026-08-27-roadmap-design.md` §3

---

## 背景知识（给零上下文工程师）

- **执行链路**：编辑器保存 nodes/edges → `POST /api/workflow/run` → `executeWorkflow`（src/engine/executor.ts）拓扑排序逐节点执行 → 每个 `ExecutionLog` 被 push 进 `context.logs`，节点成功后 `log.output = result` → 结果整体持久化为一条 Execution 记录。
- **AI SDK 多步**：`generateText({ tools, stopWhen })` 返回的 `result.steps[]` 中，每个 step 含 `toolCalls[]` 与对齐下标的 `toolResults[]`；字段名在 v5+ 为 `input`（非 `args`）、结果字段为 `output`。
- **测试模式**：见 src/engine/nodes/llm.test.ts —— `vi.hoisted` 提取 mock、`vi.mock("ai")` 替换 `generateText`、`vi.stubEnv` 控制环境变量。运行命令：`npx vitest run <文件路径>`。
- **质量门禁**：`npm run typecheck` / `npm run lint` / `npx vitest run` 三者必须全绿。

## File Structure（本计划涉及的文件）

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `src/types/workflow.ts` | 新增 `ToolCallStep` / `ToolCallInfo` 类型，扩展 `ExecutionLog` / `LLMNodeConfig` |
| Create | `src/engine/nodes/llm-steps.ts` | 纯函数：摘要截断、SDK steps 装配、执行器抄写提取 |
| Create | `src/engine/nodes/llm-steps.test.ts` | 上述纯函数单测 |
| Modify | `src/engine/nodes/llm.ts` | maxSteps 可配、工具计时包装、输出带 steps/toolCalls |
| Modify | `src/engine/nodes/llm.test.ts` | 补多步工具调用集成测试 |
| Modify | `src/engine/executor.ts` | 把 result.steps 抄写进 log.steps |
| Create | `src/components/panels/configs/LlmConfig.tsx` | LLM 节点独立配置组件（含新 maxSteps 输入） |
| Modify | `src/components/panels/NodeConfigPanel.tsx` | LLM 块替换为 `<LlmConfig/>`，清理孤儿导入 |
| Modify | `src/stores/chat.ts` | `ExecutionNodeState` 增加可选 `toolStepCount` |
| Modify | `src/components/chat/ChatPanel.tsx` | LLM 节点行展示工具步数徽标 |
| Modify | `src/app/(dashboard)/history/[id]/page.tsx` | 展示 log.steps 明细 |
| Modify | `src/i18n/locales/zh.json`、`src/i18n/locales/en.json` | 同步文案 |

---

### Task 1: 类型定义 + llm-steps 纯函数模块（TDD）

**Files:**
- Modify: `src/types/workflow.ts`
- Create: `src/engine/nodes/llm-steps.ts`
- Test: `src/engine/nodes/llm-steps.test.ts`

- [ ] **Step 1.1: 在 `src/types/workflow.ts` 追加类型**

在 `/** 单节点执行日志 */ export interface ExecutionLog` 定义之前插入：

```ts
// ---- Agent 工具调用步骤 ----

/** 一次工具调用的日志记录（写入 ExecutionLog.steps） */
export interface ToolCallStep {
  toolName: string
  argsSummary: string      // 参数 JSON 摘要（超长截断）
  resultSummary: string    // 结果 JSON 摘要（超长截断）
  durationMs: number
}

/** 工具调用概要（随节点输出发给下游节点/调试面板使用） */
export interface ToolCallInfo {
  name: string
  args?: unknown
  summary: string
}
```

然后给 `ExecutionLog` 增加 `steps` 可选字段：

```ts
/** 单节点执行日志 */
export interface ExecutionLog {
  nodeId: string
  nodeType: NodeType
  status: "running" | "completed" | "failed"
  input?: unknown
  output?: unknown
  error?: string
  timestamp: string
  durationMs?: number
  steps?: ToolCallStep[]   // Agent 工具调用明细（仅工具型节点产出）
}
```

并给 `LLMNodeConfig` 追加：

```ts
  /** 工具调用最大交互轮数（1-20，默认 8）；无工具时无效 */
  maxSteps?: number
```

- [ ] **Step 1.2: 编写失败测试 `src/engine/nodes/llm-steps.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { truncateForSummary, assembleToolCallSteps } from "@/engine/nodes/llm-steps"

describe("truncateForSummary", () => {
  it("短值原样返回", () => {
    expect(truncateForSummary({ a: 1 })).toBe('{"a":1}')
    expect(truncateForSummary(undefined)).toBe("")
  })

  it("超过 500 字符截断并追加省略号", () => {
    const long = "x".repeat(600)
    const out = truncateForSummary(long)
    expect(out.length).toBe(501)
    expect(out.endsWith("…")).toBe(true)
    expect(out.startsWith("x")).toBe(true)
  })
})

describe("assembleToolCallSteps", () => {
  const makeTimings = (record: Array<[string, number]>) =>
    new Map(record.map(([k, v]) => [k, [v]]))

  it("按 SDK steps 装配 ToolCallStep，且按工具名 FIFO 消耗耗时", () => {
    //同名工具被调用两次：两次耗时应按顺序消耗
    const timings = new Map<number[], string>([])
    void timings
    const t = new Map<string, number[]>([["read_file", [12, 34]]])
    const sdkSteps = [
      {
        content: [],
        toolCalls: [{ toolName: "list_directory", input: { path: "/d" } }],
        toolResults: [{ toolName: "list_directory", output: ["a.md"] }],
      },
      {
        content: [],
        toolCalls: [
          { toolName: "read_file", input: { path: "/d/a.md" } },
          { toolName: "read_file", input: { path: "/d/b.md" } },
        ],
        toolResults: [
          { toolName: "read_file", output: "AAA" },
          { toolName: "read_file", output: "BBB" },
        ],
      },
    ]
    const { steps, toolCalls } = assembleToolCallSteps(sdkSteps, t)

    expect(steps).toHaveLength(3)
    expect(steps[0]).toEqual({
      toolName: "list_directory",
      argsSummary: '{"path":"/d"}',
      resultSummary: '["a.md"]',
      durationMs: 0, // 未记录耗时的工具回落 0
    })
    expect(steps[1].durationMs).toBe(12)
    expect(steps[2].durationMs).toBe(34)
    expect(toolCalls.map((c) => c.name)).toEqual(["list_directory", "read_file", "read_file"])
    expect(makeTimings([])).toBeDefined()
  })

  it("toolResults 缺失时结果摘要为空串且不抛错", () => {
    const sdkSteps = [
      { content: [], toolCalls: [{ toolName: "broken_tool", input: {} }], toolResults: [] },
    ]
    const { steps } = assembleToolCallSteps(sdkSteps, new Map())
    expect(steps[0].resultSummary).toBe("")
    expect(steps[0].durationMs).toBe(0)
  })

  it("无 toolCalls 的纯文本 step 被跳过", () => {
    const sdkSteps = [{ content: [{ type: "text", text: "hi" }] }]
    const { steps, toolCalls } = assembleToolCallSteps(sdkSteps, new Map())
    expect(steps).toHaveLength(0)
    expect(toolCalls).toHaveLength(0)
  })
})
```

- [ ] **Step 1.3: 运行测试确认失败**

Run: `npx vitest run src/engine/nodes/llm-steps.test.ts`
Expected: FAIL —— `Cannot find module '@/engine/nodes/llm-steps'`

- [ ] **Step 1.4: 实现 `src/engine/nodes/llm-steps.ts`**

```ts
import type { ToolCallStep, ToolCallInfo } from "@/types/workflow"

/** 摘要截断阈值（spec §3.1：超 500 字符截断，避免日志膨胀） */
const SUMMARY_MAX_LEN = 500

/** 将任意值序列化为日志摘要；undefined → ""，超长截断加省略号 */
export function truncateForSummary(value: unknown): string {
  if (value === undefined) return ""
  let text: string
  try {
    text = typeof value === "string" ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (!text) return ""
  if (text.length <= SUMMARY_MAX_LEN) return text
  return text.slice(0, SUMMARY_MAX_LEN) + "…"
}

/** 测试/执行侧可传入的最小 SDK step 形状（v5/v6 字段名：input/output） */
export interface SdkStepLike {
  content?: Array<{ type: string; text?: string }>
  toolCalls?: Array<{ toolName?: string; input?: unknown } & Record<string, unknown>>
  toolResults?: Array<{ toolName?: string; output?: unknown } & Record<string, unknown>>
}

/**
 * 把 AI SDK generateText 的多步结果装配为 ToolCallStep[] 与 ToolCallInfo[]。
 * - 耗时来源：timings 按 toolName 维护 FIFO 队列（由 instrumentTools 写入），
 *   同名多次调用按发生顺序消耗；缺失回落 0。
 * - 同一 step 内 toolCalls 与 toolResults 按下标对齐（AI SDK 保证）。
 */
export function assembleToolCallSteps(
  sdkSteps: SdkStepLike[],
  timings: Map<string, number[]>,
): { steps: ToolCallStep[]; toolCalls: ToolCallInfo[] } {
  const steps: ToolCallStep[] = []
  const toolCalls: ToolCallInfo[] = []

  for (const step of sdkSteps) {
    const calls = step.toolCalls || []
    const results = step.toolResults || []
    for (let i = 0; i < calls.length; i++) {
      const name = calls[i]?.toolName
      if (!name) continue
      const queue = timings.get(name)
      const durationMs = queue && queue.length > 0 ? queue.shift()! : 0
      const callStep: ToolCallStep = {
        toolName: name,
        argsSummary: truncateForSummary(calls[i]?.input),
        resultSummary: truncateForSummary(results[i]?.output),
        durationMs,
      }
      steps.push(callStep)
      toolCalls.push({ name, args: calls[i]?.input, summary: callStep.resultSummary })
    }
  }

  return { steps, toolCalls }
}
```

- [ ] **Step 1.5: 运行测试确认通过**

Run: `npx vitest run src/engine/nodes/llm-steps.test.ts`
Expected: PASS（6 个用例全绿）

- [ ] **Step 1.6: 质量门禁 + 提交**

```bash
npm run typecheck && git add src/types/workflow.ts src/engine/nodes/llm-steps.ts src/engine/nodes/llm-steps.test.ts
git commit -m "feat(agent): ToolCallStep 类型 + llm-steps 装配纯函数（TDD）"
```

---

### Task 2: executeLLMNode 改造——maxSteps 可配 + 步骤采集（TDD）

**Files:**
- Modify: `src/engine/nodes/llm.test.ts`
- Modify: `src/engine/nodes/llm.ts`

- [ ] **Step 2.1: 在 `llm.test.ts` 追加失败测试**

文件底部追加（复用文件顶部已有的 mock/makeNode/makeCtx）：

```ts
describe("executeLLMNode agent steps", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  /** 构造两轮工具调用的多步 generateText 返回值 */
  function makeMultiStepResult() {
    return {
      text: "最终回答",
      steps: [
        {
          content: [],
          toolCalls: [{ toolName: "get_weather", input: { city: "Beijing" } }],
          toolResults: [{ toolName: "get_weather", output: { temp_C: "25" } }],
        },
        {
          content: [{ type: "text", text: "北京今天 25 度" }],
          toolCalls: [],
          toolResults: [],
        },
      ],
      usage: { inputTokens: 10, completionTokens: 5 },
    }
  }

  it("enableTools 开启时注册内置示例工具并透传 maxSteps=轮次clamp", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    generateText.mockResolvedValue(makeMultiStepResult())
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", enableTools: true, maxSteps: 99 })

    const out = await executeLLMNode(node, makeCtx()) as Record<string, unknown>

    const opts = generateText.mock.calls[0][0] as Record<string, unknown>
    expect(opts.maxSteps).toBe(20)             // clamp 上限
    expect(opts.tools).toBeDefined()
    expect(Object.keys(opts.tools as Record<string, unknown>)).toContain("get_weather")

    expect(out.text).toBe("最终回答")
    const steps = out.steps as Array<{ toolName: string; durationMs: number }>
    expect(steps).toHaveLength(1)
    expect(steps[0].toolName).toBe("get_weather")
    expect(steps[0].durationMs).toBeGreaterThanOrEqual(0)
    const toolCalls = out.toolCalls as Array<{ name: string }>
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].name).toBe("get_weather")
    vi.unstubAllEnvs()
  })

  it("未配置 maxSteps 时默认 8", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    generateText.mockResolvedValue(makeMultiStepResult())
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", enableTools: true })

    await executeLLMNode(node, makeCtx())
    const opts = generateText.mock.calls[0][0] as Record<string, unknown>
    expect(opts.maxSteps).toBe(8)
    vi.unstubAllEnvs()
  })

  it("无任何工具时不注入 tools 键但仍带默认 maxSteps", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    generateText.mockResolvedValue({ text: "ok", steps: [], usage: {} })
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", enableTools: false })

    const out = await executeLLMNode(node, makeCtx()) as Record<string, unknown>
    const opts = generateText.mock.calls[0][0] as Record<string, unknown>
    expect(opts.tools).toBeUndefined()
    expect(opts.maxSteps).toBe(8)
    expect(out.steps).toEqual([])
    expect(out.toolCalls).toEqual([])
    vi.unstubAllEnvs()
  })
})
```

- [ ] **Step 2.2: 运行确认失败**

Run: `npx vitest run src/engine/nodes/llm.test.ts`
Expected: FAIL —— 新用例报 `opts.maxSteps` undefined / `out.steps` 缺失（旧 3 个凭证用例应保持 PASS）

- [ ] **Step 2.3: 改造 `llm.ts`**

(a) 头部导入区新增：

```ts
import { assembleToolCallSteps, truncateForSummary, type SdkStepLike } from "@/engine/nodes/llm-steps"
import type { ToolCallInfo } from "@/types/workflow"
```

(b) 在 `createModel` 函数后新增工具包装器：

```ts
/** 包装所有工具的 execute：把每次调用的耗时按工具名 FIFO 记录，供 assembleToolCallSteps 消费 */
function instrumentTools(
  tools: Record<string, unknown>,
  timings: Map<string, number[]>,
): Record<string, unknown> {
  const wrapped: Record<string, unknown> = {}
  for (const [name, t] of Object.entries(tools)) {
    const obj = t as { execute?: (args: unknown) => Promise<unknown> }
    if (typeof obj?.execute !== "function") { wrapped[name] = t; continue }
    wrapped[name] = {
      ...obj,
      execute: async (args: unknown) => {
        const start = Date.now()
        try { return await obj.execute!(args) }
        finally {
          const arr = timings.get(name) || []
          arr.push(Date.now() - start)
          timings.set(name, arr)
        }
      },
    }
  }
  return wrapped
}
```

(c) 删除旧的 `maxSteps` 分配逻辑。将 §「扩展 tools 注册」起至 `generateText` 调用前的一段：

```ts
  // 扩展 tools 注册
  const hasSkillTool = !!skillPayload.loadSkillTool
  const hasMcpTools = Object.keys(mcpPayload.tools || {}).length > 0
  if (hasSkillTool || hasMcpTools) {
    genOptions.tools = {
      ...(skillPayload.loadSkillTool || {}),
      ...(mcpPayload.tools || {}),
    }
    genOptions.maxSteps = (hasSkillTool && hasMcpTools) ? 5 : 3
  }

  // 工具调用
  if (enableTools) {
    genOptions.tools = { ...weatherTool, ...(genOptions.tools || {}) }
    genOptions.maxSteps = Math.max(genOptions.maxSteps as number || 0, 5)
  }

  // 有 tools 时用 stopWhen 确保多步执行(工具调用后自动续轮生成最终回复)
  if (genOptions.tools) {
    genOptions.stopWhen = stepCountIs(genOptions.maxSteps as number || 5)
  }
```

替换为：

```ts
  // ===== Agent 循环上限（spec：1-20，默认 8；无工具时同样生效但无实际意义）=====
  const maxStepsRaw = (nodeConfig.maxSteps as number) ?? 8
  const maxAgentSteps = Math.min(Math.max(Math.round(maxStepsRaw), 1), 20)

  // 内置示例工具（天气）仅在开关打开时注册；MCP/skill 工具始终可用
  const mergedTools: Record<string, unknown> = {
    ...(skillPayload.loadSkillTool || {}),
    ...(mcpPayload.tools || {}),
    ...(enableTools ? weatherTool : {}),
  }
  if (Object.keys(mergedTools).length > 0) {
    const timings = new Map<string, number[]>()
    agentTimings = timings
    genOptions.tools = instrumentTools(mergedTools, timings)
  }
  genOptions.maxSteps = maxAgentSteps
  genOptions.stopWhen = stepCountIs(maxAgentSteps)
```

并在函数体前段（`const userInput = ...` 之后任意位置）声明变量：

```ts
  let agentTimings: Map<string, number[]> | null = null
```

(d) 把结尾 `return { ... }` 之前增加装配逻辑，并将返回对象扩充：

```ts
  // ===== Agent 步骤装配：SDK steps → ToolCallStep[]/ToolCallInfo[] =====
  const assembled = assembleToolCallSteps(
    ((ru.steps as SdkStepLike[] | undefined)) || [],
    agentTimings ?? new Map(),
  )

  return {
    text: outputText, raw: outputText, model: modelId, provider,
    usage: { promptTokens: (ru.usage as Record<string, number> | undefined)?.inputTokens ?? 0, completionTokens: (ru.usage as Record<string, number> | undefined)?.outputTokens ?? 0 },
    steps: assembled.steps,
    toolCalls: assembled.toolCalls satisfies ToolCallInfo[],
  }
```

注意：保持其余代码（fallback 提取、memory 回写等）不变。

- [ ] **Step 2.4: 运行确认全部通过**

Run: `npx vitest run src/engine/nodes/llm.test.ts`
Expected: PASS（旧 3 个 + 新 3 个）

- [ ] **Step 2.5: 质量门禁 + 提交**

```bash
npm run typecheck && npm run lint && npx vitest run src/engine/nodes/
git add src/engine/nodes/llm.ts src/engine/nodes/llm.test.ts
git commit -m "feat(agent): LLM 节点 maxSteps 可配(1-20,默认8) + 工具调用步骤采集输出"
```

---

### Task 3: executor 把 result.steps 抄写进 ExecutionLog

**Files:**
- Modify: `src/engine/executor.ts`（成功分支，约 :204-209）

- [ ] **Step 3.1: 修改成功分支**

将：

```ts
        // 执行节点（带重试）
        const result = await executeNodeWithRetry(node, executor, context)
        context.nodeResults.set(node.id, result)

        log.status = "completed"
        log.output = result
        log.durationMs = Date.now() - startTime
```

改为：

```ts
        // 执行节点（带重试）
        const result = await executeNodeWithRetry(node, executor, context)
        context.nodeResults.set(node.id, result)

        log.status = "completed"
        log.output = result
        log.durationMs = Date.now() - startTime

        // Agent 步骤明细抄写：工具型节点若在结果里带了 steps 数组，提升到日志顶层
        if (result && typeof result === "object") {
          const steps = (result as Record<string, unknown>).steps
          if (Array.isArray(steps) && steps.length > 0) {
            log.steps = steps as ExecutionLog["steps"]
          }
        }
```

（`ExecutionLog` 已在该文件顶部 import，无需新增。）

- [ ] **Step 3.2: 质量门禁 + 提交**

```bash
npm run typecheck && npx vitest run
git add src/engine/executor.ts
git commit -m "feat(agent): executor 将节点结果中的 steps 提升到 ExecutionLog"
```

---

### Task 4: 抽取 LlmConfig 组件 + 新增 maxSteps 输入

**Files:**
- Create: `src/components/panels/configs/LlmConfig.tsx`
- Modify: `src/components/panels/NodeConfigPanel.tsx`

- [ ] **Step 4.1: 创建 `src/components/panels/configs/LlmConfig.tsx`**

把 NodeConfigPanel 第 168-287 行（`{/* ===== LLM NODE ===== */}` 整块 JSX）原样迁移，连同其依赖的状态与帮助函数（`showApiKey`、`documents` fetch effect、`selectedProvider`、`handleProviderChange`），并在 temperature/maxTokens 栅格下方加入 maxSteps 行：

```tsx
"use client"

import { useState, useEffect } from "react"
import { useWorkflowStore } from "@/stores/workflow"
import type { WorkflowNode, ExtensionBindings } from "@/types/workflow"
import { PROVIDERS } from "@/lib/providers"
import { useTranslation } from "@/i18n"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Eye, EyeOff, Package } from "lucide-react"
import { ExtensionPicker } from "@/components/extensions/ExtensionPicker"
import { CredentialSelect } from "@/components/panels/CredentialSelect"

interface LlmConfigProps { node: WorkflowNode }

export function LlmConfig({ node }: LlmConfigProps) {
  const { t } = useTranslation()
  const { updateNodeData } = useWorkflowStore()
  const config = (node.data.config as Record<string, unknown>) || {}
  const [showApiKey, setShowApiKey] = useState(false)
  const [documents, setDocuments] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetch("/api/documents").then(r => r.json()).then(setDocuments).catch(() => {})
  }, [])

  const updateConfig = (key: string, value: unknown) => {
    updateNodeData(node.id, { config: { ...config, [key]: value } })
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === (config.provider as string || "openai"))

  const handleProviderChange = (providerId: string | null) => {
    if (!providerId) return
    const provider = PROVIDERS.find((p) => p.id === providerId)
    updateNodeData(node.id, {
      config: { ...config, provider: providerId, model: provider?.models[0]?.id || "", baseUrl: provider?.defaultBaseUrl || "", apiKey: config.apiKey || "" },
    })
  }

  return (
    <div className="space-y-4">
      {/* ↓↓↓ 原 NodeConfigPanel 168-287 行 LLM JSX 整体迁入，做以下两处调整 ↑↓↓ */}
      {/* 调整 1：JSX 内容从「<Select value={(config.provider... 开始到扩展包折叠区 </details> 结束」原样粘贴，缩进去掉最外层多余层级 */}
      {/* 调整 2：在 temperature/maxTokens 的 grid 之后、memory 行之前，插入 maxSteps 行 */}

      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="llm-max-steps" className="text-xs text-muted-foreground">{t("config.agentMaxSteps")}</Label>
          <Input id="llm-max-steps" type="number" min={1} max={20} step={1} className="w-16 h-7 text-xs"
            value={(config.maxSteps as number) ?? 8}
            onChange={(e) => {
              const n = parseInt(e.target.value)
              if (!isNaN(n)) updateConfig("maxSteps", Math.min(Math.max(n, 1), 20))
            }} />
        </div>
        <p className="text-[10px] text-muted-foreground">{t("config.agentMaxStepsHint")}</p>
      </div>
    </div>
  )
}
```

> 说明：迁移后的完整 JSX 里唯一的新增内容即上面 maxSteps 块；其余一行不动（包括 i18n key、结构）。此处不整块重复粘贴原 JSX 是为了避免双源漂移——执行者直接剪切 NodeConfigPanel 现有代码即可。

- [ ] **Step 4.2: 替换 NodeConfigPanel 的 LLM 块**

将第 168-287 行整块替换为：

```tsx
      {/* ===== LLM NODE ===== */}
      {node.data.type === "llm" && <LlmConfig node={node} />}
```

- [ ] **Step 4.3: 清理 NodeConfigPanel 孤儿成员**

删除以下仅为 LLM 块服务的成员与导入：
- `showApiKey` state（`useState(false)` 一行）
- `documents` state 及其 `useEffect(() => { fetch("/api/documents")...})`（保留 hydrate effect）
- `selectedProvider` 常量、`handleProviderChange` 函数
- 导入清理：`PROVIDERS`、`ExternalLink`、`Eye`、`EyeOff` 从各自 import 中移除（其余 icon：Trash2、Package、Download、FolderOpen、X 是否保留以 lint 结果为准）
- `ExtensionPicker` / `CredentialSelect` 导入保留（music 块仍在用 CredentialSelect；ExtensionPicker 若仅 LLM 使用则一并移入 LlmConfig 并删掉此处导入）

- [ ] **Step 4.4: 验证编译与提交**

Run: `npm run typecheck && npm run lint`
Expected: 无错误。若有 unused import 报错，按提示继续清理直至通过。

```bash
git add src/components/panels/configs/LlmConfig.tsx src/components/panels/NodeConfigPanel.tsx
git commit -m "refactor(ui): LLM 配置抽取为独立组件 LlmConfig + 新增循环上限输入"
```

---

### Task 5: i18n 文案同步

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 5.1: zh.json `config` 组内修改/新增**

定位 `"config.functionCalling"`（当前值 `"工具调用（天气查询等）"`），更新并在其附近新增三个键：

```json
    "functionCalling": "内置工具调用（天气查询·示例）",
    "agentMaxSteps": "工具循环上限",
    "agentMaxStepsHint": "单次执行中模型与工具的最大交互轮数（1-20，默认 8）",
```

`historyDetail` 组内新增：

```json
    "toolSteps": "工具调用步骤",
    "argsSummary": "参数",
    "resultSummary": "结果",
```

- [ ] **Step 5.2: en.json 对应组同步**

`config` 组：

```json
    "functionCalling": "Built-in tool calling (weather · example)",
    "agentMaxSteps": "Tool loop limit",
    "agentMaxStepsHint": "Max model-tool interaction rounds per run (1-20, default 8)",
```

`historyDetail` 组：

```json
    "toolSteps": "Tool Call Steps",
    "argsSummary": "Arguments",
    "resultSummary": "Result",
```

- [ ] **Step 5.3: 验证 + 提交**

手动检查两个 JSON 合法（`python3 -m json.tool src/i18n/locales/zh.json > /dev/null && python3 -m json.tool src/i18n/locales/en.json > /dev/null` 应静默通过），然后：

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "i18n: agent maxSteps + 工具调用步骤文案 (zh/en)"
```

---

### Task 6: 执行历史页展示工具步骤明细

**Files:**
- Modify: `src/app/(dashboard)/history/[id]/page.tsx`

- [ ] **Step 6.1: 导入类型**

文件头部 import 区加：

```ts
import type { ToolCallStep } from "@/types/workflow"
```

- [ ] **Step 6.2: 插入 steps 渲染块**

在错误块 `{Boolean(log.error) && (...)}` 之后、输出 IIFE `{(() => { const out = ... })()}` 之前插入：

```tsx
                {Array.isArray(log.steps) && (log.steps as ToolCallStep[]).length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {t("historyDetail.toolSteps")} ({(log.steps as ToolCallStep[]).length})
                    </summary>
                    <div className="mt-1 space-y-1.5 p-2 rounded bg-muted font-mono text-[11px]">
                      {(log.steps as ToolCallStep[]).map((step, idx) => (
                        <details key={idx}>
                          <summary className="flex items-center gap-2 cursor-pointer">
                            <span className="font-semibold">{idx + 1}. {step.toolName}</span>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">{step.durationMs}ms</Badge>
                          </summary>
                          <p className="mt-1 break-all"><span className="text-muted-foreground">{t("historyDetail.argsSummary")}:</span> {step.argsSummary}</p>
                          <p className="break-all"><span className="text-muted-foreground">{t("historyDetail.resultSummary")}:</span> {step.resultSummary}</p>
                        </details>
                      ))}
                    </div>
                  </details>
                )}
```

- [ ] **Step 6.3: 验证 + 提交**

Run: `npm run typecheck`
Expected: 通过（确认 `(dashboard)` 路径分组下的文件被 tsconfig 覆盖）。

```bash
git add "src/app/(dashboard)/history/[id]/page.tsx"
git commit -m "feat(history): 展示 LLM 节点工具调用步骤明细"
```

---

### Task 7: 聊天调试面板显示工具步数

**Files:**
- Modify: `src/stores/chat.ts`
- Modify: `src/components/chat/ChatPanel.tsx`

- [ ] **Step 7.1: 扩展 store 类型**

在 `src/stores/chat.ts` 的 `ExecutionNodeState` 接口中追加可选字段：

```ts
  toolStepCount?: number
```

- [ ] **Step 7.2: ChatPanel 映射与渲染**

(a) `handleSend` 中 `data.logs.map` 的参数类型与返回对象改为：

```ts
      const nodeStates: ExecutionNodeState[] = data.logs.map((log: { nodeId: string; nodeType: string; status: string; output?: { raw?: string }; steps?: Array<{ toolName?: string }> }) => ({
        nodeId: log.nodeId, label: log.nodeType?.toUpperCase() || "Unknown",
        status: log.status as ExecutionNodeState["status"],
        output: log.output?.raw || (log.output ? JSON.stringify(log.output) : undefined),
        toolStepCount: Array.isArray(log.steps) ? log.steps.length : 0,
      }))
```

(b) 文件头部补 lucide 导入（并入现有 lucide-react import）：

```ts
import { Send, Loader2, User, Bot, RefreshCw, Wrench } from "lucide-react"
```

(c) 执行详情卡片的节点行（`{node.label}` 之后）追加：

```tsx
                  {Boolean(node.toolStepCount) && (
                    <span className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Wrench className="h-3 w-3" />×{node.toolStepCount}
                    </span>
                  )}
```

（外层 flex 行已有 `className="flex items-center gap-2 text-xs"`，`ml-auto` 使徽标右对齐。）

- [ ] **Step 7.3: 验证 + 提交**

Run: `npm run typecheck && npm run lint`

```bash
git add src/stores/chat.ts src/components/chat/ChatPanel.tsx
git commit -m "feat(chat): 调试面板 LLM 节点展示工具调用次数"
```

---

### Task 8: 全量回归 + 手动验收清单

- [ ] **Step 8.1: 自动化门禁**

```bash
npm run typecheck && npm run lint && npx vitest run
```
Expected: 全绿（21 个既有测试文件 + 2 个新增/扩充文件均通过）。

- [ ] **Step 8.2: 手动冒烟（需要用户环境：DB 已启动、任一可用 API Key）**

1. `npm run dev:webpack` 启动，打开 http://localhost:3000
2. 编辑器新建工作流：Input(text) → LLM（开启「内置工具调用」，绑定 filesystem pack 或开启天气示例）→ Output
3. LLM 节点配置可见「工具循环上限」默认 8；改小为 3 可保存
4. Chat 面板发送触发执行：完成后执行详情卡内 LLM 行出现 🔧 图标计数（无 emoji 时为扳手图标）
5. 打开 `历史` → 该次执行详情：LLM 卡片出现「工具调用步骤 (N)」折叠区，展开能看到每条的工具名/耗时/参数/结果摘要
6. 语言切换 🌐 到 English：上述新文案均为英文

- [ ] **Step 8.3: 收尾提交（如有遗漏修复）**

```bash
git add -A && git commit -m "chore(agent): phase1 冒烟修复（如有）"
```

---

## Self-Review 结论（已自查）

1. **Spec 覆盖**：§3.1 四项改动 → Task 1/2/3；§3.2 两处 UI → Task 4/6/7；§3.3 测试 → Task 1/2；i18n → Task 5；已知限制记录于 spec 无需任务。✔
2. **占位符扫描**：Task 4 不重贴原 JSX 属有意设计（单一数据源原则，防漂移），且给了精确行号与操作指令，不属于 TBD。✔
3. **类型一致性**：`ToolCallStep{toolName,argsSummary,resultSummary,durationMs}` 在 Task 1 定义，Task 1/2/6 引用一致；`SdkStepLike` 仅 llm-steps 内部暴露给 llm.ts 使用；store 字段 `toolStepCount` 在 7.1/7.2 一致。✔
