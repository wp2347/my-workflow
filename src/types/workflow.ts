export interface WorkflowConfig {
  id: string
  name: string
  description?: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type NodeType = "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger"

export interface WorkflowNodeData extends Record<string, unknown> {
  type: NodeType
  label: string
  config: Record<string, unknown>
}

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

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

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

export interface ExecutionResult {
  executionId: string
  workflowId: string
  status: "pending" | "running" | "completed" | "failed"
  logs: ExecutionLog[]
  output?: unknown
  error?: string
  durationMs?: number
}

export interface ExecutionContext {
  workflowId: string
  executionId: string
  input: Record<string, unknown>
  nodeResults: Map<string, unknown>
  logs: ExecutionLog[]
}

export type NodeExecutor = (
  node: WorkflowNode,
  context: ExecutionContext,
) => Promise<unknown>
