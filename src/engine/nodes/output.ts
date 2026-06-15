import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

export const executeOutputNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const format = (config.format as string) || "text"
  const template = (config.template as string) || ""

  const previousOutputs: string[] = []
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.raw && typeof obj.raw === "string") {
        previousOutputs.push(obj.raw)
      }
    } else if (typeof output === "string") {
      previousOutputs.push(output)
    }
  }

  let output: unknown

  switch (format) {
    case "json":
      try {
        output = JSON.parse(previousOutputs.join(""))
      } catch {
        output = previousOutputs
      }
      break
    case "markdown":
      output = previousOutputs.join("\n\n---\n\n")
      break
    case "text":
    default:
      output = previousOutputs.join("\n\n")
      break
  }

  if (template) {
    let formatted = template
    for (const [nodeId, result] of context.nodeResults) {
      if (typeof result === "object" && result !== null) {
        const obj = result as Record<string, unknown>
        if (typeof obj.raw === "string") {
          formatted = formatted.replace(`{{${nodeId}}}`, obj.raw)
        }
      }
    }
    output = formatted
  }

  return {
    output,
    raw: typeof output === "string" ? output : JSON.stringify(output),
    format,
  }
}
