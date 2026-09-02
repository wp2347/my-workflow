import { describe, it, expect } from "vitest"
import {
  validateSkillInput,
  validatePromptInput,
  validateMcpInput,
  validateTransport,
} from "@/lib/extensions/validation"

describe("validateSkillInput", () => {
  it("有效输入通过", () => {
    const result = validateSkillInput({ name: "My Skill", description: "Processes PDF files. Use when working with PDFs.", content: "# My Skill\n..." })
    expect(result.valid).toBe(true)
  })

  it("缺 name 失败", () => {
    const result = validateSkillInput({ description: "desc", content: "content" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("name")
  })

  it("description 超过 1024 字符失败", () => {
    const result = validateSkillInput({ name: "S", description: "x".repeat(1025), content: "c" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("1024")
  })

  it("name 超过 64 字符失败", () => {
    const result = validateSkillInput({ name: "x".repeat(65), description: "d", content: "c" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("64")
  })
})

describe("validatePromptInput", () => {
  it("有效输入通过", () => {
    const result = validatePromptInput({ name: "分析模板", content: "分析{{topic}}", role: "system" })
    expect(result.valid).toBe(true)
  })

  it("缺 name 失败", () => {
    const result = validatePromptInput({ content: "c", role: "system" })
    expect(result.valid).toBe(false)
  })

  it("role 不在枚举内失败", () => {
    const result = validatePromptInput({ name: "P", content: "c", role: "invalid" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("role")
  })
})

describe("validateMcpInput", () => {
  it("http 有效输入通过", () => {
    const result = validateMcpInput({ name: "Weather", transport: "http", url: "https://mcp.example.com" })
    expect(result.valid).toBe(true)
  })

  it("http 缺 url 失败", () => {
    const result = validateMcpInput({ name: "M", transport: "http" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("url")
  })

  it("stdio 有效输入通过", () => {
    const result = validateMcpInput({ name: "Local", transport: "stdio", command: "npx" })
    expect(result.valid).toBe(true)
  })

  it("stdio 缺 command 失败", () => {
    const result = validateMcpInput({ name: "M", transport: "stdio" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("command")
  })

  it("无效 transport 失败", () => {
    const result = validateMcpInput({ name: "M", transport: "ftp" })
    expect(result.valid).toBe(false)
    expect(result.error).toContain("transport")
  })
})

describe("validateTransport", () => {
  it("http 通过", () => { expect(validateTransport("http")).toBe(true) })
  it("sse 通过", () => { expect(validateTransport("sse")).toBe(true) })
  it("stdio 通过", () => { expect(validateTransport("stdio")).toBe(true) })
  it("ftp 失败", () => { expect(validateTransport("ftp")).toBe(false) })
})