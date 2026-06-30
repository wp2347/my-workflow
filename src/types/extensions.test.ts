import { describe, it, expect, expectTypeOf } from "vitest"
import type { ExtensionBindings, McpBinding } from "@/types/workflow"
import type { ExecutionContext } from "@/types/workflow"

describe("ExtensionBindings 类型", () => {
  it("McpBinding 可构造并携带 serverId + tools", () => {
    const binding: McpBinding = {
      serverId: "srv1",
      tools: ["get_weather"],
      resources: ["file:///data.json"],
      prompts: [],
    }
    expect(binding.serverId).toBe("srv1")
    expect(binding.tools).toEqual(["get_weather"])
  })

  it("McpBinding tools 可为 'all'", () => {
    const binding: McpBinding = { serverId: "srv2", tools: "all" }
    expect(binding.tools).toBe("all")
  })

  it("ExtensionBindings 可构造", () => {
    const ext: ExtensionBindings = {
      skills: ["s1", "s2"],
      prompts: ["p1"],
      mcp: [{ serverId: "srv1", tools: "all", resources: [], prompts: [] }],
    }
    expect(ext.skills).toHaveLength(2)
  })

  it("ExecutionContext 包含 workflowExtensions 可选字段", () => {
    const ctx: ExecutionContext = {
      workflowId: "wf1",
      executionId: "ex1",
      input: {},
      nodeResults: new Map(),
      logs: [],
      workflowExtensions: { skills: [], prompts: [], mcp: [] },
    }
    expect(ctx.workflowExtensions?.skills).toEqual([])
  })
})
