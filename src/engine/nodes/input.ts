import type { NodeExecutor } from "@/types/workflow"

export const executeInputNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const inputName = (config.name as string) || "input"
  const type = (config.type as string) || "text"

  // file 类型：选中的本地路径（config.default）优先，运行时输入仅作回退
  const value = type === "file"
    ? (config.default ?? context.input[inputName] ?? "")
    : (context.input[inputName] ?? config.default ?? "")

  return {
    [inputName]: value,
    raw: value,
  }
}
