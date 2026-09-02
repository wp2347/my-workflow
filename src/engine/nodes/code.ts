import { Worker } from "worker_threads"
import type { NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"

/**
 * ⚠️ 安全声明（spec §6）：基于 new Function / worker_threads 的执行不是强沙箱。
 * 保护层级：
 *   1. 静态检查拒绝 require/import/process/globalThis/eval（字符串匹配，防误用不防恶意混淆）
 *   2. 快路径：主线程 new Function 直接执行（小脚本零开销）
 *   3. 慢路径兜底：含循环/递归特征的脚本放入 worker_threads 执行，
 *      超时后 terminate() 强杀 —— 这是唯一能打断同步死循环的原语
 * 如需文件系统/网络级隔离，未来迁移 isolated-vm（本期明确不引入新依赖）。
 */

const TIMEOUT_MIN_MS = 50
const TIMEOUT_MAX_MS = 30_000
const DEFAULT_TIMEOUT_MS = 3000

/** 含这些特征 → 走 worker 通道（可能长时间占用 CPU 的形态） */
const RISKY_PATTERN = /\b(while|for|do|function|=>)\b|\brecursion\b/

/** 静态检查：命中禁止模式时返回提示文案，否则 null */
export function validateCode(code: string): string | null {
  const rules: Array<[RegExp, string]> = [
    [/\brequire\s*\(/, "require() is forbidden in code nodes"],
    [/\bimport\s*\(\s*['"]/, "dynamic import() is forbidden in code nodes"],
    [/\bimport\s+.+\bfrom\b/, "static import is forbidden in code nodes"],
    [/\bprocess\./, "process access is forbidden in code nodes"],
    [/\bglobalThis\b/, "globalThis access is forbidden in code nodes"],
    [/\beval\s*\(/, "eval() is forbidden in code nodes"],
  ]
  for (const [re, msg] of rules) {
    if (re.test(code)) return msg
  }
  return null
}

/** 主线程直跑（快路径） */
function runOnMainThread(
  code: string,
  ctxData: { input: unknown; items: unknown; query: string },
): unknown {
  const fn = new Function("input", "items", "query", `"use strict";\n${code}`)
  return fn(ctxData.input, ctxData.items, ctxData.query)
}

/** worker 内执行的独立入口源码：接收注入变量，回传 JSON 结果 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("worker_threads");
const { code, input, items, query } = workerData;
try {
  const fn = new Function("input", "items", "query", '"use strict";\\n' + code);
  const result = fn(input, items, query);
  parentPort.postMessage({ ok: true, result });
} catch (e) {
  parentPort.postMessage({ ok: false, name: e && e.name, message: e && e.message });
}
`

/** worker 通道执行，超时 terminate */
function runInWorker(
  code: string,
  ctxData: { input: unknown; items: unknown; query: string },
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: {
        code,
        input: safeClone(ctxData.input),
        items: safeClone(ctxData.items),
        query: ctxData.query,
      },
    })
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      worker.terminate().catch(() => {})
      reject(new Error(`__CODE_TIMEOUT__${timeoutMs}`))
    }, timeoutMs)
    worker.on("message", (msg: { ok: boolean; result?: unknown; name?: string; message?: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (msg.ok) resolve(msg.result)
      else reject(Object.assign(new Error(msg.message || "Script error"), { name: msg.name }))
    })
    worker.on("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

/** structuredClone 不支持函数等，注入变量只可能是 JSON 数据，失败时降级 undefined */
function safeClone(value: unknown): unknown {
  try {
    return structuredClone(value)
  } catch {
    return undefined
  }
}

export const executeCodeNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  // 模板渲染支持在代码里引用上游变量（如 {{ $input.message }}）
  const rawCode = (config.code as string) || ""
  const code = resolveExpression(rawCode, context)

  const violation = validateCode(code)
  if (violation) {
    return { result: null, raw: `forbidden: ${violation}`, error: violation }
  }

  // 组装注入变量：input(工作流输入) + items(上游数组) + query(上游 raw 字符串)
  let upstreamRaw: unknown = undefined
  let upstreamResults: unknown = undefined
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.results !== undefined && upstreamResults === undefined) upstreamResults = obj.results
      if (typeof obj.raw === "string") upstreamRaw = obj.raw
    } else if (typeof output === "string") {
      upstreamRaw = output
    }
  }
  let items: unknown = upstreamResults
  if (items === undefined && typeof upstreamRaw === "string") {
    try {
      const parsed = JSON.parse(upstreamRaw)
      if (Array.isArray(parsed)) items = parsed
    } catch { /* 非 JSON 保持 undefined */ }
  }

  const timeoutMs = Math.min(
    Math.max(Math.round((config.timeoutMs as number) || DEFAULT_TIMEOUT_MS), TIMEOUT_MIN_MS),
    TIMEOUT_MAX_MS,
  )

  const startedAt = Date.now()
  try {
    const ctxData = {
      input: context.input ?? {},
      items: items ?? [],
      query: typeof upstreamRaw === "string" ? upstreamRaw : "",
    }
    const useWorker = RISKY_PATTERN.test(code)
    const result = useWorker
      ? await runInWorker(code, ctxData, timeoutMs)
      : runOnMainThread(code, ctxData)
    const raw = typeof result === "string" ? result : JSON.stringify(result)
    return { result, raw }
  } catch (error) {
    const msg0 = error instanceof Error ? error.message : String(error)
    const timeoutMatch = msg0.match(/__CODE_TIMEOUT__(\d+)/)
    const friendly = timeoutMatch ? `Script timed out after ${timeoutMatch[1]}ms` : msg0
    console.warn(`[code] Execution failed (${Date.now() - startedAt}ms): ${friendly}`)
    // 错误统一降级输出，不中断工作流（与 RAG 节点策略一致）
    return { result: null, raw: friendly, error: friendly }
  }
}
