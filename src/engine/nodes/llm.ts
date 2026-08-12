import { generateText, tool, stepCountIs, type LanguageModel } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { createGroq } from "@ai-sdk/groq"
import { createMistral } from "@ai-sdk/mistral"
import { createXai } from "@ai-sdk/xai"
import { z } from "zod"

import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { getProvider } from "@/lib/providers"
import { resolveCredentialValue } from "@/lib/credential"
import { mergeExtensions } from "@/engine/extensions/merge"
import { loadSkills } from "@/engine/extensions/skill-loader"
import { renderPrompts } from "@/engine/extensions/prompt-renderer"
import { loadMcpExtensions } from "@/engine/extensions/mcp-manager"

// 内存中的多轮对话历史（按 workflowId + nodeId 分组）
const conversationMemory = new Map<string, Array<{ role: string; content: string }>>()

/** 生成对话历史的唯一 key */
function getConversationKey(context: ExecutionContext, nodeId: string): string {
  return `${context.workflowId}-${nodeId}`
}

/** 收集上游所有节点的 raw 输出，拼接为 LLM 的 user prompt */
function getPreviousOutputs(_node: WorkflowNode, context: ExecutionContext): string {
  const results: string[] = []
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.raw && typeof obj.raw === "string") results.push(obj.raw)
    } else if (typeof output === "string") results.push(output)
  }
  return results.length > 0 ? results.join("\n\n") : ""
}

/** 根据 provider 创建对应的 AI SDK LanguageModel */
function createModel(provider: string, modelId: string, apiKey: string, baseUrl: string): LanguageModel {
  const key = apiKey || ""
  const createOpenAIProvider = (url: string) => createOpenAI({ apiKey: key, baseURL: url })
  switch (provider) {
    case "openai": return createOpenAIProvider(baseUrl || "https://api.openai.com/v1").chat(modelId)
    case "anthropic": return createAnthropic({ apiKey: key, baseURL: baseUrl })(modelId)
    case "google": return createGoogleGenerativeAI({ apiKey: key, baseURL: baseUrl })(modelId)
    case "deepseek": return createOpenAIProvider(baseUrl || "https://api.deepseek.com/v1").chat(modelId)
    case "groq": return createGroq({ apiKey: key, baseURL: baseUrl })(modelId)
    case "mistral": return createMistral({ apiKey: key, baseURL: baseUrl })(modelId)
    case "xai": return createXai({ apiKey: key, baseURL: baseUrl })(modelId)
    case "cohere":
    case "openai-compatible":
    default: return createOpenAIProvider(baseUrl).chat(modelId)
  }
}

/**
 * LLM 节点执行器。
 * 支持功能：
 *   - 多 Provider（OpenAI / Anthropic / Gemini / DeepSeek / Groq / Mistral / xAI）
 *   - 多轮对话记忆（memory 参数）
 *   - 知识库 RAG 增强（knowledgeId）
 *   - JSON 模式（jsonMode）
 *   - 工具调用（enableTools，内置天气查询工具）
 *   - System Prompt 模板
 */
