import type { ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"
import { getByPath } from "@/lib/json-path"

/** spec §6 硬性要求：迭代上限硬编码，防死循环/资源失控 */
const MAX_ITERATIONS = 1000

/**
 * sourcePath 形式：
 *   1. {{ $node.<id>.<field> }}  /  {{ $node["<id>"].<field> }}  → 直接读上游节点原始值（结构化引用，避免文本管道 String() 拍平数组）
 *   2. 裸 JSON 数组字符串（如 ["a","b"]）                        → 文本管道 JSON.parse 兜底
 * 优先结构化引用，保证数组/对象原样传入。
 */
function resolveArraySource(sourcePath: string, context: ExecutionContext): unknown {
  const trimmed = sourcePath.trim()
  const m = trimmed.match(/^\{\{\s*\$node\s*(?:\.([A-Za-z0-9_-]+)|\[\s*"([^"]+)"\s*\])\s*\.(.+?)\s*\}\}$/)
  if (m) {
    const id = m[1] || m[2]
    const value = getByPath(context.nodeResults.get(id), m[3])
    if (value !== undefined) return value
  }
  // 兜底：文本表达式 → JSON.parse
  const resolved = resolveExpression(sourcePath, context)
  try {
    const parsed = JSON.parse(resolved)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * loop/iteration 节点执行器。
 * - 数组来源：sourcePath（结构化节点引用或 JSON 数组字符串）
 * - 每项以 $item 变量进入 itemTemplate 表达式求值
 * - 聚合输出：items[]（逐项结果）+ raw（换行拼接）+ count + truncated 标记
 * 当前实现为「逐项表达式映射」：executor 上下文无子图信息，无法重放下游节点，
 * 后续若引入子流程重放可无缝替换 map 内核，聚合契约不变。
 */
export const executeLoopNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const sourcePath = (config.sourcePath as string) || ""
  const itemTemplate = (config.itemTemplate as string) || "{{ $item }}"

  const source = resolveArraySource(sourcePath, context)

  if (!Array.isArray(source)) {
    return {
      items: [],
      raw: "",
      count: 0,
      error: "Loop source is not an array: configure sourcePath to reference an array (e.g. upstream results or a JSON array)",
    }
  }

  const bounded = source.slice(0, MAX_ITERATIONS)
  const items: unknown[] = []
  for (const item of bounded) {
    // 将当前项注入临时上下文：克隆并把 $item 放入 input 以复用表达式解析器
    const itemCtx: ExecutionContext = {
      ...context,
      input: { ...(context.input ?? {}), item },
    }
    items.push(resolveExpression(itemTemplate, itemCtx))
  }

  return {
    items,
    raw: items.map(String).join("\n"),
    count: items.length,
    truncated: source.length > MAX_ITERATIONS ? true : undefined,
  }
}
