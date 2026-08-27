import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { executeLLMNode } from "@/engine/nodes/llm"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

const { resolveCredentialValue } = vi.hoisted(() => ({ resolveCredentialValue: vi.fn() }))
const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))

vi.mock("@/lib/credential", () => ({ resolveCredentialValue }))
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return { ...actual, generateText }
})

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "llm-1",
    type: "llm",
    position: { x: 0, y: 0 },
    data: { type: "llm", label: "llm", config },
  }
}
function makeCtx(): ExecutionContext {
  const ctx: ExecutionContext = {
    workflowId: "wf",
    executionId: "e",
    input: {},
    nodeResults: new Map(),
    logs: [],
  }
  ctx.nodeResults.set("input-1", { prompt: "hi", raw: "hi" })
  return ctx
}

describe("executeLLMNode credential resolution", () => {
  beforeEach(() => {
    // vitest.setup.ts 设置了 OPENAI_API_KEY=test-key，这里清空以保证
    // 「无 env key → 抛 No API key」的分支可被验证
    vi.stubEnv("OPENAI_API_KEY", "")
    vi.resetAllMocks()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("credentialId 存在 → 凭证值作为 API key（不抛 No API key，进入 generateText）", async () => {
    resolveCredentialValue.mockResolvedValue("cred-key")
    generateText.mockRejectedValue(new Error("AI SDK network call failed (mocked)"))
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", credentialId: "cred-1" })

    await expect(executeLLMNode(node, makeCtx())).rejects.toThrow(/AI SDK network call failed/)
    expect(resolveCredentialValue).toHaveBeenCalledWith("cred-1")
    expect(generateText).toHaveBeenCalled()
  })

  it("credentialId 存在但凭证缺失 → 抛 Credential not found（在 key 检查之前）", async () => {
    resolveCredentialValue.mockResolvedValue(null)
    generateText.mockRejectedValue(new Error("AI SDK network call failed (mocked)"))
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", credentialId: "cred-missing" })

    await expect(executeLLMNode(node, makeCtx())).rejects.toThrow(/Credential not found: cred-missing/)
    expect(generateText).not.toHaveBeenCalled()
  })

  it("credentialId 为空 → 走原逻辑（无 env key 时抛明确的厂商 Key 缺失错误）", async () => {
    resolveCredentialValue.mockResolvedValue(null)
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", credentialId: "" })

    await expect(executeLLMNode(node, makeCtx())).rejects.toThrow(/未找到 OpenAI 的 API Key/)
    expect(resolveCredentialValue).not.toHaveBeenCalled()
    expect(generateText).not.toHaveBeenCalled()
  })
})

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

  it("enableTools 开启时注册内置示例工具并透传 clamp 后的 maxSteps", async () => {
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
