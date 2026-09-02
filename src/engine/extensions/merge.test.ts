import { describe, it, expect } from "vitest"
import { mergeExtensions } from "@/engine/extensions/merge"
import type { ExtensionBindings } from "@/types/workflow"

describe("mergeExtensions", () => {
  it("工作流级有值,节点级为空 → 用工作流级", () => {
    const wf: ExtensionBindings = { skills: ["s1", "s2"], prompts: ["p1"], mcp: [] }
    const result = mergeExtensions(wf, {})
    expect(result.skills).toEqual(["s1", "s2"])
    expect(result.prompts).toEqual(["p1"])
  })

  it("节点级非空 → 覆盖工作流级", () => {
    const wf: ExtensionBindings = { skills: ["s1", "s2"], prompts: ["p1"], mcp: [] }
    const nodeConfig = { extensions: { skills: ["s3"], prompts: [], mcp: [] } }
    const result = mergeExtensions(wf, nodeConfig)
    expect(result.skills).toEqual(["s3"])
    expect(result.prompts).toEqual([])
  })

  it("工作流级 undefined,节点级为空 → 返回空绑定", () => {
    const result = mergeExtensions(undefined, {})
    expect(result.skills).toEqual([])
    expect(result.prompts).toEqual([])
    expect(result.mcp).toEqual([])
  })

  it("节点级 mcp 非空 → 覆盖工作流级 mcp", () => {
    const wf: ExtensionBindings = { skills: [], prompts: [], mcp: [{ serverId: "srv1", tools: "all" }] }
    const nodeConfig = { extensions: { skills: [], prompts: [], mcp: [{ serverId: "srv2", tools: ["t1"] }] } }
    const result = mergeExtensions(wf, nodeConfig)
    expect(result.mcp).toHaveLength(1)
    expect("serverId" in result.mcp[0] && result.mcp[0].serverId).toBe("srv2")
  })
})
