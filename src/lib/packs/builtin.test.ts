import { describe, it, expect } from "vitest"
import { getBuiltinPacks } from "./builtin"

describe("getBuiltinPacks", () => {
  it("loads and validates all builtin packs from src/packs/*.json", () => {
    const packs = getBuiltinPacks()
    const ids = packs.map((p) => p.id)
    expect(ids).toContain("filesystem")
    expect(ids).toContain("office")
    for (const pack of packs) {
      expect(pack.mcps.length).toBeGreaterThan(0)
    }
  })
})
