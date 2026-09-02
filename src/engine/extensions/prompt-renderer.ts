import { prisma } from "@/lib/prisma"
import { resolveExpression } from "@/lib/expression"
import type { ExecutionContext, SkillPackBinding } from "@/types/workflow"

export type PromptBinding = string | SkillPackBinding

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

async function resolvePromptIds(entries: PromptBinding[]): Promise<string[]> {
  const ids: string[] = []
  const packIds = new Set<string>()
  for (const entry of entries) {
    if (typeof entry === "string") {
      ids.push(entry)
    } else {
      packIds.add(entry.packId)
    }
  }
  if (packIds.size > 0) {
    const rows = await prisma.prompt.findMany({
      where: { packId: { in: [...packIds] } },
      select: { id: true, packId: true },
    })
    for (const row of rows) {
      if (row.packId) ids.push(row.id)
    }
  }
  return ids
}

/**
 * 渲染绑定的 Prompts 并按 role 分组。
 * - 支持 string id 或 { packId }（解析为已安装的同 packId prompt）
 * - 变量替换复用 @/lib/expression.ts 的 resolveExpression。
 */
export async function renderPrompts(
  entries: PromptBinding[],
  context: ExecutionContext,
): Promise<PromptPayload> {
  const promptIds = await resolvePromptIds(entries)

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
