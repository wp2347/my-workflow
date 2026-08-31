import { describe, it, expect } from "vitest"
import { resolveStoragePath, STORAGE_ROOT } from "@/lib/storage-path"
import path from "path"

describe("resolveStoragePath 路径安全校验", () => {
  it("storage 相对路径 → 解析为 storage 根内绝对路径", () => {
    const out = resolveStoragePath("export/report.docx")
    expect(out).toBe(path.join(STORAGE_ROOT, "export", "report.docx"))
  })

  it("storage 根内的绝对路径 → 允许", () => {
    const abs = path.join(STORAGE_ROOT, "export", "a.md")
    expect(resolveStoragePath(abs)).toBe(abs)
  })

  it(".. 越界相对路径 → 拒绝", () => {
    expect(resolveStoragePath("../../etc/passwd")).toBeNull()
  })

  it("绝对路径逃逸 storage 根 → 拒绝", () => {
    expect(resolveStoragePath(path.join(STORAGE_ROOT, "..", "Desktop", "evil.txt"))).toBeNull()
  })

  it("storage 根自身 → 允许（根目录）", () => {
    expect(resolveStoragePath(STORAGE_ROOT)).toBe(STORAGE_ROOT)
  })

  it("storage 根的同名前缀目录不被误判为越界", () => {
    const evilAbs = path.join(path.dirname(STORAGE_ROOT), "storage2", "x.txt")
    expect(resolveStoragePath(evilAbs)).toBeNull()
  })
})
