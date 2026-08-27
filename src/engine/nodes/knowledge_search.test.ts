import { describe, it, expect, vi, beforeEach } from "vitest"
import { executeKnowledgeSearchNode } from "@/engine/nodes/knowledge_search"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

const { searchKnowledge } = vi.hoisted(() => ({ searchKnowledge: vi.fn() }))
vi.mock("@/lib/rag", () => ({ searchKnowledge }))

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "ks-1",
    type: "knowledge_search",
    position: { x: 0, y: 0 },
    data: { type: "knowledge_search", label: "知识库检索", config },
  }
}
function makeCtx(raw?: string): ExecutionContext {
  const ctx: ExecutionContext = {
    workflowId: "wf",
    executionId: "e",
    input: {},
    nodeResults: new Map(),
    logs: [],
  }
  if (raw) ctx.nodeResults.set("input-1", { raw })
  return ctx
}

beforeEach(() => vi.resetAllMocks())

describe("executeKnowledgeSearchNode", () => {
  it("用上游 raw 输出作为查询，返回拼接结果与结构化数组", async () => {
    searchKnowledge.mockResolvedValue([
      { content: "片段一内容", score: 0.2, documentName: "手册" },
      { content: "片段二内容", score: 0.4, documentName: "FAQ" },
    ])

    const out = await executeKnowledgeSearchNode(makeNode({ topK: 3 }), makeCtx("如何部署？")) as Record<string, unknown>

    expect(searchKnowledge).toHaveBeenCalledWith("如何部署？", 3)
    expect(out.raw).toContain("[1] 手册")
    expect(out.raw).toContain("片段一内容")
    expect(out.results).toHaveLength(2)
  })

  it("queryTemplate 非空时优先于上游输出", async () => {
    searchKnowledge.mockResolvedValue([])
    await executeKnowledgeSearchNode(
      makeNode({ topK: 5, queryTemplate: "产品价格 {{ $input.message }}" }),
      makeCtx("无关内容"),
    )
    expect(searchKnowledge).toHaveBeenCalledWith("产品价格 {{ $input.message }}", 5)
  })

  it("无查询来源（无模板、无上游）时不调用检索并提示", async () => {
    const out = await executeKnowledgeSearchNode(makeNode({ topK: 3 }), makeCtx()) as Record<string, unknown>
    expect(searchKnowledge).not.toHaveBeenCalled()
    expect(out.error).toBeTruthy()
    expect(out.results).toEqual([])
  })

  it("检索抛错时降级为错误信息而非中断工作流", async () => {
    searchKnowledge.mockRejectedValue(new Error("embedding down"))
    const out = await executeKnowledgeSearchNode(makeNode({ topK: 3 }), makeCtx("q")) as Record<string, unknown>
    expect(out.error).toContain("embedding down")
    expect(out.results).toEqual([])
  })

  it("topK 缺省回落 3 且 clamp 到 1-20", async () => {
    searchKnowledge.mockResolvedValue([])
    await executeKnowledgeSearchNode(makeNode({ topK: 999 }), makeCtx("q"))
    expect(searchKnowledge).toHaveBeenCalledWith("q", 20)
  })
})
