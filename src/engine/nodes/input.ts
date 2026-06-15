import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

export const executeInputNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const inputName = (config.name as string) || "input"

  const value = context.input[inputName] ?? config.default ?? ""

  return {
    [inputName]: value,
    raw: value,
  }
}
