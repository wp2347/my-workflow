import { type NodeType } from "@/types/workflow"

// 注意：类名必须完整字面量出现在源文件中，Tailwind 扫描器才能生成对应样式，
// 因此使用静态映射表而非字符串拼接。
export const NODE_ICON_CLASS: Record<NodeType, string> = {
  input: "rounded-md p-1 bg-node-input-bg text-node-input",
  llm: "rounded-md p-1 bg-node-llm-bg text-node-llm",
  output: "rounded-md p-1 bg-node-output-bg text-node-output",
  feishu: "rounded-md p-1 bg-node-feishu-bg text-node-feishu",
  http: "rounded-md p-1 bg-node-http-bg text-node-http",
  condition: "rounded-md p-1 bg-node-condition-bg text-node-condition",
  merge: "rounded-md p-1 bg-node-merge-bg text-node-merge",
  cron_trigger: "rounded-md p-1 bg-node-cron-bg text-node-cron",
  music: "rounded-md p-1 bg-node-music-bg text-node-music",
}

export const NODE_HANDLE_CLASS: Record<NodeType, string> = {
  input: "!w-3 !h-3 !border-2 !border-background !bg-node-input",
  llm: "!w-3 !h-3 !border-2 !border-background !bg-node-llm",
  output: "!w-3 !h-3 !border-2 !border-background !bg-node-output",
  feishu: "!w-3 !h-3 !border-2 !border-background !bg-node-feishu",
  http: "!w-3 !h-3 !border-2 !border-background !bg-node-http",
  condition: "!w-3 !h-3 !border-2 !border-background !bg-node-condition",
  merge: "!w-3 !h-3 !border-2 !border-background !bg-node-merge",
  cron_trigger: "!w-3 !h-3 !border-2 !border-background !bg-node-cron",
  music: "!w-3 !h-3 !border-2 !border-background !bg-node-music",
}

export function nodeCard(selected: boolean): string {
  return `px-4 py-3 rounded-xl border bg-card shadow-soft min-w-[180px] transition-shadow ${selected ? "border-primary" : "border-border"}`
}

export function nodeIcon(nodeType: NodeType): string {
  return NODE_ICON_CLASS[nodeType]
}

export function nodeHandle(nodeType: NodeType): string {
  return NODE_HANDLE_CLASS[nodeType]
}
