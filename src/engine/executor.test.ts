import { describe, it, expect, beforeEach, vi } from "vitest"
import { topologicalSort, executeWorkflow } from "@/engine/executor"
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow"

const { prisma } = vi.hoisted(() => ({
  prisma: { workflow: { findUnique: vi.fn().mockResolvedValue({ config: {} }) } },
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

function node(id: string, type: string): WorkflowNode {
  return {
    id, type: type as WorkflowNode["type"],
    position: { x: 0, y: 0 },
    data: { type: type as WorkflowNode["type"], label: id, config: {} },
  }
}
function edge(id: string, source: string, target: string, sourceHandle?: string): WorkflowEdge {
  return { id, source, target, ...(sourceHandle ? { sourceHandle } : {}) }
}

describe("topologicalSort", () => {
  it("返回正确的 DAG 拓扑序（依赖在前）", () => {
    const nodes = [node("c", "output"), node("a", "input"), node("b", "llm")]
    const edges = [edge("1", "a", "b"), edge("2", "b", "c")]
    const order = topologicalSort(nodes, edges).map((n) => n.id)
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"))
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"))
    expect(order.length).toBe(3)
  })

  it("并行分支任务均被执行", () => {
    const nodes = [node("root", "input"), node("l1", "llm"), node("l2", "llm"), node("out", "output")]
    const edges = [edge("1", "root", "l1"), edge("2", "root", "l2"), edge("3", "l1", "out"), edge("4", "l2", "out")]
    const order = topologicalSort(nodes, edges)
    expect(new Set(order.map((n) => n.id))).toEqual(new Set(["root", "l1", "l2", "out"]))
  })

  it("自环/DAG 破坏时返回可排序的部分（不挂死；自环节点因入度不为 0 被丢弃）", () => {
    const nodes = [node("a", "input")]
    const edges = [edge("1", "a", "a")]
    const order = topologicalSort(nodes, edges)
    expect(order.length).toBe(0) // 自环节点无法入队被丢弃，但绝不挂死
  })

  it("完全空图返回空数组", () => {
    expect(topologicalSort([], [])).toEqual([])
  })
})

describe("executeWorkflow 集成", () => {
  beforeEach(() => vi.resetAllMocks())

  it("Input → Output 跑通，logs 完成且 output 透传", async () => {
    prisma.workflow.findUnique.mockResolvedValue({ config: {} })
    const input = node("in", "input")
    const out = node("out", "output")
    input.data.config = { name: "msg", type: "text", required: true }
    const result = await executeWorkflow([input, out], [edge("e1", "in", "out")], { msg: "hi" }, "wf", "ex")
    expect(result.status).toBe("completed")
    expect(result.logs).toHaveLength(2)
    expect(result.logs.every((l) => l.status === "completed")).toBe(true)
    expect((result.output as Record<string, unknown>).output).toBe("hi")
  })

  it("条件节点：false 分支被跳过", async () => {
    prisma.workflow.findUnique.mockResolvedValue({ config: {} })
    const inNode = node("in", "input")
    inNode.data.config = { name: "msg", type: "text" }
    const cond = node("cond", "condition")
    cond.data.config = { left: "no", operator: "==", right: "yes" } // false
    const yes = node("yes", "output")
    const no = node("no_", "output")
    const result = await executeWorkflow(
      [inNode, cond, yes, no],
      [
        edge("e1", "in", "cond"),
        edge("e2", "cond", "yes", "true"),
        edge("e3", "cond", "no", "false"),
      ],
      { msg: "x" }, "wf", "ex",
    )
    // condition=false → 走 false 分支的节点 no_ 被执行
    const executed = result.logs.map((l) => l.nodeId)
    expect(executed).toContain("no_")
    expect(executed).not.toContain("yes")
  })

  it("取消嵌套：错误节点失败后工作流标记 failed", async () => {
    prisma.workflow.findUnique.mockResolvedValue({ config: {} })
    // vitest.setup 默认注入 OPENAI_API_KEY=test-key；清空以触发 LLM 抛「未找到 Key」
    vi.stubEnv("OPENAI_API_KEY", "")
    try {
      const inNode = node("in", "input")
      inNode.data.config = { name: "msg" }
      const llm = node("llm", "llm")
      llm.data.config = { provider: "openai", model: "gpt-4o-mini", apiKey: "", credentialId: "" }
      const result = await executeWorkflow([inNode, llm], [edge("e1", "in", "llm")], { msg: "hi" }, "wf", "ex")
      expect(result.status).toBe("failed")
      expect(result.logs.some((l) => l.status === "failed")).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})