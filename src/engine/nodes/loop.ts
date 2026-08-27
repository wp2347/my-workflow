import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"

/** spec §6 硬性要求：迭代上限硬编码，防死循环/资源失控 */
const MAX_ITERATIONS = 1000

/**
 * loop/iteration 节点执行器。
 * - 数组来源：sourcePath 表达式（可为 JSON 字符串或上游数组引用）解析出的数组
 * - 每项以 $item 变量进入 itemTemplate 表达式求值
 * - 聚合输出：items[]（逐项结果）+ raw（换行拼接）+ count + truncated 标记
 * 当前实现为「逐项表达式映射」：executor 上下文无子图信息，无法重放下游节点，
 * 后续若引入子流程重放可无缝替换 map 内核，聚合契约不变。
 */
export const executeLoopNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const sourcePath = (config.sourcePath as string) || ""
  const itemTemplate = (config.itemTemplate as string) || "{{ $item }}"

  // 解析数组来源
  let source: unknown = undefined
  if (sourcePath.trim()) {
    const resolved = resolveExpression(sourcePath, context)
    try {
      const parsed = typeof resolved === "string" ? JSON.parse(resolved) : resolved
      if (Array.isArray(parsed)) source = parsed
    } catch {
      // 路径解析可能直接返回数组对象；JSON 失败则保持 undefined
      if (Array.isArray(resolved)) source = resolved
    }
  }

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
