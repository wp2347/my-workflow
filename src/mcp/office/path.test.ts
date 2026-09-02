import { describe, it, expect } from "vitest"
import { resolveAllowedPath, ALLOWED_ROOT } from "./path"

describe("resolveAllowedPath", () => {
  it("accepts a path inside storage", () => {
    const out = resolveAllowedPath("storage/export/a.docx")
    expect(out.endsWith(`${ALLOWED_ROOT}/export/a.docx`)).toBe(true)
  })

  it("rejects path escaping allowed root", () => {
    expect(() => resolveAllowedPath("../etc/passwd")).toThrow()
  })

  it("rejects absolute path outside root", () => {
    expect(() => resolveAllowedPath("/etc/passwd")).toThrow()
  })
})
