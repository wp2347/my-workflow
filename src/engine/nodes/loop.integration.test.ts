import { describe, it, expect } from "vitest"
import { executeLoopNode } from "@/engine/nodes/loop"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

// 注意：此集成测试故意不 mock resolveExpression，
// 走真实解析器验证 {{ $item }} 语法端到端可用（regression: loop 曾因解析器无 $item 支持而失效）

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "loop-1", type: "loop", position: { x: 0, y: 0 },
    data: { type: "loop", label: "loop", config },
  }
}
function makeCtx(): ExecutionContext {
  return {
    workflowId: "wf", executionId: "e", input: {},
    nodeResults: new Map(), logs: [],
  }
}

describe("executeLoopNode × 真实 resolveExpression", () => {
  it("$item 取当前项：字符串数组逐项处理", async () => {
    const out = await executeLoopNode(
      makeNode({ sourcePath: '["a","b","c"]', itemTemplate: "{{ $item }}!" }),
      makeCtx(),
    ) as Record<string, unknown>
    expect(out.items).toEqual(["a!", "b!", "c!"])
    expect(out.raw).toBe("a!\nb!\nc!")
  })

  it("$item.field 取对象项字段", async () => {
    const src = JSON.stringify([{ t: "x" }, { t: "y" }])
    const out = await executeLoopNode(
      makeNode({ sourcePath: src, itemTemplate: "{{ $item.t }}-{{ $item.t }}" }),
      makeCtx(),
    ) as Record<string, unknown>
    expect(out.items).toEqual(["x-x", "y-y"])
  })

  it("缺省绑定仍可解析（默认 {{ $item }}）", async () => {
    const out = await executeLoopNode(
      makeNode({ sourcePath: '["single"]', itemTemplate: "" }),
      makeCtx(),
    ) as Record<string, unknown>
    expect(out.items).toEqual(["single"])
  })

  it("数字项也能求值", async () => {
    const out = await executeLoopNode(
      makeNode({ sourcePath: "[1,2,3]", itemTemplate: "v={{ $item }}" }),
      makeCtx(),
    ) as Record<string, unknown>
    expect(out.items).toEqual(["v=1", "v=2", "v=3"])
  })

  it("sourcePath 引用上游 results 数组", async () => {
    const ctx = makeCtx()
    ctx.nodeResults.set("input-1", { results: [10, 20] })
    const out = await executeLoopNode(
      makeNode({ sourcePath: "{{ $node.input-1.results }}", itemTemplate: "{{ $item }}" }),
      ctx,
    ) as Record<string, unknown>
    expect(out.items).toEqual(["10", "20"])
  })
})