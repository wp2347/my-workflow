import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"

export const executeConditionNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}

  const leftExpr = (config.left as string) || ""
  const op = (config.operator as string) || "=="
  const rightExpr = (config.right as string) || ""

  // Resolve expressions
  const left = resolveExpression(leftExpr, context)
  const right = resolveExpression(rightExpr, context)

  // Compare as numbers if both are numeric
  const leftNum = Number(left)
  const rightNum = Number(right)
  const useNumeric = !isNaN(leftNum) && !isNaN(rightNum)

  const l = useNumeric ? leftNum : left
  const r = useNumeric ? rightNum : right

  let result: unknown = false
  switch (op) {
    case "==": result = l === r; break
    case "!=": result = l !== r; break
    case ">": result = useNumeric && l > r; break
    case "<": result = useNumeric && l < r; break
    case ">=": result = useNumeric && l >= r; break
    case "<=": result = useNumeric && l <= r; break
    case "contains": result = String(l).includes(String(r)); break
    case "not_contains": result = !String(l).includes(String(r)); break
    case "starts_with": result = String(l).startsWith(String(r)); break
    case "ends_with": result = String(l).endsWith(String(r)); break
    case "regex": { try { result = new RegExp(String(r)).test(String(l)) } catch { result = false } break }
    case "is_empty": result = !l || String(l).trim() === ""; break
    case "is_not_empty": result = l && String(l).trim() !== ""; break
  }

  return {
    result: Boolean(result),
    left: l,
    right: r,
    operator: op,
    raw: String(result),
  }
}
