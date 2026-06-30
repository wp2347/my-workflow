import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

describe("Prisma schema 扩展包表", () => {
  const schema = readFileSync(
    resolve(process.cwd(), "prisma/schema.prisma"),
    "utf-8"
  )

  it("包含 Skill model", () => {
    expect(schema).toContain("model Skill {")
    expect(schema).toContain('@@map("skills")')
  })

  it("包含 Prompt model", () => {
    expect(schema).toContain("model Prompt {")
    expect(schema).toContain('@@map("prompts")')
  })

  it("包含 McpServer model", () => {
    expect(schema).toContain("model McpServer {")
    expect(schema).toContain('@@map("mcp_servers")')
  })

  it("Skill 有 description 字段", () => {
    expect(schema).toMatch(
      /model Skill \{[\s\S]*?description\s+String\s+@db\.Text/
    )
  })

  it("McpServer 有 capabilitiesCache 字段", () => {
    expect(schema).toMatch(/model McpServer \{[\s\S]*?capabilitiesCache\s+Json/)
  })
})