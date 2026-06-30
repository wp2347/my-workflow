import { describe, it, expect, vi } from "vitest"
import { createZip, extractZip, validateZipPaths, MAX_UPLOAD_SIZE } from "@/lib/extensions/zip"
import JSZip from "jszip"

describe("createZip + extractZip", () => {
  it("打包并解压文件,内容一致", async () => {
    const files = [
      { name: "SKILL.md", content: "# My Skill" },
      { name: "reference.md", content: "## Reference" },
    ]
    const zipBuffer = await createZip(files)
    const extracted = await extractZip(zipBuffer)
    expect(extracted).toHaveLength(2)
    expect(extracted[0].name).toBe("SKILL.md")
    expect(extracted[0].content).toBe("# My Skill")
  })
})

describe("validateZipPaths — 路径穿越校验", () => {
  it("正常路径通过", () => {
    const entries = ["SKILL.md", "scripts/run.py", "docs/guide.md"]
    expect(validateZipPaths(entries)).toBe(true)
  })

  it("含 .. 的路径被拒绝", () => {
    const entries = ["SKILL.md", "../etc/passwd"]
    expect(validateZipPaths(entries)).toBe(false)
  })

  it("绝对路径被拒绝", () => {
    const entries = ["SKILL.md", "/etc/passwd"]
    expect(validateZipPaths(entries)).toBe(false)
  })

  it("盘符路径被拒绝(Windows)", () => {
    const entries = ["C:\\Windows\\system32"]
    expect(validateZipPaths(entries)).toBe(false)
  })
})

describe("MAX_UPLOAD_SIZE", () => {
  it("值为 10MB", () => {
    expect(MAX_UPLOAD_SIZE).toBe(10 * 1024 * 1024)
  })
})