export const executeLLMNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const provider = (config.provider as string) || "openai"
  const modelId = (config.model as string) || "gpt-4o-mini"
  const systemPrompt = (config.systemPrompt as string) || "You are a helpful assistant."
  const temperature = (config.temperature as number) ?? 0.7
  const maxTokens = (config.maxTokens as number) ?? 4096
  const apiKey = (config.apiKey as string) || ""
  const baseUrl = (config.baseUrl as string) || ""
  const credentialId = (config.credentialId as string) || ""
  const userInput = getPreviousOutputs(node, context)

  // 从 providers 配置中获取默认 API key 和 base URL
  const providerInfo = getProvider(provider)
  const defaultBaseUrl = providerInfo?.defaultBaseUrl || "https://api.openai.com/v1"
  const defaultApiKey = process.env[providerInfo?.defaultApiKeyEnv || ""] || ""

  // 凭证优先：credentialId 非空时从数据库读取解密值作为 key
  let credentialKey: string | null = null
  if (credentialId) {
    credentialKey = await resolveCredentialValue(credentialId)
    if (!credentialKey) throw new Error(`Credential not found: ${credentialId}`)
  }

  const finalApiKey = credentialKey ?? (apiKey || defaultApiKey)
  const finalBaseUrl = baseUrl || defaultBaseUrl

  if (!finalApiKey) {
    const providerName = providerInfo?.name || provider
    const envHint = providerInfo?.defaultApiKeyEnv
      ? `请设置环境变量 ${providerInfo.defaultApiKeyEnv}，或在节点配置中填写 API Key，或绑定全局凭证。`
      : "请选择厂商后填写对应的 API Key 或绑定全局凭证。"
    throw new Error(`未找到 ${providerName} 的 API Key。${envHint}`)
  }

  const model = createModel(provider, modelId, finalApiKey, finalBaseUrl)

  const enableTools = (config.enableTools as boolean) ?? false
  const knowledgeId = (config.knowledgeId as string) || ""
  const memory = Math.min((config.memory as number) ?? 0, 20)
  const jsonMode = (config.jsonMode as boolean) ?? false

  // ===== RAG: 知识库检索增强 =====
  let finalSystem = systemPrompt
  if (knowledgeId) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/rag/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userInput, topK: 3 }),
      })
      const data = await res.json() as { results?: Array<{ content: string }> }
      const ctx = (data.results || []).map((c, i) => `[片段${i + 1}]\n${c.content}`).join("\n\n")
      if (ctx) finalSystem = `${systemPrompt}\n\n参考知识库：\n${ctx}`
    } catch {}
  }

  // ===== JSON 模式：强制输出 JSON =====
  if (jsonMode && !finalSystem.includes("JSON")) {
    finalSystem += "\n\n必须返回有效JSON格式，不含markdown标记。"
  }

  // ===== 扩展包加载(新增) =====
  const nodeConfig = (node.data.config as Record<string, unknown>) || {}
  const extensions = mergeExtensions(context.workflowExtensions, nodeConfig)

  let skillPayload: Awaited<ReturnType<typeof loadSkills>> = { systemContext: [] }
  let promptPayload: Awaited<ReturnType<typeof renderPrompts>> = { systemPrompts: [], userPrompts: [] }
  let mcpPayload: Awaited<ReturnType<typeof loadMcpExtensions>> = { tools: {}, resourceContext: [] }

  try {
    [skillPayload, promptPayload, mcpPayload] = await Promise.all([
      loadSkills(extensions.skills, context),
      renderPrompts(extensions.prompts, context),
      loadMcpExtensions(extensions.mcp, context),
    ])
  } catch (error) {
    console.warn("[llm] Extension loading failed, continuing without:", error)
  }

  // 注入 system prompt
  finalSystem = [
    finalSystem,
    ...skillPayload.systemContext,
    ...mcpPayload.resourceContext,
    ...promptPayload.systemPrompts,
  ].filter(Boolean).join("\n\n")

  // 注入 user input
  const finalUserInput = [
    ...promptPayload.userPrompts,
    userInput,
  ].filter(Boolean).join("\n\n")

  // ===== 多轮对话记忆 =====
  const convKey = getConversationKey(context, node.id)
  if (memory > 0) {
    let history = conversationMemory.get(convKey) || []
    history.push({ role: "user", content: userInput })
    const maxPairs = memory * 2
    if (history.length > maxPairs) history = history.slice(history.length - maxPairs)
    conversationMemory.set(convKey, history)
  }

  // ===== 内置工具：天气查询 =====
  const weatherTool = {
    get_weather: tool({
      description: "获取指定城市实时天气",
      inputSchema: z.object({ city: z.string().describe("城市英文名如Beijing") }),
      execute: async (args: { city: string }) => {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(args.city)}?format=j1`)
        const data = await res.json() as Record<string, unknown>
        const c = (data.current_condition as Array<Record<string, unknown>>)?.[0]
        return { city: args.city, temp_C: c?.temp_C || "N/A", FeelsLikeC: c?.FeelsLikeC || "N/A",
          weatherDesc: (c?.weatherDesc as Array<Record<string, unknown>>)?.[0]?.value || "N/A",
          humidity: c?.humidity || "N/A", windspeedKmph: c?.windspeedKmph || "N/A" }
      },
    } as never),
  }

  const genOptions: Record<string, unknown> = {
    model, system: finalSystem, prompt: finalUserInput, temperature, maxOutputTokens: maxTokens,
  }
  // 多轮对话：填入历史消息
  if (memory > 0) {
    const history = conversationMemory.get(convKey) || []
    if (history.length > 1) genOptions.messages = history.slice(0, -1).map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
  }

  // 扩展 tools 注册
  const hasSkillTool = !!skillPayload.loadSkillTool
  const hasMcpTools = Object.keys(mcpPayload.tools || {}).length > 0
  if (hasSkillTool || hasMcpTools) {
    genOptions.tools = {
      ...(skillPayload.loadSkillTool || {}),
      ...(mcpPayload.tools || {}),
    }
    genOptions.maxSteps = (hasSkillTool && hasMcpTools) ? 5 : 3
  }

  // 工具调用
  if (enableTools) {
    genOptions.tools = { ...weatherTool, ...(genOptions.tools || {}) }
    genOptions.maxSteps = Math.max(genOptions.maxSteps as number || 0, 5)
  }

  // 有 tools 时用 stopWhen 确保多步执行(工具调用后自动续轮生成最终回复)
  if (genOptions.tools) {
    genOptions.stopWhen = stepCountIs(genOptions.maxSteps as number || 5)
  }

  const result = await generateText(genOptions as never)
  const ru = result as unknown as Record<string, unknown>

  // 有 tools 时 result.text 应该已包含最终回复(多步执行后)
  const toolResults = ru.toolResults as Array<Record<string, unknown>> | undefined
  let outputText = (ru.text as string) || ""

  // fallback: 如果 result.text 为空,从 steps 提取
  if (!outputText) {
    const steps = ru.steps as Array<Record<string, unknown>> | undefined
    outputText = steps?.map((s) => {
      const content = s.content as Array<{ type: string; text: string }> | undefined
      return content?.filter((c) => c.type === "text").map((c) => c.text).join("") || ""
    }).join("").trim() || ""
  }

  // 最后兜底: 如果有 toolResults 但文本还是很短,用 tool 数据拼
  if (toolResults && toolResults.length > 0 && (!outputText || outputText.length < 20)) {
    const toolData = toolResults.map((tr) => JSON.stringify(tr.output)).join("\n")
    outputText = `工具返回数据:\n${toolData}`
  }

  // 将助手回复加入对话历史
  if (memory > 0 && outputText) {
    const history = conversationMemory.get(convKey) || []
    history.push({ role: "assistant", content: outputText })
    conversationMemory.set(convKey, history)
  }

  return {
    text: outputText, raw: outputText, model: modelId, provider,
    usage: { promptTokens: (ru.usage as Record<string, number> | undefined)?.inputTokens ?? 0, completionTokens: (ru.usage as Record<string, number> | undefined)?.outputTokens ?? 0 },
  }
}
