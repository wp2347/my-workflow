import { describe, it, expect } from "vitest"
import { executeInputNode } from "@/engine/nodes/input"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "input-1", type: "input", position: { x: 0, y: 0 },
    data: { type: "input", label: "input", config },
  }
}
function makeCtx(runtimeInput: Record<string, unknown>): ExecutionContext {
  return {
    workflowId: "wf", executionId: "e", input: runtimeInput,
    nodeResults: new Map(), logs: [],
  }
}

describe("executeInputNode", () => {
  it("file 类型：优先使用选中的路径（config.default），不被运行时 message 覆盖", async () => {
    const node = makeNode({ name: "message", type: "file", default: "/data/report.md" })
    const out = await executeInputNode(node, makeCtx({ message: "manual-test" })) as Record<string, unknown>
    expect(out.message).toBe("/data/report.md")
    expect(out.raw).toBe("/data/report.md")
  })

  it("file 类型：未选中路径时回退运行时输入", async () => {
    const node = makeNode({ name: "message", type: "file" })
    const out = await executeInputNode(node, makeCtx({ message: "fallback" })) as Record<string, unknown>
    expect(out.message).toBe("fallback")
  })

  it("非 file 类型：仍优先运行时输入（原行为不变）", async () => {
    const node = makeNode({ name: "message", type: "text", default: "default-val" })
    const out = await executeInputNode(node, makeCtx({ message: "runtime" })) as Record<string, unknown>
    expect(out.message).toBe("runtime")
  })

  it("非 file 类型：无运行时输入时用默认值", async () => {
    const node = makeNode({ name: "message", type: "text", default: "default-val" })
    const out = await executeInputNode(node, makeCtx({})) as Record<string, unknown>
    expect(out.message).toBe("default-val")
  })
})
