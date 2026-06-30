import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderPrompts } from "@/engine/extensions/prompt-renderer"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prompt: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import type { ExecutionContext } from "@/types/workflow"

const mockContext: ExecutionContext = {
  workflowId: "wf1",
  executionId: "ex1",
  input: { topic: "AI", role: "分析师" },
  nodeResults: new Map([["llm1", { text: "上游内容", raw: "上游内容" }]]),
  logs: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("renderPrompts", () => {
  it("空 promptIds 返回空 payload", async () => {
    const result = await renderPrompts([], mockContext)
    expect(result.systemPrompts).toEqual([])
    expect(result.userPrompts).toEqual([])
  })

  it("role=system 的 prompt 注入 systemPrompts", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: "p1", name: "分析", content: "你是{{role}}", role: "system", variables: [{ name: "role", defaultValue: "助手" }] },
    ] as never)

    const result = await renderPrompts(["p1"], mockContext)
    expect(result.systemPrompts).toHaveLength(1)
    expect(result.systemPrompts[0]).toContain("你是分析师")
    expect(result.userPrompts).toEqual([])
  })

  it("role=user 的 prompt 注入 userPrompts", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: "p2", name: "用户提示", content: "请分析{{$input.topic}}", role: "user", variables: [] },
    ] as never)

    const result = await renderPrompts(["p2"], mockContext)
    expect(result.userPrompts).toHaveLength(1)
    expect(result.userPrompts[0]).toContain("请分析AI")
  })

  it("变量用 defaultValue 当 input 中无值", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: "p3", name: "P", content: "角色:{{myRole}}", role: "system", variables: [{ name: "myRole", defaultValue: "默认角色" }] },
    ] as never)

    const result = await renderPrompts(["p3"], mockContext)
    expect(result.systemPrompts[0]).toContain("角色:默认角色")
  })

  it("悬空 ID → warn + 跳过", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([])
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await renderPrompts(["nonexistent"], mockContext)
    expect(result.systemPrompts).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
