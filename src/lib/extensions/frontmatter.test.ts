import { describe, it, expect } from "vitest"
import { parseFrontmatter } from "@/lib/extensions/frontmatter"

describe("parseFrontmatter", () => {
  it("解析含 name + description 的 frontmatter", () => {
    const md = `---
name: Processing PDFs
description: Extract text from PDF files. Use when working with PDFs.
---
# PDF Processing
content here`
    const result = parseFrontmatter(md)
    expect(result.name).toBe("Processing PDFs")
    expect(result.description).toBe("Extract text from PDF files. Use when working with PDFs.")
    expect(result.body).toContain("# PDF Processing")
  })

  it("无 frontmatter 返回全文为 body", () => {
    const md = "# Just a title\n\nNo frontmatter here."
    const result = parseFrontmatter(md)
    expect(result.name).toBeUndefined()
    expect(result.description).toBeUndefined()
    expect(result.body).toBe(md)
  })

  it("只有 name 没有 description", () => {
    const md = `---
name: My Skill
---
content`
    const result = parseFrontmatter(md)
    expect(result.name).toBe("My Skill")
    expect(result.description).toBeUndefined()
  })

  it("description 含冒号正确解析", () => {
    const md = `---
name: Test
description: Does X: when Y happens
---
body`
    const result = parseFrontmatter(md)
    expect(result.description).toBe("Does X: when Y happens")
  })
})