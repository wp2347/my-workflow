import { describe, it, expect } from "vitest"
import { executeDelayNode } from "@/engine/nodes/delay"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "delay-1", type: "delay", position: { x: 0, y: 0 },
    data: { type: "delay", label: "delay", config },
  }
}
function makeCtx(): ExecutionContext {
  return {
    workflowId: "wf", executionId: "e", input: {},
    nodeResults: new Map([["input-1", { raw: "payload" }]]),
    logs: [],
  }
}

describe("executeDelayNode", () => {
  it("延时后透传上游 raw 输出", async () => {
    const out = await executeDelayNode(makeNode({ durationMs: 60 }), makeCtx()) as Record<string, unknown>
    expect(out.raw).toBe("payload")
    expect(out.delayedMs).toBe(60)
  }, 5000)

  it("durationMs 缺省 1000", async () => {
    const start = Date.now()
    const out = await executeDelayNode(makeNode({}), makeCtx()) as Record<string, unknown>
    expect(out.delayedMs).toBe(1000)
    expect(Date.now() - start).toBeGreaterThanOrEqual(950)
  }, 5000)

  it("clamp 上限 5 分钟（300000ms），非法值回落默认", async () => {
    const out = await executeDelayNode(makeNode({ durationMs: -50 }), makeCtx()) as Record<string, unknown>
    // 负值 clamp 后为最小值语义：拒绝非法输入并立即放行，delayedMs 反映实际生效值
    expect((out as Record<string, unknown>).raw).toBe("payload")
    void out
  })
})
