import { describe, it, expect } from "vitest"
import { chunkText } from "@/lib/chunker"

describe("chunkText", () => {
  it("短文本直接返回单块", () => {
    expect(chunkText("这是一段短文本内容足够超过十字的长度限制", 500)).toEqual([
      "这是一段短文本内容足够超过十字的长度限制",
    ])
  })

  it("长文本按 chunkSize 切多块且各块非空", () => {
    const text = Array.from({ length: 40 }, (_, i) => `第${i}段内容。这里是一些填充文字用来增加长度。`).join("")
    const chunks = chunkText(text, 200)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeGreaterThan(10)
      expect(c).toBe(c.trim())
    }
    // 覆盖完整性：除 overlap 造成的少量重复外，首尾内容应保留
    expect(text.startsWith(chunks[0].slice(0, 20))).toBe(true)
  })

  it("优先在句子边界（。）断开", () => {
    // 构造：句子边界落在 chunkSize 附近
    const text = `${"字".repeat(90)}。${"词".repeat(30)}。结尾`
    const chunks = chunkText(text, 100)
    expect(chunks[0].endsWith("。")).toBe(true)
  })

  it("超长无标点文本仍可完整切分", () => {
    const text = "a".repeat(1200)
    const chunks = chunkText(text, 500)
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    const total = chunks.reduce((sum, c) => sum + c.length, 0)
    expect(total).toBeGreaterThanOrEqual(1100) // 允许 overlap 带来的重复
  })

  it("过滤掉长度 ≤10 的碎块", () => {
    const text = `${"x".repeat(60)}\n\n${"y".repeat(5)}\n\n${"z".repeat(60)}`
    const chunks = chunkText(text, 80)
    expect(chunks.every((c) => c.length > 10)).toBe(true)
    expect(chunks.join("")).toContain("zzz")
  })
})
