// ============================================================
// 工作流核心类型定义
// ============================================================

/** 工作流配置（列表项） */
export interface WorkflowConfig {
  id: string
  name: string
  description?: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** 节点类型联合类型 —— 添加新节点时需同步更新 */
export type NodeType = "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger"

/** 节点 data 字段结构 */
export interface WorkflowNodeData extends Record<string, unknown> {
  type: NodeType
  label: string
  config: Record<string, unknown>
}

/** 画布中的节点 */
export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

/** 画布中的边（连线） */
export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

// ---- 各节点配置接口 ----

export interface InputNodeConfig {
  name: string
  type: "text" | "number" | "boolean" | "json"
  required: boolean
  default?: unknown
}

export interface LLMNodeConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
}

export interface ConditionNodeConfig {
  left: string
  operator: string
  right: string
}

export interface HttpNodeConfig {
  method: string
  url: string
  headers: Record<string, string>
  body: string
  auth: string
  authUsername: string
  authPassword: string
  authToken: string
}

export interface FeishuNodeConfig {
  mode: "send" | "receive"
  appId: string
  appSecret: string
  verificationToken: string
  webhookUrl: string
  message: string
  msgType: "text" | "markdown" | "interactive"
}

export interface OutputNodeConfig {
  format: "text" | "json" | "markdown"
  template?: string
}

// ---- 执行相关类型 ----

/** 单节点执行日志 */
export interface ExecutionLog {
  nodeId: string
  nodeType: NodeType
  status: "running" | "completed" | "failed"
  input?: unknown
  output?: unknown
  error?: string
  timestamp: string
  durationMs?: number
}

/** 工作流执行结果 */
export interface ExecutionResult {
  executionId: string
  workflowId: string
  status: "pending" | "running" | "completed" | "failed"
  logs: ExecutionLog[]
  output?: unknown
  error?: string
  durationMs?: number
}

/** 执行上下文：在工作流执行期间传递的状态 */
export interface ExecutionContext {
  workflowId: string
  executionId: string
  input: Record<string, unknown>
  nodeResults: Map<string, unknown>   // nodeId → 输出结果
  logs: ExecutionLog[]
  workflowExtensions?: ExtensionBindings   // 工作流级扩展绑定(执行入口加载)
}

/** 节点执行器函数签名 */
export type NodeExecutor = (
  node: WorkflowNode,
  context: ExecutionContext,
) => Promise<unknown>

// ============================================================
// 扩展包系统类型定义
// ============================================================

/** MCP 绑定(含工具/资源/prompts 选择) */
export interface McpBinding {
  serverId: string
  tools?: string[] | "all"            // 默认 "all"
  resources?: string[]                // 默认 []
  prompts?: string[]                  // 默认 []
}

/** 扩展包绑定(Skills + Prompts + MCP) */
export interface ExtensionBindings {
  skills: string[]
  prompts: string[]
  mcp: McpBinding[]
}
