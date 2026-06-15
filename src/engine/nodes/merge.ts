import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

export const executeMergeNode: NodeExecutor = async (_node, context) => {
  const config = (_node.data.config as Record<string, unknown>) || {}
  const strategy = (config.strategy as string) || "concat"

  // Collect ALL previous results as they're all upstream of this merge node
  const results: unknown[] = []
  for (const [nodeId, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      // Skip merge nodes themselves and condition nodes
      if (obj.mergeResult) continue
      const text = obj.text || obj.message || obj.raw
      if (text) results.push(typeof text === "string" ? text : JSON.stringify(text))
    }
  }

  let combined: unknown
  switch (strategy) {
    case "json_array":
      combined = results
      break
    case "first":
      combined = results[0] || ""
      break
    case "last":
      combined = results[results.length - 1] || ""
      break
    case "concat":
    default:
      combined = results.join("\n\n")
      break
  }

  return {
    mergeResult: true,
    strategy,
    results,
    raw: typeof combined === "string" ? combined : JSON.stringify(combined),
    text: typeof combined === "string" ? combined : JSON.stringify(combined),
  }
}
