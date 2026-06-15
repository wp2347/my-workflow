import { createOpenAI } from "@ai-sdk/openai"
import { embed } from "ai"

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-placeholder" })
  const result = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  })
  return result.embedding as number[]
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(t => generateEmbedding(t)))
}
