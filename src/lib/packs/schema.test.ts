import { describe, it, expect } from "vitest"
import { validatePackManifest } from "./schema"

const validManifest = {
  id: "office",
  name: "文档生成",
  description: "生成 Word/Excel/PPT/PDF",
  category: "office",
  icon: "file-text",
  version: "1.0.0",
  mcps: [
    { name: "office", transport: "stdio", command: "npx", args: ["tsx", "src/mcp/office-server.ts"], tools: "all" },
  ],
  skills: [
    { name: "office-usage", description: "usage", content: "Use office tools." },
  ],
}

describe("validatePackManifest", () => {
  it("accepts a valid manifest", () => {
    const r = validatePackManifest(validManifest)
    expect(r.valid).toBe(true)
    expect(r.data?.id).toBe("office")
  })

  it("rejects a manifest without mcps", () => {
    const noMcps = { ...validManifest } as Record<string, unknown>
    delete noMcps.mcps
    const r = validatePackManifest(noMcps)
    expect(r.valid).toBe(false)
  })

  it("rejects invalid mcp transport", () => {
    const bad = { ...validManifest, mcps: [{ name: "x", transport: "ftp", command: "npx" }] }
    const r = validatePackManifest(bad)
    expect(r.valid).toBe(false)
  })

  it("rejects id with illegal characters", () => {
    const bad = { ...validManifest, id: "a b/c" }
    const r = validatePackManifest(bad)
    expect(r.valid).toBe(false)
  })
})
