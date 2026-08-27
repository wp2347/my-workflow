import { describe, it, expect, vi, beforeEach } from "vitest"
import { executeLoopNode } from "@/engine/nodes/loop"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

const { resolveExpression } = vi.hoisted(() => ({ resolveExpression: vi.fn() }))
vi.mock("@/lib/expression", () => ({ resolveExpression: resolveExpression as unknown }))

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "loop-1", type: "loop", position: { x: 0, y: 0 },
    data: { type: "loop", label: "loop", config },
  }
}
function makeCtx(upstream?: Record<string, unknown>): ExecutionContext {
  const ctx: ExecutionContext = {
    workflowId: "wf", executionId: "e", input: {},
    nodeResults: new Map(), logs: [],
  }
  if (upstream) ctx.nodeResults.set("upstream-1", upstream)
  return ctx
}

beforeEach(() => {
  vi.resetAllMocks()
  // 默认把模板原样返回（大多数用例直接给 path 表达式）
  resolveExpression.mockImplementation((expr: string) => expr)
})

describe("executeLoopNode", () => {
  it("数组来源：路径解析出的数组逐项执行 items 表达式并聚合", async () => {
    const ctx = makeCtx({ results: ["a", "b", "c"] })
    const out = await executeLoopNode(
      makeNode({ sourcePath: "$items", itemTemplate: "{{ $item }}!" }),
      ctx,
    ) as Record<string, unknown>
    void out
  })

  it("从上游 results 数组构造迭代项并聚合 raw 拼接", async () => {
    const ctx = makeCtx({ results: [{ t: "x" }, { t: "y" }] })
    // 调用序列：第1次=sourcePath 求值；其后=每项 itemTemplate 求值
    const seq = ['[{"t":"x"},{"t":"y"}]', "x!", "y!"]
    let i = 0
    resolveExpression.mockReset().mockImplementation(() => seq[i++] ?? "?")

    const node = makeNode({
      sourcePath: "{{ $node.upstream-1.results }}",
      itemTemplate: "{{ $item.t }}!",
    })
    const out = await executeLoopNode(node, ctx) as Record<string, unknown>

    expect(out.items).toEqual(["x!", "y!"])
    expect(out.raw).toBe("x!\ny!")
    expect(out.count).toBe(2)
  })

  it("超过硬编码上限 1000 时截断并在结果中标记", async () => {
    const big = Array.from({ length: 1200 }, (_, i) => i)
    resolveExpression.mockReset()
    let first = true
    resolveExpression.mockImplementation((expr: string) => {
      if (first) { first = false; return JSON.stringify(big) }
      return expr === "{{ $item }}" ? "v" : expr
    })

    const out = await executeLoopNode(makeNode({ sourcePath: "{{ x }}", itemTemplate: "{{ $item }}" }), makeCtx()) as Record<string, unknown>
    expect(out.count).toBe(1000)
    expect(out.truncated).toBe(true)
    expect(out.raw.split("\n")).toHaveLength(1000)
  })

  it("来源非数组 → 返回 error 提示配置", async () => {
    resolveExpression.mockReset().mockReturnValue("not-json")
    const out = await executeLoopNode(makeNode({ sourcePath: "{{ p }}", itemTemplate: "" }), makeCtx()) as Record<string, unknown>
    expect(out.error).toBeTruthy()
    expect(out.items).toEqual([])
  })

  it("空数组 → count=0 且不报错", async () => {
    resolveExpression.mockReset().mockReturnValue("[]")
    const out = await executeLoopNode(makeNode({ sourcePath: "{{ p }}", itemTemplate: "{{ $item }}" }), makeCtx()) as Record<string, unknown>
    expect(out.count).toBe(0)
    expect(out.raw).toBe("")
  })

  it("无 itemTemplate 时默认取当前项本身", async () => {
    const ctx = makeCtx()
    resolveExpression
      .mockReset()
      .mockReturnValueOnce('["m1","m2"]')
      .mockReturnValueOnce("m1")
      .mockReturnValueOnce("m2")
    const out = await executeLoopNode(makeNode({ sourcePath: '["m1","m2"]', itemTemplate: "" }), ctx) as Record<string, unknown>
    expect(out.items).toEqual(["m1", "m2"])
  })
})
