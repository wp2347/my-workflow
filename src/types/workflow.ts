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
export type NodeType = "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger" | "music"

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
  credentialId?: string
  /** 工具调用最大交互轮数（1-20，默认 8）；无工具时无效 */
  maxSteps?: number
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
  exportMode: "download" | "local" | "remote"
  exportPath: string
  remoteUrl: string
}

export interface MusicNodeConfig {
  apiUrl: string
  method: "POST" | "GET"
  headers: Record<string, string>
  bodyTemplate: string
  auth: "none" | "bearer" | "api_key"
  authToken: string
  pollingEnabled: boolean
  taskIdField: string
  pollUrlTemplate: string
  pollIntervalMs: number
  pollMaxAttempts: number
  pollStatusField: string
  pollSuccessValue: string
  audioUrlField: string
  metadataField: string
  credentialId?: string
}

// ---- 执行相关类型 ----

// ---- Agent 工具调用步骤 ----

/** 一次工具调用的日志记录（写入 ExecutionLog.steps） */
export interface ToolCallStep {
  toolName: string
  argsSummary: string      // 参数 JSON 摘要（超长截断）
  resultSummary: string    // 结果 JSON 摘要（超长截断）
  durationMs: number
}

/** 工具调用概要（随节点输出发给下游节点/调试面板使用） */
export interface ToolCallInfo {
  name: string
  args?: unknown
  summary: string
}

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
  steps?: ToolCallStep[]   // Agent 工具调用明细（仅工具型节点产出）
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

/** 按 packId 引用技能包中的技能 */
export interface SkillPackBinding {
  packId: string
}

/** 按 packId 引用技能包中的 MCP server（可多个） */
export interface McpPackBinding {
  packId: string
  tools?: string[] | "all"
  resources?: string[]
  prompts?: string[]
}

/** 扩展包绑定(Skills + Prompts + MCP) */
export interface ExtensionBindings {
  skills: Array<string | SkillPackBinding>
  prompts: Array<string | SkillPackBinding>
  mcp: Array<McpBinding | McpPackBinding>
}
