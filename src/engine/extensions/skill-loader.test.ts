import { describe, it, expect, vi, beforeEach } from "vitest"
import { loadSkills } from "@/engine/extensions/skill-loader"

// mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    skill: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import type { ExecutionContext } from "@/types/workflow"

const mockContext: ExecutionContext = {
  workflowId: "wf1",
  executionId: "ex1",
  input: {},
  nodeResults: new Map(),
  logs: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("loadSkills", () => {
  it("空 skillIds 返回空 payload", async () => {
    const result = await loadSkills([], mockContext)
    expect(result.systemContext).toEqual([])
    expect(result.loadSkillTool).toBeUndefined()
  })

  it("≤3 个 skill:全量注入 systemContext", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "s1", name: "Skill A", description: "Does A", content: "# Skill A\n...", attachments: [] },
      { id: "s2", name: "Skill B", description: "Does B", content: "# Skill B\n...", attachments: [] },
    ] as never)

    const result = await loadSkills(["s1", "s2"], mockContext)
    expect(result.systemContext).toHaveLength(2)
    expect(result.systemContext[0]).toContain("Skill A")
    expect(result.loadSkillTool).toBeUndefined()
  })

  it(">3 个 skill:注册 load_skill tool + 注入摘要", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([
      { id: "s1", name: "A", description: "Does A", content: "content A", attachments: [] },
      { id: "s2", name: "B", description: "Does B", content: "content B", attachments: [] },
      { id: "s3", name: "C", description: "Does C", content: "content C", attachments: [] },
      { id: "s4", name: "D", description: "Does D", content: "content D", attachments: [] },
    ] as never)

    const result = await loadSkills(["s1", "s2", "s3", "s4"], mockContext)
    expect(result.systemContext).toHaveLength(1)
    expect(result.systemContext[0]).toContain("A")
    expect(result.systemContext[0]).toContain("D")
    expect(result.loadSkillTool).toBeDefined()
    expect(result.loadSkillTool?.load_skill).toBeDefined()
  })

  it("悬空 ID → warn + 跳过", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([])
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await loadSkills(["nonexistent"], mockContext)
    expect(result.systemContext).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
