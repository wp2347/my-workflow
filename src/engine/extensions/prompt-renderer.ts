import { prisma } from "@/lib/prisma"
import { resolveExpression } from "@/lib/expression"
import type { ExecutionContext } from "@/types/workflow"

export interface PromptPayload {
  systemPrompts: string[]
  userPrompts: string[]
}

interface PromptVariable {
  name: string
  description?: string
  required?: boolean
  defaultValue?: string
}

/**
 * 渲染绑定的 Prompts 并按 role 分组。
 * 变量替换复用 @/lib/expression.ts 的 resolveExpression。
 */
export async function renderPrompts(
  promptIds: string[],
  context: ExecutionContext,
): Promise<PromptPayload> {
  if (promptIds.length === 0) {
    return { systemPrompts: [], userPrompts: [] }
  }

  const prompts = await prisma.prompt.findMany({
    where: { id: { in: promptIds } },
    select: { id: true, name: true, content: true, role: true, variables: true },
  })

  if (prompts.length < promptIds.length) {
    const foundIds = new Set(prompts.map((p) => p.id))
    for (const id of promptIds) {
      if (!foundIds.has(id)) {
        console.warn(`[prompt-renderer] Prompt not found, skipping: ${id}`)
      }
    }
  }

  const systemPrompts: string[] = []
  const userPrompts: string[] = []

  for (const prompt of prompts) {
    let rendered = resolveExpression(prompt.content, context)

    const variables = (prompt.variables as unknown as PromptVariable[]) || []
    for (const v of variables) {
      const placeholder = `{{${v.name}}}`
      if (rendered.includes(placeholder)) {
        const inputVal = (context.input as Record<string, unknown>)?.[v.name]
        const val = inputVal !== undefined ? String(inputVal) : (v.defaultValue || "")
        rendered = rendered.replaceAll(placeholder, val)
      }
    }

    if (prompt.role === "user") {
      userPrompts.push(rendered)
    } else {
      systemPrompts.push(rendered)
    }
  }

  return { systemPrompts, userPrompts }
}
