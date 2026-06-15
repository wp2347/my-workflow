import { generateText, tool, type LanguageModel } from "ai"
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

const conversationMemory = new Map<string, Array<{ role: string; content: string }>>()

function getConversationKey(context: ExecutionContext, nodeId: string): string {
  return `${context.workflowId}-${nodeId}`
}

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

function createModel(provider: string, modelId: string, apiKey: string, baseUrl: string): LanguageModel {
  const key = apiKey || ""
  switch (provider) {
    case "openai": return createOpenAI({ apiKey: key, baseURL: baseUrl })(modelId)
    case "anthropic": return createAnthropic({ apiKey: key, baseURL: baseUrl })(modelId)
    case "google": return createGoogleGenerativeAI({ apiKey: key, baseURL: baseUrl })(modelId)
    case "deepseek": return createDeepSeek({ apiKey: key, baseURL: baseUrl })(modelId)
    case "groq": return createGroq({ apiKey: key, baseURL: baseUrl })(modelId)
    case "mistral": return createMistral({ apiKey: key, baseURL: baseUrl })(modelId)
    case "xai": return createXai({ apiKey: key, baseURL: baseUrl })(modelId)
    case "cohere":
    case "openai-compatible":
    default: return createOpenAI({ apiKey: key, baseURL: baseUrl })(modelId)
  }
}

export const executeLLMNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const provider = (config.provider as string) || "openai"
  const modelId = (config.model as string) || "gpt-4o-mini"
  const systemPrompt = (config.systemPrompt as string) || "You are a helpful assistant."
  const temperature = (config.temperature as number) ?? 0.7
  const maxTokens = (config.maxTokens as number) ?? 4096
  const apiKey = (config.apiKey as string) || ""
  const baseUrl = (config.baseUrl as string) || ""
  const userInput = getPreviousOutputs(node, context)

  const providerInfo = getProvider(provider)
  const defaultBaseUrl = providerInfo?.defaultBaseUrl || "https://api.openai.com/v1"
  const defaultApiKey = process.env[providerInfo?.defaultApiKeyEnv || ""] || ""
  const finalApiKey = apiKey || defaultApiKey || process.env.OPENAI_API_KEY || ""
  const finalBaseUrl = baseUrl || defaultBaseUrl

  if (!finalApiKey) throw new Error(`No API key for ${providerInfo?.name || provider}`)

  const model = createModel(provider, modelId, finalApiKey, finalBaseUrl)

  const enableTools = (config.enableTools as boolean) ?? false
  const knowledgeId = (config.knowledgeId as string) || ""
  const memory = Math.min((config.memory as number) ?? 0, 20)
  const jsonMode = (config.jsonMode as boolean) ?? false

  // RAG
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

  if (jsonMode && !finalSystem.includes("JSON")) {
    finalSystem += "\n\n必须返回有效JSON格式，不含markdown标记。"
  }

  // Multi-turn memory
  const convKey = getConversationKey(context, node.id)
  if (memory > 0) {
    let history = conversationMemory.get(convKey) || []
    history.push({ role: "user", content: userInput })
    const maxPairs = memory * 2
    if (history.length > maxPairs) history = history.slice(history.length - maxPairs)
    conversationMemory.set(convKey, history)
  }

  const weatherTool = {
    get_weather: tool({
      description: "获取指定城市实时天气",
      parameters: z.object({ city: z.string().describe("城市英文名如Beijing") }),
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
    model, system: finalSystem, prompt: userInput, temperature, maxOutputTokens: maxTokens,
  }
  if (memory > 0) {
    const history = conversationMemory.get(convKey) || []
    if (history.length > 1) genOptions.messages = history.slice(0, -1).map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
  }
  if (enableTools) { genOptions.tools = weatherTool; genOptions.maxSteps = 3 }

  const result = await generateText(genOptions as never)
  const ru = result as unknown as Record<string, unknown>
  const steps = ru.steps as Array<Record<string, unknown>> | undefined
  const content = steps?.[0]?.content as Array<{ type: string; text: string }> | undefined
  const outputText = content?.filter((c) => c.type === "text").map((c) => c.text).join("").trim() || ""

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
