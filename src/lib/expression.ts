import type { ExecutionContext } from "@/types/workflow"
import { getByPath } from "@/lib/json-path"

/**
 * 统一表达式解析器
 *
 * 支持语法：
 *   {{ $input.field }}         — 工作流输入变量
 *   {{ $env.VAR_NAME }}        — 环境变量
 *   {{ $node["nodeId"].field }} — 任意节点输出
 *   {{ $node.nodeId.field }}   — 同上（简写）
 *   {{ nodeId.field }}         — 直接引用节点输出
 *   {{ $json.path.to.field }}  — JSONPath（从最后节点的输出中提取）
 *   {{ text }}                  — 从最近节点的输出中按字段名查找
 *   {{ $now }}                  — 当前 ISO 时间戳
 *   {{ date-7d }}               — 7天前日期(YYYY-MM-DD)
 */
export { getByPath }

function resolveNodeOutput(context: ExecutionContext, nodeId: string, field: string): unknown {
  const output = context.nodeResults.get(nodeId)
  if (!output) return undefined
  if (!field) return output
  return getByPath(output, field)
}

function resolveJsonPath(jsonStr: string, path: string): unknown {
  try {
    return getByPath(JSON.parse(jsonStr), path)
  } catch {
    return undefined
  }
}

export function resolveExpression(expr: string, context: ExecutionContext): string {
  return expr.replace(/\{\{([^}]+)\}\}/g, (_, inner: string) => {
    const exp = inner.trim()

    // {{ $input.field }}
    if (exp.startsWith("$input.")) {
      const field = exp.slice(7)
      return String(getByPath(context.input, field) ?? "")
    }

    // {{ $env.VAR }}
    if (exp.startsWith("$env.")) {
      return process.env[exp.slice(5)] ?? ""
    }

    // {{ $node["nodeId"].field }} or {{ $node.nodeId.field }}
    if (exp.startsWith("$node.") || exp.startsWith('$node["')) {
      const rest = exp.startsWith('$node["')
        ? exp.slice(7)  // $node["...
        : exp.slice(6)   // $node.xxx
      const match = rest.match(/^"?([^".]+)"?\.(.+)$/)
      if (match) {
        return String(resolveNodeOutput(context, match[1], match[2]) ?? `{{${exp}}}`)
      }
      // Just node ID: $node["nodeId"]
      const idMatch = rest.match(/^"([^"]+)"$/)
      if (idMatch) {
        return JSON.stringify(resolveNodeOutput(context, idMatch[1], ""))
      }
    }

    // {{ $json.path.to.field }}
    if (exp.startsWith("$json.")) {
      const entries = [...context.nodeResults.entries()]
      for (let i = entries.length - 1; i >= 0; i--) {
        const output = entries[i][1]
        if (typeof output === "object" && output !== null) {
          const raw = (output as Record<string, unknown>).raw
          if (typeof raw === "string") {
            const val = resolveJsonPath(raw, exp.slice(6))
            if (val !== undefined) return String(val)
          }
        }
      }
    }

    // {{ $now }}
    if (exp === "$now") {
      return new Date().toISOString()
    }

    // {{ date-Nd }}
    const dateMatch = exp.match(/^date-(\d+)d$/)
    if (dateMatch) {
      const d = new Date()
      d.setDate(d.getDate() - parseInt(dateMatch[1]))
      return d.toISOString().split("T")[0]
    }

    // {{ date-7d }}
    if (exp === "date-7d") {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      return d.toISOString().split("T")[0]
    }

    // {{ nodeId.field }}
    const parts = exp.split(".")
    if (parts.length >= 2) {
      const nodeId = parts[0]
      if (context.nodeResults.has(nodeId)) {
        return String(resolveNodeOutput(context, nodeId, parts.slice(1).join(".")) ?? `{{${exp}}}`)
      }
    }

    // {{ field }} — 从最近节点的输出中查找
    for (let i = context.nodeResults.size - 1; i >= 0; i--) {
      const [, output] = [...context.nodeResults][i]
      if (typeof output === "object" && output !== null) {
        const val = getByPath(output, exp)
        if (val !== undefined) return String(val)
      }
    }
    // Try context.input
    const inputVal = getByPath(context.input, exp)
    if (inputVal !== undefined) return String(inputVal)

    return `{{${exp}}}`
  })
}
