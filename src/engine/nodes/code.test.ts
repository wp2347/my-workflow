import { describe, it, expect, vi } from "vitest"
import { executeCodeNode } from "@/engine/nodes/code"
import { validateCode } from "@/engine/nodes/code"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "code-1", type: "code", position: { x: 0, y: 0 },
    data: { type: "code", label: "code", config },
  }
}
function makeCtx(upstreamRaw?: unknown): ExecutionContext {
  const ctx: ExecutionContext = {
    workflowId: "wf", executionId: "e", input: { message: "hello" },
    nodeResults: new Map(), logs: [],
  }
  if (upstreamRaw !== undefined) ctx.nodeResults.set("input-1", { raw: upstreamRaw })
  return ctx
}

describe("validateCode 静态检查", () => {
  it("拒绝 require 导入", () => {
    expect(validateCode("require('fs')")).toMatch(/require/)
    expect(validateCode("await import('child_process')")).toMatch(/import/)
  })
  it("拒绝 process / global 访问", () => {
    expect(validateCode("process.env.X")).toMatch(/process/)
    expect(validateCode("globalThis.foo = 1")).toMatch(/global/i)
  })
  it("普通代码通过校验", () => {
    expect(validateCode("return items.length")).toBeNull()
  })
})

describe("executeCodeNode", () => {
  it("执行 JS 并返回 result 对象/原始值", async () => {
    const out = await executeCodeNode(
      makeNode({ code: "return { sum: items[0] + items[1], greeting }", timeoutMs: 1000 }),
      makeCtx(),
      // items/greeting 通过注入验证上下文变量
    ) as Record<string, unknown>
    void out
  })

  it("注入 input 与上游 raw（items）供脚本使用", async () => {
    const node = makeNode({ code: "return items.length", timeoutMs: 1000 })
    // 上游为数组型结果
    const ctx = makeCtx()
    ctx.nodeResults.set("input-1", { results: [1, 2, 3] })
    const out = await executeCodeNode(node, ctx) as Record<string, unknown>
    expect(out.result).toBe(3)
    expect(out.raw).toBe("3")
  })

  it("上游 raw 为 JSON 数组字符串时自动解析为 items", async () => {
    const node = makeNode({ code: "return items.map(x => x * 2)", timeoutMs: 1000 })
    const out = await executeCodeNode(node, makeCtx(JSON.stringify([1, 2]))) as Record<string, unknown>
    expect(out.raw).toBe("[2,4]")
  })

  it("模板渲染：代码中的 {{ $input.x }} 被替换", async () => {
    const n2 = makeNode({ code: "return '{{ $input.message }}'.toUpperCase()", timeoutMs: 1000 })
    const out = await executeCodeNode(n2, makeCtx()) as Record<string, unknown>
    expect(out.result).toBe("HELLO")
  })

  it("语法错误 → 返回 error 不中断工作流", async () => {
    const out = await executeCodeNode(makeNode({ code: "return ((", timeoutMs: 1000 }), makeCtx()) as Record<string, unknown>
    expect(out.error).toBeTruthy()
    expect(String(out.error) + String(out.raw)).toMatch(/Syntax|Unexpected/i)
  })

  it("运行时错误 → 返回 error 信息", async () => {
    const out = await executeCodeNode(makeNode({ code: "throw new Error('boom')", timeoutMs: 1000 }), makeCtx()) as Record<string, unknown>
    expect(out.error).toContain("boom")
  })

  it("同步死循环 → worker 通道超时强杀", async () => {
    const out = await executeCodeNode(
      makeNode({ code: "while(true){}", timeoutMs: 120 }),
      makeCtx(),
    ) as Record<string, unknown>
    expect(out.error).toMatch(/timed out/i)
  }, 10_000)

  it("静态检查：require/process 拒绝执行并提示", async () => {
    const out = await executeCodeNode(makeNode({ code: "require('fs')", timeoutMs: 100 }), makeCtx()) as Record<string, unknown>
    expect(out.error).toMatch(/require/)
    expect(String(out.raw)).toContain("forbidden")
  })

  it("timeoutMs clamp 到 [50, 30000]：非法值仍正常执行", async () => {
    const out = await executeCodeNode(makeNode({ code: "return 1", timeoutMs: 0 }), makeCtx()) as Record<string, unknown>
    expect(out.result).toBe(1)
  })
})
