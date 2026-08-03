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
    vi.clearAllMocks()
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

  it("credentialId 为空 → 走原逻辑（无 env key 时抛 No API key）", async () => {
    resolveCredentialValue.mockResolvedValue(null)
    generateText.mockRejectedValue(new Error("AI SDK network call failed (mocked)"))
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", credentialId: "" })

    await expect(executeLLMNode(node, makeCtx())).rejects.toThrow(/No API key/)
    expect(resolveCredentialValue).not.toHaveBeenCalled()
    expect(generateText).not.toHaveBeenCalled()
  })
})
