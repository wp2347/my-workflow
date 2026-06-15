import { generateText, type LanguageModel } from "ai"

export interface LLMCallOptions {
  model: LanguageModel
  systemPrompt: string
  userMessage: string
  temperature?: number
  maxTokens?: number
}

export async function callLLM(options: LLMCallOptions) {
  const { model, systemPrompt, userMessage, temperature = 0.7, maxTokens = 4096 } = options

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: userMessage,
    temperature,
    maxOutputTokens: maxTokens,
  })

  const steps = (result as unknown as Record<string, unknown>).steps as Array<Record<string, unknown>> | undefined
  const content = steps?.[0]?.content as Array<{ type: string; text: string }> | undefined
  return content?.filter((c) => c.type === "text").map((c) => c.text).join("") || ""
}

export function createOpenAIModel(apiKey: string, baseURL?: string) {
  const { createOpenAI } = require("@ai-sdk/openai")
  return createOpenAI({
    apiKey,
    baseURL: baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  })
}
