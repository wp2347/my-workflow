import { describe, it, expect } from "vitest"
import { truncateForSummary, assembleToolCallSteps } from "@/engine/nodes/llm-steps"

describe("truncateForSummary", () => {
  it("短值原样返回", () => {
    expect(truncateForSummary({ a: 1 })).toBe('{"a":1}')
    expect(truncateForSummary(undefined)).toBe("")
  })

  it("超过 500 字符截断并追加省略号", () => {
    const long = "x".repeat(600)
    const out = truncateForSummary(long)
    expect(out.length).toBe(501)
    expect(out.endsWith("…")).toBe(true)
    expect(out.startsWith("x")).toBe(true)
  })
})

describe("assembleToolCallSteps", () => {
  it("按 SDK steps 装配 ToolCallStep，且按工具名 FIFO 消耗耗时（同名多次调用按顺序消耗）", () => {
    const t = new Map<string, number[]>([["read_file", [12, 34]]])
    const sdkSteps = [
      {
        content: [],
        toolCalls: [{ toolName: "list_directory", input: { path: "/d" } }],
        toolResults: [{ toolName: "list_directory", output: ["a.md"] }],
      },
      {
        content: [],
        toolCalls: [
          { toolName: "read_file", input: { path: "/d/a.md" } },
          { toolName: "read_file", input: { path: "/d/b.md" } },
        ],
        toolResults: [
          { toolName: "read_file", output: "AAA" },
          { toolName: "read_file", output: "BBB" },
        ],
      },
    ]
    const { steps, toolCalls } = assembleToolCallSteps(sdkSteps, t)

    expect(steps).toHaveLength(3)
    expect(steps[0]).toEqual({
      toolName: "list_directory",
      argsSummary: '{"path":"/d"}',
      resultSummary: '["a.md"]',
      durationMs: 0, // 未记录耗时的工具回落 0
    })
    expect(steps[1].durationMs).toBe(12)
    expect(steps[2].durationMs).toBe(34)
    expect(toolCalls.map((c) => c.name)).toEqual(["list_directory", "read_file", "read_file"])
  })

  it("toolResults 缺失时结果摘要为空串且不抛错", () => {
    const sdkSteps = [
      { content: [], toolCalls: [{ toolName: "broken_tool", input: {} }], toolResults: [] },
    ]
    const { steps } = assembleToolCallSteps(sdkSteps, new Map())
    expect(steps[0].resultSummary).toBe("")
    expect(steps[0].durationMs).toBe(0)
  })

  it("无 toolCalls 的纯文本 step 被跳过", () => {
    const sdkSteps = [{ content: [{ type: "text", text: "hi" }] }]
    const { steps, toolCalls } = assembleToolCallSteps(sdkSteps, new Map())
    expect(steps).toHaveLength(0)
    expect(toolCalls).toHaveLength(0)
  })
})
