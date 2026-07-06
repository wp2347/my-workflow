import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { ExecutionContext } from "@/types/workflow"

export interface SkillPayload {
  systemContext: string[]
  loadSkillTool?: Record<string, unknown>
}

/**
 * 加载绑定的 Skills 并构建注入 payload。
 * - ≤3 个:全量注入 content 到 systemContext
 * - >3 个:注入摘要 + 注册 load_skill tool(模型按需调用)
 * - 悬空 ID:warn + 跳过
 */
export async function loadSkills(
  skillIds: string[],
  _context: ExecutionContext,
): Promise<SkillPayload> {
  if (skillIds.length === 0) {
    return { systemContext: [] }
  }

  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, name: true, description: true, content: true, attachments: true },
  })

  if (skills.length < skillIds.length) {
    const foundIds = new Set(skills.map((s) => s.id))
    for (const id of skillIds) {
      if (!foundIds.has(id)) {
        console.warn(`[skill-loader] Skill not found, skipping: ${id}`)
      }
    }
  }

  if (skills.length === 0) {
    return { systemContext: [] }
  }

  if (skills.length <= 3) {
    const systemContext = skills.map((s) => {
      const header = `# Skill: ${s.name}\n${s.description}`
      return `${header}\n\n${s.content}`
    })
    return { systemContext }
  }

  // >3: summary + load_skill tool
  const summary = skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n")
  const systemContext = [`# Available Skills\n\nThe following skills are available. Use the load_skill tool to load the full content of a skill before applying it.\n\n${summary}`]

  const skillMap = new Map(skills.map((s) => [s.name, s]))

  const loadSkillTool = {
    load_skill: tool({
      description: "Load the full content of a skill by name. Call this when you need detailed instructions from a skill.",
      inputSchema: z.object({
        skill_name: z.string().describe("The name of the skill to load"),
      }),
      execute: async ({ skill_name }: { skill_name: string }) => {
        const skill = skillMap.get(skill_name)
        if (!skill) {
          return `Skill "${skill_name}" not found. Available skills: ${skills.map((s) => s.name).join(", ")}`
        }
        return skill.content
      },
    } as never),
  }

  return { systemContext, loadSkillTool }
}
