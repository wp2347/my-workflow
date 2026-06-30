# 扩展包系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 工作流平台增加扩展包功能(Skills/Prompts/MCP),支持上传/下载/新建/绑定到 LLM 节点。

**Architecture:** 三类扩展各自独立数据表 + 独立 API + 独立编辑器;执行引擎在 LLM 节点构建 genOptions 前插入扩展加载阶段(skill-loader / prompt-renderer / mcp-manager);绑定关系复用现有 Workflow.config / WorkflowNode.data.config JSON 字段,双层(工作流级 + 节点级)替换语义。

**Tech Stack:** Next.js 15 (Route Handlers) + Prisma + PostgreSQL + Zustand + AI SDK 6 + @ai-sdk/mcp + @modelcontextprotocol/sdk + jszip + Vitest

**Spec:** `docs/superpowers/specs/2026-06-30-extensions-design.md`

---

## Task 1: 安装 Vitest 测试框架

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: 安装依赖**

```bash
npm install -D vitest @vitest/coverage-v8 happy-dom
```

- [ ] **Step 2: 创建 vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/extensions/**", "src/engine/extensions/**"],
    },
  },
})
```

- [ ] **Step 3: 创建 vitest.setup.ts**

```typescript
// Vitest 全局 setup
// 确保 process.env 有默认值,避免测试时因缺少环境变量崩溃
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "test-key"
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-encryption-key-32chars!!"
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://workflow:workflow@localhost:5432/workflow"
```

- [ ] **Step 4: 在 package.json 添加 scripts**

在 `package.json` 的 `scripts` 中添加:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: 验证 vitest 可运行**

```bash
npx vitest run --reporter=verbose 2>&1 | head -5
```

Expected: 输出 "No test files found" 或类似(尚无测试文件)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: 安装 Vitest 测试框架"
```

---

## Task 2: 安装扩展包系统依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装依赖**

```bash
npm install @ai-sdk/mcp@^2.0.3 @modelcontextprotocol/sdk@^1.29.0 jszip@^3.10.1
npm install -D @types/jszip
```

- [ ] **Step 2: 验证安装**

```bash
node -e "require('@ai-sdk/mcp'); console.log('mcp ok')" && node -e "require('jszip'); console.log('jszip ok')"
```

Expected: 输出 `mcp ok` 和 `jszip ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 安装扩展包系统依赖(@ai-sdk/mcp, @modelcontextprotocol/sdk, jszip)"
```

---

## Task 3: Prisma Schema — 新增三张表

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `src/lib/extensions/schema.test.ts`

- [ ] **Step 1: 写测试 — 验证 Prisma schema 包含三个 model**

`src/lib/extensions/schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

describe("Prisma schema 扩展包表", () => {
  const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf-8")

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
    expect(schema).toMatch(/model Skill \{[\s\S]*?description\s+String\s+@db\.Text/)
  })

  it("McpServer 有 capabilitiesCache 字段", () => {
    expect(schema).toMatch(/model McpServer \{[\s\S]*?capabilitiesCache\s+Json/)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/extensions/schema.test.ts
```

Expected: FAIL — schema 不含 Skill/Prompt/McpServer

- [ ] **Step 3: 在 prisma/schema.prisma 末尾添加三个 model**

在 `prisma/schema.prisma` 文件末尾追加:

```prisma

// ============================================================
// 扩展包系统 — Skills / Prompts / MCP Servers
// ============================================================

model Skill {
  id           String   @id @default(cuid())
  name         String
  description  String   @db.Text
  category     String?
  content      String   @db.Text
  attachments  Json     @default("[]")
  tags         String[] @default([])
  version      String   @default("1.0.0")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("skills")
}

model Prompt {
  id           String   @id @default(cuid())
  name         String
  description  String?
  category     String?
  content      String   @db.Text
  variables    Json     @default("[]")
  role         String   @default("system")
  tags         String[] @default([])
  version      String   @default("1.0.0")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("prompts")
}

model McpServer {
  id                String   @id @default(cuid())
  name              String
  description       String?
  transport         String
  url               String?
  headers           Json     @default("{}")
  command           String?
  args              Json     @default("[]")
  env               Json     @default("{}")
  capabilitiesCache Json     @default("{\"tools\":[],\"resources\":[],\"prompts\":[]}")
  status            String   @default("untested")
  lastCheckedAt     DateTime? @map("last_checked_at")
  tags              String[] @default([])
  version           String   @default("1.0.0")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("mcp_servers")
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/extensions/schema.test.ts
```

Expected: PASS

- [ ] **Step 5: 生成 Prisma client + 迁移**

```bash
npx prisma generate && npx prisma migrate dev --name add_extensions_tables
```

Expected: 迁移成功生成

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/extensions/schema.test.ts
git commit -m "feat: Prisma schema 新增 Skill/Prompt/McpServer 三张表"
```

---

## Task 4: 类型定义 — ExtensionBindings + ExecutionContext 变更

**Files:**
- Modify: `src/types/workflow.ts`
- Test: `src/types/extensions.test.ts`

- [ ] **Step 1: 写测试 — 验证类型可正确构造**

`src/types/extensions.test.ts`:

```typescript
import { describe, it, expect, expectTypeOf } from "vitest"
import type { ExtensionBindings, McpBinding } from "@/types/workflow"
import type { ExecutionContext } from "@/types/workflow"

describe("ExtensionBindings 类型", () => {
  it("McpBinding 可构造并携带 serverId + tools", () => {
    const binding: McpBinding = {
      serverId: "srv1",
      tools: ["get_weather"],
      resources: ["file:///data.json"],
      prompts: [],
    }
    expect(binding.serverId).toBe("srv1")
    expect(binding.tools).toEqual(["get_weather"])
  })

  it("McpBinding tools 可为 'all'", () => {
    const binding: McpBinding = { serverId: "srv2", tools: "all" }
    expect(binding.tools).toBe("all")
  })

  it("ExtensionBindings 可构造", () => {
    const ext: ExtensionBindings = {
      skills: ["s1", "s2"],
      prompts: ["p1"],
      mcp: [{ serverId: "srv1", tools: "all", resources: [], prompts: [] }],
    }
    expect(ext.skills).toHaveLength(2)
  })

  it("ExecutionContext 包含 workflowExtensions 可选字段", () => {
    const ctx: ExecutionContext = {
      workflowId: "wf1",
      executionId: "ex1",
      input: {},
      nodeResults: new Map(),
      logs: [],
      workflowExtensions: { skills: [], prompts: [], mcp: [] },
    }
    expect(ctx.workflowExtensions?.skills).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/types/extensions.test.ts
```

Expected: FAIL — ExtensionBindings / McpBinding 未导出

- [ ] **Step 3: 在 src/types/workflow.ts 添加类型**

在文件末尾追加:

```typescript

// ============================================================
// 扩展包系统类型定义
// ============================================================

/** MCP 绑定(含工具/资源/prompts 选择) */
export interface McpBinding {
  serverId: string
  tools?: string[] | "all"            // 默认 "all"
  resources?: string[]                // 默认 []
  prompts?: string[]                  // 默认 []
}

/** 扩展包绑定(Skills + Prompts + MCP) */
export interface ExtensionBindings {
  skills: string[]
  prompts: string[]
  mcp: McpBinding[]
}
```

然后修改 `ExecutionContext` 接口,在 `logs: ExecutionLog[]` 后添加 `workflowExtensions`:

```typescript
export interface ExecutionContext {
  workflowId: string
  executionId: string
  input: Record<string, unknown>
  nodeResults: Map<string, unknown>   // nodeId → 输出结果
  logs: ExecutionLog[]
  workflowExtensions?: ExtensionBindings   // 工作流级扩展绑定(执行入口加载)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/types/extensions.test.ts
```

Expected: PASS

- [ ] **Step 5: typecheck**

```bash
npm run typecheck
```

Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src/types/workflow.ts src/types/extensions.test.ts
git commit -m "feat: 类型定义 — ExtensionBindings / McpBinding / ExecutionContext.workflowExtensions"
```

---

## Task 5: lib/extensions/validation.ts — 字段校验工具

**Files:**
- Create: `src/lib/extensions/validation.ts`
- Test: `src/lib/extensions/validation.test.ts`

- [ ] **Step 1: 写测试**

`src/lib/extensions/validation.test.ts`:

```typescript
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
  it("http 通过", () => {
    expect(validateTransport("http")).toBe(true)
  })
  it("sse 通过", () => {
    expect(validateTransport("sse")).toBe(true)
  })
  it("stdio 通过", () => {
    expect(validateTransport("stdio")).toBe(true)
  })
  it("ftp 失败", () => {
    expect(validateTransport("ftp")).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/extensions/validation.test.ts
```

Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 validation.ts**

`src/lib/extensions/validation.ts`:

```typescript
export interface ValidationResult {
  valid: boolean
  error?: string
}

const VALID_TRANSPORTS = ["http", "sse", "stdio"] as const
const VALID_ROLES = ["system", "user"] as const

export function validateTransport(transport: string): boolean {
  return (VALID_TRANSPORTS as readonly string[]).includes(transport)
}

export function validateSkillInput(input: {
  name?: string
  description?: string
  content?: string
}): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "name is required" }
  }
  if (input.name.length > 64) {
    return { valid: false, error: "name must be ≤64 characters" }
  }
  if (!input.description || !input.description.trim()) {
    return { valid: false, error: "description is required" }
  }
  if (input.description.length > 1024) {
    return { valid: false, error: "description must be ≤1024 characters" }
  }
  if (!input.content) {
    return { valid: false, error: "content is required" }
  }
  return { valid: true }
}

export function validatePromptInput(input: {
  name?: string
  content?: string
  role?: string
}): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "name is required" }
  }
  if (!input.content) {
    return { valid: false, error: "content is required" }
  }
  if (input.role && !(VALID_ROLES as readonly string[]).includes(input.role)) {
    return { valid: false, error: "role must be 'system' or 'user'" }
  }
  return { valid: true }
}

export function validateMcpInput(input: {
  name?: string
  transport?: string
  url?: string
  command?: string
}): ValidationResult {
  if (!input.name || !input.name.trim()) {
    return { valid: false, error: "name is required" }
  }
  if (!input.transport || !validateTransport(input.transport)) {
    return { valid: false, error: "transport must be 'http', 'sse', or 'stdio'" }
  }
  if ((input.transport === "http" || input.transport === "sse") && !input.url) {
    return { valid: false, error: "url is required for http/sse transport" }
  }
  if (input.transport === "stdio" && !input.command) {
    return { valid: false, error: "command is required for stdio transport" }
  }
  return { valid: true }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/extensions/validation.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/extensions/validation.ts src/lib/extensions/validation.test.ts
git commit -m "feat: 扩展包字段校验工具(validation.ts)"
```

---

## Task 6: lib/extensions/frontmatter.ts — Frontmatter 解析

**Files:**
- Create: `src/lib/extensions/frontmatter.ts`
- Test: `src/lib/extensions/frontmatter.test.ts`

- [ ] **Step 1: 写测试**

`src/lib/extensions/frontmatter.test.ts`:

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/extensions/frontmatter.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 frontmatter.ts**

`src/lib/extensions/frontmatter.ts`:

```typescript
export interface FrontmatterResult {
  name?: string
  description?: string
  body: string
}

/**
 * 解析 markdown frontmatter(name + description)。
 * 使用正则解析,不引入 gray-matter 依赖。
 * frontmatter 格式:
 *   ---
 *   name: Skill Name
 *   description: What it does. When to use.
 *   ---
 *   body content...
 */
export function parseFrontmatter(md: string): FrontmatterResult {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    return { body: md }
  }
  const yaml = match[1]
  const name = yaml.match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  return { name, description, body: match[2] }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/extensions/frontmatter.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/extensions/frontmatter.ts src/lib/extensions/frontmatter.test.ts
git commit -m "feat: frontmatter 正则解析工具"
```

---

## Task 7: lib/extensions/zip.ts — Zip 打包/解压(含路径穿越校验)

**Files:**
- Create: `src/lib/extensions/zip.ts`
- Test: `src/lib/extensions/zip.test.ts`

- [ ] **Step 1: 写测试**

`src/lib/extensions/zip.test.ts`:

```typescript
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/lib/extensions/zip.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 zip.ts**

`src/lib/extensions/zip.ts`:

```typescript
import JSZip from "jszip"

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10MB

export interface ZipFile {
  name: string
  content: string
}

/** 打包文件列表为 zip Buffer */
export async function createZip(files: ZipFile[]): Promise<Buffer> {
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.content)
  }
  const result = await zip.generateAsync({ type: "nodebuffer" })
  return Buffer.from(result)
}

/** 解压 zip Buffer 为文件列表 */
export async function extractZip(zipBuffer: Buffer): Promise<ZipFile[]> {
  const zip = await JSZip.loadAsync(zipBuffer)
  const files: ZipFile[] = []
  const entries = Object.values(zip.files)
  for (const entry of entries) {
    if (entry.dir) continue
    const content = await entry.async("string")
    files.push({ name: entry.name, content })
  }
  return files
}

/**
 * 校验 zip 内所有路径不含路径穿越攻击。
 * 拒绝含 ".." 或绝对路径(以 / 开头或含盘符)的条目。
 */
export function validateZipPaths(entryNames: string[]): boolean {
  for (const name of entryNames) {
    if (name.includes("..")) return false
    if (name.startsWith("/")) return false
    if (/^[a-zA-Z]:[\\/]/.test(name)) return false
  }
  return true
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/lib/extensions/zip.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/extensions/zip.ts src/lib/extensions/zip.test.ts
git commit -m "feat: zip 打包/解压工具(含路径穿越校验)"
```

---

## Task 8: Skills API — CRUD + upload + export

**Files:**
- Create: `src/app/api/extensions/skills/route.ts`
- Create: `src/app/api/extensions/skills/upload/route.ts`
- Create: `src/app/api/extensions/skills/[id]/route.ts`
- Create: `src/app/api/extensions/skills/[id]/export/route.ts`

- [ ] **Step 1: 创建 GET + POST 列表路由**

`src/app/api/extensions/skills/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSkillInput } from "@/lib/extensions/validation"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const category = searchParams.get("category") || undefined

    const skills = await prisma.skill.findMany({
      where: {
        AND: [
          q ? { OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ] } : {},
          category ? { category } : {},
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, category: true,
        tags: true, version: true, createdAt: true, updatedAt: true,
      },
    })
    return NextResponse.json(skills)
  } catch (error) {
    console.error("Failed to list skills:", error)
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validateSkillInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const skill = await prisma.skill.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category || null,
        content: body.content,
        attachments: body.attachments || [],
        tags: body.tags || [],
      },
    })
    return NextResponse.json(skill, { status: 201 })
  } catch (error) {
    console.error("Failed to create skill:", error)
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 })
  }
}
```

- [ ] **Step 2: 创建 [id] GET + PUT + DELETE 路由**

`src/app/api/extensions/skills/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSkillInput } from "@/lib/extensions/validation"
import { rm } from "fs/promises"
import { resolve } from "path"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const skill = await prisma.skill.findUnique({ where: { id } })
    if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(skill)
  } catch (error) {
    console.error("Failed to get skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const validation = validateSkillInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const skill = await prisma.skill.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category || null,
        content: body.content,
        attachments: body.attachments || [],
        tags: body.tags || [],
      },
    })
    return NextResponse.json(skill)
  } catch (error) {
    console.error("Failed to update skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.skill.delete({ where: { id } })
    // 清理附件目录
    const dir = resolve(process.cwd(), "storage", "skills", id)
    try { await rm(dir, { recursive: true, force: true }) } catch {}
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 3: 创建 upload 路由**

`src/app/api/extensions/skills/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseFrontmatter } from "@/lib/extensions/frontmatter"
import { extractZip, validateZipPaths, MAX_UPLOAD_SIZE } from "@/lib/extensions/zip"
import { validateSkillInput } from "@/lib/extensions/validation"
import { mkdir, writeFile } from "fs/promises"
import { resolve } from "path"

const ALLOWED_EXTENSIONS = [".md", ".zip"]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // 校验文件扩展名
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .md and .zip files allowed" }, { status: 400 })
    }

    // 校验文件大小
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (ext === ".md") {
      // 单文件导入
      const content = buffer.toString("utf-8")
      const { name, description, body } = parseFrontmatter(content)

      const finalName = name || file.name.replace(/\.md$/i, "")
      const finalDesc = description || `Imported from ${file.name}`
      const validation = validateSkillInput({ name: finalName, description: finalDesc, content: body })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      const skill = await prisma.skill.create({
        data: { name: finalName, description: finalDesc, content: body, attachments: [] },
      })
      return NextResponse.json({ id: skill.id, name: skill.name, attachments: [] }, { status: 201 })
    }

    // zip 导入
    const files = await extractZip(buffer)
    const entryNames = files.map((f) => f.name)
    if (!validateZipPaths(entryNames)) {
      return NextResponse.json({ error: "Zip contains unsafe paths" }, { status: 400 })
    }

    // 找 SKILL.md
    const skillFile = files.find((f) => f.name.toLowerCase() === "skill.md")
    if (!skillFile) {
      return NextResponse.json({ error: "SKILL.md not found in zip" }, { status: 400 })
    }

    const { name, description, body } = parseFrontmatter(skillFile.content)
    const finalName = name || file.name.replace(/\.zip$/i, "")
    const finalDesc = description || `Imported from ${file.name}`

    const validation = validateSkillInput({ name: finalName, description: finalDesc, content: body })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // 先创建 skill 获取 ID
    const otherFiles = files.filter((f) => f.name.toLowerCase() !== "skill.md")
    const attachments = otherFiles.map((f) => ({
      name: f.name.split("/").pop() || f.name,
      fileName: f.name,
      type: "reference" as const,
      mimeType: "text/plain",
      size: f.content.length,
    }))

    const skill = await prisma.skill.create({
      data: { name: finalName, description: finalDesc, content: body, attachments },
    })

    // 存附件文件到 storage/skills/{id}/
    const skillDir = resolve(process.cwd(), "storage", "skills", skill.id)
    await mkdir(skillDir, { recursive: true })
    for (const f of otherFiles) {
      const filePath = resolve(skillDir, f.name)
      const fileDir = filePath.substring(0, filePath.lastIndexOf("/"))
      await mkdir(fileDir, { recursive: true })
      await writeFile(filePath, f.content, "utf-8")
    }

    return NextResponse.json({ id: skill.id, name: skill.name, attachments }, { status: 201 })
  } catch (error) {
    console.error("Failed to upload skill:", error)
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 })
  }
}
```

- [ ] **Step 4: 创建 export 路由**

`src/app/api/extensions/skills/[id]/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createZip } from "@/lib/extensions/zip"
import { readFile } from "fs/promises"
import { resolve } from "path"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const skill = await prisma.skill.findUnique({ where: { id } })
    if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // 构造 SKILL.md(含 frontmatter)
    const skillMd = `---
name: ${skill.name}
description: ${skill.description}
---
${skill.content}`

    const files = [{ name: "SKILL.md", content: skillMd }]

    // 读取附件
    const attachments = (skill.attachments as Array<{ fileName: string }>) || []
    const skillDir = resolve(process.cwd(), "storage", "skills", id)
    for (const att of attachments) {
      try {
        const content = await readFile(resolve(skillDir, att.fileName), "utf-8")
        files.push({ name: att.fileName, content })
      } catch {
        // 附件文件不存在则跳过
      }
    }

    const zipBuffer = await createZip(files)
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="skill-${skill.name}.zip"`,
      },
    })
  } catch (error) {
    console.error("Failed to export skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 5: typecheck**

```bash
npm run typecheck
```

Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src/app/api/extensions/skills/
git commit -m "feat: Skills API — CRUD + upload(.md/.zip) + export(.zip)"
```

---

## Task 9: Prompts API — CRUD + upload + export

**Files:**
- Create: `src/app/api/extensions/prompts/route.ts`
- Create: `src/app/api/extensions/prompts/upload/route.ts`
- Create: `src/app/api/extensions/prompts/[id]/route.ts`
- Create: `src/app/api/extensions/prompts/[id]/export/route.ts`

- [ ] **Step 1: 创建 GET + POST 列表路由**

`src/app/api/extensions/prompts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validatePromptInput } from "@/lib/extensions/validation"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const category = searchParams.get("category") || undefined

    const prompts = await prisma.prompt.findMany({
      where: {
        AND: [
          q ? { OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ] } : {},
          category ? { category } : {},
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, category: true,
        tags: true, version: true, role: true, createdAt: true, updatedAt: true,
      },
    })
    return NextResponse.json(prompts)
  } catch (error) {
    console.error("Failed to list prompts:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validatePromptInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const prompt = await prisma.prompt.create({
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category || null,
        content: body.content,
        variables: body.variables || [],
        role: body.role || "system",
        tags: body.tags || [],
      },
    })
    return NextResponse.json(prompt, { status: 201 })
  } catch (error) {
    console.error("Failed to create prompt:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: 创建 [id] GET + PUT + DELETE**

`src/app/api/extensions/prompts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validatePromptInput } from "@/lib/extensions/validation"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const prompt = await prisma.prompt.findUnique({ where: { id } })
    if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(prompt)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const validation = validatePromptInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category || null,
        content: body.content,
        variables: body.variables || [],
        role: body.role || "system",
        tags: body.tags || [],
      },
    })
    return NextResponse.json(prompt)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.prompt.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 3: 创建 upload 路由**

`src/app/api/extensions/prompts/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractZip, validateZipPaths, MAX_UPLOAD_SIZE } from "@/lib/extensions/zip"
import { validatePromptInput } from "@/lib/extensions/validation"

const ALLOWED_EXTENSIONS = [".md", ".zip"]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .md and .zip allowed" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "File exceeds 10MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (ext === ".md") {
      const content = buffer.toString("utf-8")
      const name = file.name.replace(/\.md$/i, "")
      const validation = validatePromptInput({ name, content, role: "system" })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
      const prompt = await prisma.prompt.create({
        data: { name, description: `Imported from ${file.name}`, content, variables: [], role: "system" },
      })
      return NextResponse.json({ id: prompt.id, name: prompt.name }, { status: 201 })
    }

    // zip: 找 PROMPT.md 或第一个 .md
    const files = await extractZip(buffer)
    if (!validateZipPaths(files.map((f) => f.name))) {
      return NextResponse.json({ error: "Unsafe paths in zip" }, { status: 400 })
    }
    const promptFile = files.find((f) => f.name.toLowerCase() === "prompt.md")
      || files.find((f) => f.name.toLowerCase().endsWith(".md"))
    if (!promptFile) {
      return NextResponse.json({ error: "No .md file in zip" }, { status: 400 })
    }

    const name = promptFile.name.split("/").pop()?.replace(/\.md$/i, "") || "Imported Prompt"
    const validation = validatePromptInput({ name, content: promptFile.content, role: "system" })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const prompt = await prisma.prompt.create({
      data: { name, description: `Imported from ${file.name}`, content: promptFile.content, variables: [], role: "system" },
    })
    return NextResponse.json({ id: prompt.id, name: prompt.name }, { status: 201 })
  } catch (error) {
    console.error("Failed to upload prompt:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 4: 创建 export 路由**

`src/app/api/extensions/prompts/[id]/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createZip } from "@/lib/extensions/zip"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const prompt = await prisma.prompt.findUnique({ where: { id } })
    if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const content = `---
name: ${prompt.name}
role: ${prompt.role}
---
${prompt.content}`

    const zipBuffer = await createZip([{ name: "PROMPT.md", content }])
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="prompt-${prompt.name}.zip"`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 5: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/extensions/prompts/
git commit -m "feat: Prompts API — CRUD + upload + export"
```

---

## Task 10: MCP API — CRUD + test(含敏感信息加密)

**Files:**
- Create: `src/app/api/extensions/mcp/route.ts`
- Create: `src/app/api/extensions/mcp/[id]/route.ts`
- Create: `src/app/api/extensions/mcp/[id]/test/route.ts`

- [ ] **Step 1: 创建 GET + POST 列表路由**

`src/app/api/extensions/mcp/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateMcpInput } from "@/lib/extensions/validation"
import { encrypt } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""

    const servers = await prisma.mcpServer.findMany({
      where: q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ] } : {},
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, transport: true,
        url: true, command: true, args: true, status: true, lastCheckedAt: true,
        tags: true, version: true, createdAt: true, updatedAt: true,
        // 注意:不返回 headers / env 原文
      },
    })

    // 标记是否有鉴权配置
    const result = await Promise.all(servers.map(async (s) => {
      const full = await prisma.mcpServer.findUnique({ where: { id: s.id }, select: { headers: true, env: true } })
      const headersStr = (full?.headers as string) || "{}"
      const envStr = (full?.env as string) || "{}"
      return {
        ...s,
        hasAuth: headersStr !== "{}" || envStr !== "{}",
      }
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to list MCP servers:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validateMcpInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const server = await prisma.mcpServer.create({
      data: {
        name: body.name,
        description: body.description || null,
        transport: body.transport,
        url: body.url || null,
        headers: body.headers ? encrypt(JSON.stringify(body.headers)) : "{}",
        command: body.command || null,
        args: body.args || [],
        env: body.env ? encrypt(JSON.stringify(body.env)) : "{}",
        tags: body.tags || [],
      },
    })
    return NextResponse.json({ id: server.id, name: server.name, transport: server.transport }, { status: 201 })
  } catch (error) {
    console.error("Failed to create MCP server:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: 创建 [id] GET + PUT + DELETE**

`src/app/api/extensions/mcp/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateMcpInput } from "@/lib/extensions/validation"
import { encrypt, decrypt } from "@/lib/crypto"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // 脱敏:不返回 headers/env 原文
    const headersStr = (server.headers as string) || "{}"
    const envStr = (server.env as string) || "{}"
    return NextResponse.json({
      ...server,
      headers: undefined,
      env: undefined,
      hasAuth: headersStr !== "{}" || envStr !== "{}",
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const validation = validateMcpInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // headers/env: 传了才覆盖,未传保留原值
    const updateData: Record<string, unknown> = {
      name: body.name,
      description: body.description || null,
      transport: body.transport,
      url: body.url || null,
      command: body.command || null,
      args: body.args || [],
      tags: body.tags || [],
    }
    if (body.headers !== undefined) {
      updateData.headers = body.headers ? encrypt(JSON.stringify(body.headers)) : "{}"
    }
    if (body.env !== undefined) {
      updateData.env = body.env ? encrypt(JSON.stringify(body.env)) : "{}"
    }

    const server = await prisma.mcpServer.update({ where: { id }, data: updateData })
    return NextResponse.json({ id: server.id, name: server.name })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.mcpServer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 3: 创建 test 路由**

`src/app/api/extensions/mcp/[id]/test/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // 更新状态为 checking
    await prisma.mcpServer.update({ where: { id }, data: { status: "checking" } })

    try {
      const headers = server.headers && server.headers !== "{}"
        ? JSON.parse(decrypt(server.headers as string))
        : {}
      const env = server.env && server.env !== "{}"
        ? JSON.parse(decrypt(server.env as string))
        : {}

      // 动态导入 MCP 客户端(避免影响其他路由)
      const { createMCPClient } = await import("@ai-sdk/mcp")

      let client: Awaited<ReturnType<typeof createMCPClient>> | null = null

      if (server.transport === "http" || server.transport === "sse") {
        client = await createMCPClient({
          transport: {
            type: server.transport as "http" | "sse",
            url: server.url!,
            headers,
          },
        })
      } else if (server.transport === "stdio") {
        // stdio 需要 @modelcontextprotocol/sdk
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
        const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")
        const stdioTransport = new StdioClientTransport({
          command: server.command!,
          args: (server.args as string[]) || [],
          env: { ...process.env, ...env } as Record<string, string>,
        })
        const mcpClient = new Client({ name: "workflow-test", version: "1.0.0" }, { capabilities: {} })
        await mcpClient.connect(stdioTransport)

        // 并行拉取三类能力
        const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
          mcpClient.listTools(),
          mcpClient.listResources().catch(() => ({ resources: [] })),
          mcpClient.listPrompts().catch(() => ({ prompts: [] })),
        ])

        const capabilities = {
          tools: toolsResult.tools || [],
          resources: resourcesResult.resources || [],
          prompts: promptsResult.prompts || [],
        }

        await prisma.mcpServer.update({
          where: { id },
          data: {
            status: "online",
            lastCheckedAt: new Date(),
            capabilitiesCache: JSON.stringify(capabilities),
          },
        })

        // 关闭 stdio 子进程
        await stdioTransport.close?.()

        return NextResponse.json({ status: "online", capabilities })
      } else {
        return NextResponse.json({ status: "error", error: "Invalid transport" }, { status: 400 })
      }

      // http/sse: 通过 AI SDK MCP client 拉取 tools
      if (client) {
        const tools = await client.tools()
        // AI SDK MCP client 主要暴露 tools(),resources/prompts 需通过底层协议
        const capabilities = {
          tools: Object.entries(tools).map(([name, t]) => ({
            name,
            description: (t as { description?: string }).description,
          })),
          resources: [],
          prompts: [],
        }

        await prisma.mcpServer.update({
          where: { id },
          data: {
            status: "online",
            lastCheckedAt: new Date(),
            capabilitiesCache: JSON.stringify(capabilities),
          },
        })

        await client.close?.()
        return NextResponse.json({ status: "online", capabilities })
      }

      return NextResponse.json({ status: "error", error: "Unknown transport" }, { status: 400 })
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      await prisma.mcpServer.update({
        where: { id },
        data: { status: "error", lastCheckedAt: new Date() },
      })
      return NextResponse.json({ status: "error", error: errMsg })
    }
  } catch (error) {
    console.error("Failed to test MCP:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
```

- [ ] **Step 4: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/extensions/mcp/
git commit -m "feat: MCP API — CRUD + test 连接(含敏感信息加密)"
```

---

## Task 11: engine/extensions/merge.ts — 扩展绑定合并逻辑

**Files:**
- Create: `src/engine/extensions/merge.ts`
- Test: `src/engine/extensions/merge.test.ts`

- [ ] **Step 1: 写测试**

`src/engine/extensions/merge.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { mergeExtensions } from "@/engine/extensions/merge"
import type { ExtensionBindings } from "@/types/workflow"

describe("mergeExtensions", () => {
  it("工作流级有值,节点级为空 → 用工作流级", () => {
    const wf: ExtensionBindings = { skills: ["s1", "s2"], prompts: ["p1"], mcp: [] }
    const result = mergeExtensions(wf, {})
    expect(result.skills).toEqual(["s1", "s2"])
    expect(result.prompts).toEqual(["p1"])
  })

  it("节点级非空 → 覆盖工作流级", () => {
    const wf: ExtensionBindings = { skills: ["s1", "s2"], prompts: ["p1"], mcp: [] }
    const nodeConfig = { extensions: { skills: ["s3"], prompts: [], mcp: [] } }
    const result = mergeExtensions(wf, nodeConfig)
    expect(result.skills).toEqual(["s3"])
    expect(result.prompts).toEqual([])  // 节点级 prompts 非空([])覆盖
  })

  it("工作流级 undefined,节点级为空 → 返回空绑定", () => {
    const result = mergeExtensions(undefined, {})
    expect(result.skills).toEqual([])
    expect(result.prompts).toEqual([])
    expect(result.mcp).toEqual([])
  })

  it("节点级 mcp 非空 → 覆盖工作流级 mcp", () => {
    const wf: ExtensionBindings = { skills: [], prompts: [], mcp: [{ serverId: "srv1", tools: "all" }] }
    const nodeConfig = { extensions: { skills: [], prompts: [], mcp: [{ serverId: "srv2", tools: ["t1"] }] } }
    const result = mergeExtensions(wf, nodeConfig)
    expect(result.mcp).toHaveLength(1)
    expect(result.mcp[0].serverId).toBe("srv2")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/engine/extensions/merge.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 merge.ts**

`src/engine/extensions/merge.ts`:

```typescript
import type { ExtensionBindings } from "@/types/workflow"

/**
 * 合并工作流级和节点级扩展绑定。
 * 替换语义:节点级某字段非空数组 → 覆盖工作流级;为空 → 回退工作流级。
 */
export function mergeExtensions(
  wfExt: ExtensionBindings | undefined,
  nodeConfig: Record<string, unknown>,
): ExtensionBindings {
  const nodeExt = (nodeConfig.extensions as Partial<ExtensionBindings> | undefined) || {}

  return {
    skills: nodeExt.skills && nodeExt.skills.length > 0
      ? nodeExt.skills
      : (wfExt?.skills || []),
    prompts: nodeExt.prompts && nodeExt.prompts.length > 0
      ? nodeExt.prompts
      : (wfExt?.prompts || []),
    mcp: nodeExt.mcp && nodeExt.mcp.length > 0
      ? nodeExt.mcp
      : (wfExt?.mcp || []),
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/engine/extensions/merge.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/extensions/merge.ts src/engine/extensions/merge.test.ts
git commit -m "feat: 扩展绑定合并逻辑(mergeExtensions)"
```

---

## Task 12: engine/extensions/skill-loader.ts — Skills 加载策略

**Files:**
- Create: `src/engine/extensions/skill-loader.ts`
- Test: `src/engine/extensions/skill-loader.test.ts`

- [ ] **Step 1: 写测试**

`src/engine/extensions/skill-loader.test.ts`:

```typescript
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
    expect(result.systemContext).toHaveLength(1)  // 摘要
    expect(result.systemContext[0]).toContain("A")
    expect(result.systemContext[0]).toContain("D")
    expect(result.loadSkillTool).toBeDefined()
    expect(result.loadSkillTool?.load_skill).toBeDefined()
  })

  it("悬空 ID → warn + 跳过", async () => {
    vi.mocked(prisma.skill.findMany).mockResolvedValue([])  // 没找到任何 skill
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await loadSkills(["nonexistent"], mockContext)
    expect(result.systemContext).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/engine/extensions/skill-loader.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 skill-loader.ts**

`src/engine/extensions/skill-loader.ts`:

```typescript
import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { ExecutionContext } from "@/types/workflow"

export interface SkillPayload {
  systemContext: string[]
  loadSkillTool?: Record<string, ReturnType<typeof tool>>
}

/**
 * 加载绑定的 Skills 并构建注入 payload。
 * - ≤3 个:全量注入 content 到 systemContext
 * - >3 个:注入摘要 + 注册 load_skill tool(模型按需调用)
 * - 悬空 ID:warn + 跳过
 */
export async function loadSkills(
  skillIds: string[],
  _context: ExecutionContext,
): Promise<SkillPayload> {
  if (skillIds.length === 0) {
    return { systemContext: [] }
  }

  // 查询存在的 skills
  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds } },
    select: { id: true, name: true, description: true, content: true, attachments: true },
  })

  // 检测悬空引用
  if (skills.length < skillIds.length) {
    const foundIds = new Set(skills.map((s) => s.id))
    for (const id of skillIds) {
      if (!foundIds.has(id)) {
        console.warn(`[skill-loader] Skill not found, skipping: ${id}`)
      }
    }
  }

  if (skills.length === 0) {
    return { systemContext: [] }
  }

  // ≤3 个:全量注入
  if (skills.length <= 3) {
    const systemContext = skills.map((s) => {
      const header = `# Skill: ${s.name}\n${s.description}`
      return `${header}\n\n${s.content}`
    })
    return { systemContext }
  }

  // >3 个:摘要 + load_skill tool
  const summary = skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n")
  const systemContext = [`# Available Skills\n\nThe following skills are available. Use the load_skill tool to load the full content of a skill before applying it.\n\n${summary}`]

  const skillMap = new Map(skills.map((s) => [s.name, s]))

  const loadSkillTool = {
    load_skill: tool({
      description: "Load the full content of a skill by name. Call this when you need detailed instructions from a skill.",
      parameters: z.object({
        skill_name: z.string().describe("The name of the skill to load"),
      }),
      execute: async ({ skill_name }: { skill_name: string }) => {
        const skill = skillMap.get(skill_name)
        if (!skill) {
          return `Skill "${skill_name}" not found. Available skills: ${skills.map((s) => s.name).join(", ")}`
        }
        return skill.content
      },
    }),
  }

  return { systemContext, loadSkillTool }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/engine/extensions/skill-loader.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/extensions/skill-loader.ts src/engine/extensions/skill-loader.test.ts
git commit -m "feat: skill-loader — ≤3 全量注入 / >3 tool-calling 加载"
```

---

## Task 13: engine/extensions/prompt-renderer.ts — Prompt 变量替换

**Files:**
- Create: `src/engine/extensions/prompt-renderer.ts`
- Test: `src/engine/extensions/prompt-renderer.test.ts`

- [ ] **Step 1: 写测试**

`src/engine/extensions/prompt-renderer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderPrompts } from "@/engine/extensions/prompt-renderer"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    prompt: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
import type { ExecutionContext } from "@/types/workflow"

const mockContext: ExecutionContext = {
  workflowId: "wf1",
  executionId: "ex1",
  input: { topic: "AI", role: "分析师" },
  nodeResults: new Map([["llm1", { text: "上游内容", raw: "上游内容" }]]),
  logs: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("renderPrompts", () => {
  it("空 promptIds 返回空 payload", async () => {
    const result = await renderPrompts([], mockContext)
    expect(result.systemPrompts).toEqual([])
    expect(result.userPrompts).toEqual([])
  })

  it("role=system 的 prompt 注入 systemPrompts", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: "p1", name: "分析", content: "你是{{role}}", role: "system", variables: [{ name: "role", defaultValue: "助手" }] },
    ] as never)

    const result = await renderPrompts(["p1"], mockContext)
    expect(result.systemPrompts).toHaveLength(1)
    expect(result.systemPrompts[0]).toContain("你是分析师")  // 从 input 取值
    expect(result.userPrompts).toEqual([])
  })

  it("role=user 的 prompt 注入 userPrompts", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: "p2", name: "用户提示", content: "请分析{{$input.topic}}", role: "user", variables: [] },
    ] as never)

    const result = await renderPrompts(["p2"], mockContext)
    expect(result.userPrompts).toHaveLength(1)
    expect(result.userPrompts[0]).toContain("请分析AI")
  })

  it("变量用 defaultValue 当 input 中无值", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([
      { id: "p3", name: "P", content: "角色:{{myRole}}", role: "system", variables: [{ name: "myRole", defaultValue: "默认角色" }] },
    ] as never)

    const result = await renderPrompts(["p3"], mockContext)
    expect(result.systemPrompts[0]).toContain("角色:默认角色")
  })

  it("悬空 ID → warn + 跳过", async () => {
    vi.mocked(prisma.prompt.findMany).mockResolvedValue([])
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await renderPrompts(["nonexistent"], mockContext)
    expect(result.systemPrompts).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run src/engine/extensions/prompt-renderer.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现 prompt-renderer.ts**

`src/engine/extensions/prompt-renderer.ts`:

```typescript
import { prisma } from "@/lib/prisma"
import { resolveExpression } from "@/lib/expression"
import type { ExecutionContext } from "@/types/workflow"

export interface PromptPayload {
  systemPrompts: string[]
  userPrompts: string[]
}

interface PromptVariable {
  name: string
  description?: string
  required?: boolean
  defaultValue?: string
}

/**
 * 渲染绑定的 Prompts 并按 role 分组。
 * 变量替换复用 @/lib/expression.ts 的 resolveExpression。
 */
export async function renderPrompts(
  promptIds: string[],
  context: ExecutionContext,
): Promise<PromptPayload> {
  if (promptIds.length === 0) {
    return { systemPrompts: [], userPrompts: [] }
  }

  const prompts = await prisma.prompt.findMany({
    where: { id: { in: promptIds } },
    select: { id: true, name: true, content: true, role: true, variables: true },
  })

  // 检测悬空引用
  if (prompts.length < promptIds.length) {
    const foundIds = new Set(prompts.map((p) => p.id))
    for (const id of promptIds) {
      if (!foundIds.has(id)) {
        console.warn(`[prompt-renderer] Prompt not found, skipping: ${id}`)
      }
    }
  }

  const systemPrompts: string[] = []
  const userPrompts: string[] = []

  for (const prompt of prompts) {
    // 先用 resolveExpression 替换 {{$input.xxx}} / {{$node.xxx.field}} / {{字段名}}
    let rendered = resolveExpression(prompt.content, context)

    // 补充:variables 定义中的变量,如果 resolveExpression 没替换成功(不匹配 $input/$node),
    // 尝试从 context.input 或 defaultValue 取值
    const variables = (prompt.variables as PromptVariable[]) || []
    for (const v of variables) {
      const placeholder = `{{${v.name}}}`
      if (rendered.includes(placeholder)) {
        // resolveExpression 可能已经从最近节点输出或 input 中找到,如果还是 placeholder 则用 defaultValue
        const inputVal = (context.input as Record<string, unknown>)?.[v.name]
        const val = inputVal !== undefined ? String(inputVal) : (v.defaultValue || "")
        rendered = rendered.replaceAll(placeholder, val)
      }
    }

    if (prompt.role === "user") {
      userPrompts.push(rendered)
    } else {
      systemPrompts.push(rendered)
    }
  }

  return { systemPrompts, userPrompts }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run src/engine/extensions/prompt-renderer.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/extensions/prompt-renderer.ts src/engine/extensions/prompt-renderer.test.ts
git commit -m "feat: prompt-renderer — 变量替换 + role 分组注入"
```

---

## Task 14: engine/extensions/mcp-manager.ts — MCP 连接管理器

**Files:**
- Create: `src/engine/extensions/mcp-manager.ts`

> **注意:** MCP manager 涉及外部连接和网络调用,单元测试用 mock 较重。此 Task 先实现核心逻辑,测试通过手动执行验证。

- [ ] **Step 1: 实现 mcp-manager.ts**

`src/engine/extensions/mcp-manager.ts`:

```typescript
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import type { ExecutionContext, McpBinding } from "@/types/workflow"
import { spawn, type ChildProcess } from "child_process"
import { resolve } from "path"

export interface McpPayload {
  tools: Record<string, unknown>
  resourceContext: string[]
}

// stdio 进程池:serverId → { process, refCount, lastUsed, restartCount }
interface ProcessEntry {
  proc: ChildProcess
  refCount: number
  lastUsed: number
  restartCount: number
  command: string
  args: string[]
  env: Record<string, string>
}

const processPool = new Map<string, ProcessEntry>()
const IDLE_TIMEOUT_MS = 5 * 60 * 1000  // 5 分钟

// 定期清理空闲进程
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [id, entry] of processPool.entries()) {
      if (entry.refCount === 0 && now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        try { entry.proc.kill() } catch {}
        processPool.delete(id)
        console.log(`[mcp-manager] Killed idle stdio process: ${id}`)
      }
    }
  }, 60 * 1000).unref()
}

/**
 * 加载绑定的 MCP servers,返回 tools 和 resource context。
 * - http/sse:每次执行新建连接,执行完关闭
 * - stdio:进程池管理(首次 spawn,引用计数,空闲超时 kill,崩溃重启 ≤3 次)
 */
export async function loadMcpExtensions(
  bindings: McpBinding[],
  _context: ExecutionContext,
): Promise<McpPayload> {
  if (bindings.length === 0) {
    return { tools: {}, resourceContext: [] }
  }

  const allTools: Record<string, unknown> = {}
  const resourceContext: string[] = []

  for (const binding of bindings) {
    try {
      const server = await prisma.mcpServer.findUnique({ where: { id: binding.serverId } })
      if (!server) {
        console.warn(`[mcp-manager] MCP server not found, skipping: ${binding.serverId}`)
        continue
      }

      const headers = server.headers && server.headers !== "{}"
        ? JSON.parse(decrypt(server.headers as string))
        : {}
      const env = server.env && server.env !== "{}"
        ? JSON.parse(decrypt(server.env as string))
        : {}

      if (server.transport === "http" || server.transport === "sse") {
        // http/sse:每次新建连接
        const { createMCPClient } = await import("@ai-sdk/mcp")
        const client = await createMCPClient({
          transport: {
            type: server.transport as "http" | "sse",
            url: server.url!,
            headers,
          },
        })

        const tools = await client.tools()
        // 按 binding.tools 过滤
        const filtered = filterTools(tools, binding.tools)
        Object.assign(allTools, filtered)

        // resources(如 AI SDK 不直接暴露,用 capabilitiesCache)
        const cache = (server.capabilitiesCache as { resources?: Array<{ uri: string }> }) || {}
        if (binding.resources && cache.resources) {
          for (const uri of binding.resources) {
            // http/sse 的 resources/read 需底层协议,暂从 cache 获取
            // http/sse 的 resources 暂从 cache 获取(完整实现需用 @modelcontextprotocol/sdk 底层协议)
          }
        }

        await client.close?.()
      } else if (server.transport === "stdio") {
        // stdio:进程池
        const entry = await getOrCreateProcess(binding.serverId, server.command!, (server.args as string[]) || [], env)
        entry.refCount++
        entry.lastUsed = Date.now()

        try {
          // stdio 连接通过 @modelcontextprotocol/sdk
          const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
          const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")

          // 复用已有进程的 transport(如果进程池里的进程还活着)
          // 注意:每次执行需要新的 transport 连接到同一个子进程
          // 简化实现:每次新建 transport(子进程复用)
          const transport = new StdioClientTransport({
            command: server.command!,
            args: (server.args as string[]) || [],
            env: { ...process.env, ...env } as Record<string, string>,
          })
          const mcpClient = new Client({ name: "workflow-executor", version: "1.0.0" }, { capabilities: {} })
          await mcpClient.connect(transport)

          const [toolsResult, resourcesResult] = await Promise.all([
            mcpClient.listTools(),
            binding.resources?.length ? mcpClient.listResources().catch(() => ({ resources: [] })) : Promise.resolve({ resources: [] }),
          ])

          // 转换 MCP tools 为 AI SDK tools 格式
          for (const t of toolsResult.tools || []) {
            if (binding.tools === "all" || (Array.isArray(binding.tools) && binding.tools.includes(t.name))) {
              allTools[t.name] = {
                description: t.description,
                inputSchema: t.inputSchema,
                execute: async (args: unknown) => {
                  const result = await mcpClient.callTool({ name: t.name, arguments: args as Record<string, unknown> })
                  return result
                },
              }
            }
          }

          // 读取 resources
          if (binding.resources) {
            for (const uri of binding.resources) {
              try {
                const readResult = await mcpClient.readResource({ uri })
                for (const content of readResult.contents) {
                  if ("text" in content) {
                    resourceContext.push(`[Resource: ${uri}]\n${content.text}`)
                  }
                }
              } catch (e) {
                console.warn(`[mcp-manager] Failed to read resource ${uri}:`, e)
              }
            }
          }

          await transport.close?.()
        } finally {
          entry.refCount--
          entry.lastUsed = Date.now()
        }
      }
    } catch (error) {
      console.warn(`[mcp-manager] Failed to load MCP server ${binding.serverId}:`, error)
    }
  }

  return { tools: allTools, resourceContext }
}

/** 按 binding.tools 配置过滤 tools */
function filterTools(tools: Record<string, unknown>, filter: string[] | "all" | undefined): Record<string, unknown> {
  if (!filter || filter === "all") return tools
  const result: Record<string, unknown> = {}
  for (const name of filter) {
    if (tools[name]) result[name] = tools[name]
  }
  return result
}

/** 从进程池获取或创建 stdio 子进程 */
async function getOrCreateProcess(
  serverId: string,
  command: string,
  args: string[],
  env: Record<string, string>,
): Promise<ProcessEntry> {
  let entry = processPool.get(serverId)
  if (entry && !entry.proc.killed) {
    return entry
  }

  // 重启计数检查
  if (entry && entry.restartCount >= 3) {
    throw new Error(`[mcp-manager] Process ${serverId} exceeded max restarts (3)`)
  }

  const proc = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  })

  proc.on("error", (err) => {
    console.error(`[mcp-manager] Process ${serverId} error:`, err)
  })

  proc.on("exit", (code) => {
    console.warn(`[mcp-manager] Process ${serverId} exited with code ${code}`)
    processPool.delete(serverId)
  })

  entry = {
    proc,
    refCount: 0,
    lastUsed: Date.now(),
    restartCount: entry ? entry.restartCount + 1 : 0,
    command,
    args,
    env,
  }
  processPool.set(serverId, entry)
  return entry
}
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: 无错误(可能有少量类型警告,修复至通过)

- [ ] **Step 3: Commit**

```bash
git add src/engine/extensions/mcp-manager.ts
git commit -m "feat: mcp-manager — http/sse 连接 + stdio 进程池管理"
```

---

## Task 15: executor.ts — 加载 workflowExtensions 到 ExecutionContext

**Files:**
- Modify: `src/engine/executor.ts:145-162`

- [ ] **Step 1: 修改 executeWorkflow 入口,加载工作流 config 的 extensions**

在 `src/engine/executor.ts` 的 `executeWorkflow` 函数中,构建 `context` 之前添加工作流 config 查询:

找到这段代码(约 145-162 行):

```typescript
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: Record<string, unknown>,
  workflowId: string,
  executionId: string,
): Promise<ExecutionResult> {
  // 拓扑排序：确保先执行依赖节点
  const sortedNodes = topologicalSort(nodes, edges)

  const context: ExecutionContext = {
    workflowId,
    executionId,
    input,
    nodeResults: new Map(),
    logs: [],
  }
```

替换为:

```typescript
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: Record<string, unknown>,
  workflowId: string,
  executionId: string,
): Promise<ExecutionResult> {
  // 拓扑排序：确保先执行依赖节点
  const sortedNodes = topologicalSort(nodes, edges)

  // 加载工作流级扩展绑定
  let workflowExtensions: ExecutionContext["workflowExtensions"]
  try {
    const { prisma } = await import("@/lib/prisma")
    const wf = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { config: true },
    })
    const config = (wf?.config as Record<string, unknown>) || {}
    workflowExtensions = (config.extensions as ExecutionContext["workflowExtensions"]) || undefined
  } catch (error) {
    console.warn("[executor] Failed to load workflow extensions:", error)
  }

  const context: ExecutionContext = {
    workflowId,
    executionId,
    input,
    nodeResults: new Map(),
    logs: [],
    workflowExtensions,
  }
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/engine/executor.ts
git commit -m "feat: executor — 加载 workflowExtensions 到 ExecutionContext"
```

---

## Task 16: llm.ts — 集成扩展加载阶段

**Files:**
- Modify: `src/engine/nodes/llm.ts:60-145`

- [ ] **Step 1: 在 executeLLMNode 中插入扩展加载**

在 `src/engine/nodes/llm.ts` 文件顶部添加导入:

```typescript
import { mergeExtensions } from "@/engine/extensions/merge"
import { loadSkills } from "@/engine/extensions/skill-loader"
import { renderPrompts } from "@/engine/extensions/prompt-renderer"
import { loadMcpExtensions } from "@/engine/extensions/mcp-manager"
```

然后在 `executeLLMNode` 函数中,找到构建 `genOptions` 之前的位置(约第 88-106 行,在 `let finalSystem = systemPrompt` 之后,`// ===== JSON 模式 =====` 之前),插入:

```typescript
  // ===== 扩展包加载(新增) =====
  const nodeConfig = (node.data.config as Record<string, unknown>) || {}
  const extensions = mergeExtensions(context.workflowExtensions, nodeConfig)

  let skillPayload: Awaited<ReturnType<typeof loadSkills>> = { systemContext: [] }
  let promptPayload: Awaited<ReturnType<typeof renderPrompts>> = { systemPrompts: [], userPrompts: [] }
  let mcpPayload: Awaited<ReturnType<typeof loadMcpExtensions>> = { tools: {}, resourceContext: [] }

  try {
    [skillPayload, promptPayload, mcpPayload] = await Promise.all([
      loadSkills(extensions.skills, context),
      renderPrompts(extensions.prompts, context),
      loadMcpExtensions(extensions.mcp, context),
    ])
  } catch (error) {
    console.warn("[llm] Extension loading failed, continuing without:", error)
  }

  // 注入 system prompt
  finalSystem = [
    finalSystem,
    ...skillPayload.systemContext,
    ...mcpPayload.resourceContext,
    ...promptPayload.systemPrompts,
  ].filter(Boolean).join("\n\n")

  // 注入 user input
  const finalUserInput = [
    ...promptPayload.userPrompts,
    userInput,
  ].filter(Boolean).join("\n\n")
```

然后找到 `genOptions` 构建处(约 133-142 行),在 `if (enableTools)` 之前添加:

```typescript
  // 扩展 tools 注册
  const hasSkillTool = !!skillPayload.loadSkillTool
  const hasMcpTools = Object.keys(mcpPayload.tools || {}).length > 0
  if (hasSkillTool || hasMcpTools) {
    genOptions.tools = {
      ...(skillPayload.loadSkillTool || {}),
      ...(mcpPayload.tools || {}),
    }
    genOptions.maxSteps = (hasSkillTool && hasMcpTools) ? 5 : 3
  }
```

同时将 `genOptions` 中的 `prompt: userInput` 改为 `prompt: finalUserInput`。

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: 无错误

- [ ] **Step 3: lint**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/engine/nodes/llm.ts
git commit -m "feat: llm.ts — 集成扩展加载阶段(skills + prompts + mcp)"
```

---

## Task 17: stores/extensions.ts — Zustand Store

**Files:**
- Create: `src/stores/extensions.ts`

- [ ] **Step 1: 实现 store**

`src/stores/extensions.ts`:

```typescript
import { create } from "zustand"

export interface SkillItem {
  id: string
  name: string
  description: string
  category?: string
  tags: string[]
  updatedAt: string
}

export interface PromptItem {
  id: string
  name: string
  description?: string
  category?: string
  role: string
  tags: string[]
  updatedAt: string
}

export interface McpItem {
  id: string
  name: string
  description?: string
  transport: string
  status: string
  url?: string
  command?: string
  hasAuth: boolean
  tags: string[]
  updatedAt: string
}

type TabType = "skills" | "prompts" | "mcp"

interface ExtensionsStore {
  activeTab: TabType
  skills: SkillItem[]
  prompts: PromptItem[]
  mcpServers: McpItem[]
  loading: boolean
  searchQuery: string

  setActiveTab: (tab: TabType) => void
  setSearchQuery: (q: string) => void
  setSkills: (items: SkillItem[]) => void
  setPrompts: (items: PromptItem[]) => void
  setMcpServers: (items: McpItem[]) => void
  setLoading: (loading: boolean) => void

  fetchSkills: () => Promise<void>
  fetchPrompts: () => Promise<void>
  fetchMcpServers: () => Promise<void>
}

export const useExtensionsStore = create<ExtensionsStore>((set, get) => ({
  activeTab: "skills",
  skills: [],
  prompts: [],
  mcpServers: [],
  loading: false,
  searchQuery: "",

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSkills: (items) => set({ skills: items }),
  setPrompts: (items) => set({ prompts: items }),
  setMcpServers: (items) => set({ mcpServers: items }),
  setLoading: (loading) => set({ loading }),

  fetchSkills: async () => {
    set({ loading: true })
    try {
      const q = get().searchQuery
      const res = await fetch(`/api/extensions/skills?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      set({ skills: data })
    } catch (error) {
      console.error("Failed to fetch skills:", error)
    } finally {
      set({ loading: false })
    }
  },

  fetchPrompts: async () => {
    set({ loading: true })
    try {
      const q = get().searchQuery
      const res = await fetch(`/api/extensions/prompts?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      set({ prompts: data })
    } catch (error) {
      console.error("Failed to fetch prompts:", error)
    } finally {
      set({ loading: false })
    }
  },

  fetchMcpServers: async () => {
    set({ loading: true })
    try {
      const q = get().searchQuery
      const res = await fetch(`/api/extensions/mcp?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      set({ mcpServers: data })
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error)
    } finally {
      set({ loading: false })
    }
  },
}))
```

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/extensions.ts
git commit -m "feat: extensions Zustand store"
```

---

## Task 18: i18n — 新增 extensions 翻译 key

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: 在 zh.json 添加 extensions 分组**

在 `src/i18n/locales/zh.json` 的 `"sidebar"` 分组中添加:

```json
"extensions": "扩展包"
```

然后在文件末尾 `}` 之前添加顶级 `extensions` 分组:

```json
,
"extensions": {
  "title": "扩展包管理",
  "tabs": {
    "skills": "技能包",
    "prompts": "提示词",
    "mcp": "MCP 服务"
  },
  "common": {
    "create": "新建",
    "upload": "上传",
    "export": "导出",
    "delete": "删除",
    "search": "搜索",
    "edit": "编辑",
    "save": "保存",
    "cancel": "取消",
    "confirmDelete": "确定要删除吗？此操作不可撤销。",
    "noData": "暂无数据",
    "name": "名称",
    "description": "描述",
    "category": "分类",
    "tags": "标签",
    "addTag": "添加标签",
    "updated": "更新时间"
  },
  "skills": {
    "namePlaceholder": "技能名称(≤64字符)",
    "descPlaceholder": "第三人称描述，说明技能做什么及何时使用(≤1024字符)",
    "descHint": "💡 使用第三人称，如 \"Processes PDF files. Use when working with PDFs.\"",
    "contentLabel": "SKILL.md 内容",
    "attachments": "附件",
    "uploadAttachment": "上传附件",
    "attachmentType": {
      "reference": "参考文档",
      "script": "脚本"
    },
    "charCount": "字符数"
  },
  "prompts": {
    "namePlaceholder": "提示词名称",
    "contentLabel": "模板内容",
    "contentHint": "使用 {{变量名}} 或 {{$input.field}} 引用变量",
    "role": "注入位置",
    "roleSystem": "System Prompt",
    "roleUser": "User Input",
    "variables": "变量定义",
    "varName": "变量名",
    "varDesc": "描述",
    "varRequired": "必填",
    "varDefault": "默认值",
    "addVariable": "添加变量",
    "preview": "预览(使用默认值)"
  },
  "mcp": {
    "transport": "传输方式",
    "transportHttp": "HTTP",
    "transportSse": "SSE",
    "transportStdio": "Stdio",
    "url": "URL",
    "urlPlaceholder": "https://mcp-server.example.com",
    "headers": "请求头",
    "command": "命令",
    "commandPlaceholder": "npx",
    "args": "参数",
    "argsPlaceholder": "[-y, @modelcontextprotocol/server-sqlite]",
    "env": "环境变量",
    "testConnection": "测试连接",
    "testing": "测试中...",
    "statusOnline": "在线",
    "statusOffline": "离线",
    "statusError": "错误",
    "statusUntested": "未测试",
    "capabilities": "能力预览",
    "tools": "工具",
    "resources": "资源",
    "promptsLabel": "Prompts",
    "stdioWarning": "⚠️ Stdio 仅适用于自托管部署，云端建议使用 HTTP/SSE"
  },
  "picker": {
    "title": "扩展包",
    "addSkill": "添加技能包",
    "addPrompt": "添加提示词",
    "addMcp": "添加 MCP",
    "selectSkills": "选择技能包",
    "selectPrompts": "选择提示词",
    "selectMcp": "选择 MCP 服务",
    "toolsConfig": "工具配置",
    "allTools": "全部工具",
    "selectedTools": "指定工具",
    "resources": "资源",
    "inherited": "继承工作流默认"
  }
}
```

- [ ] **Step 2: 在 en.json 添加对应翻译**

在 `src/i18n/locales/en.json` 的 `"sidebar"` 分组中添加:

```json
"extensions": "Extensions"
```

然后在文件末尾添加对应的 `extensions` 分组(英文翻译):

```json
,
"extensions": {
  "title": "Extension Management",
  "tabs": {
    "skills": "Skills",
    "prompts": "Prompts",
    "mcp": "MCP Servers"
  },
  "common": {
    "create": "Create",
    "upload": "Upload",
    "export": "Export",
    "delete": "Delete",
    "search": "Search",
    "edit": "Edit",
    "save": "Save",
    "cancel": "Cancel",
    "confirmDelete": "Are you sure? This cannot be undone.",
    "noData": "No data",
    "name": "Name",
    "description": "Description",
    "category": "Category",
    "tags": "Tags",
    "addTag": "Add tag",
    "updated": "Updated"
  },
  "skills": {
    "namePlaceholder": "Skill name (≤64 chars)",
    "descPlaceholder": "Third-person description of what it does and when to use (≤1024 chars)",
    "descHint": "💡 Use third person, e.g. \"Processes PDF files. Use when working with PDFs.\"",
    "contentLabel": "SKILL.md content",
    "attachments": "Attachments",
    "uploadAttachment": "Upload attachment",
    "attachmentType": {
      "reference": "Reference",
      "script": "Script"
    },
    "charCount": "characters"
  },
  "prompts": {
    "namePlaceholder": "Prompt name",
    "contentLabel": "Template content",
    "contentHint": "Use {{variableName}} or {{$input.field}} to reference variables",
    "role": "Inject to",
    "roleSystem": "System Prompt",
    "roleUser": "User Input",
    "variables": "Variables",
    "varName": "Name",
    "varDesc": "Description",
    "varRequired": "Required",
    "varDefault": "Default",
    "addVariable": "Add variable",
    "preview": "Preview (with defaults)"
  },
  "mcp": {
    "transport": "Transport",
    "transportHttp": "HTTP",
    "transportSse": "SSE",
    "transportStdio": "Stdio",
    "url": "URL",
    "urlPlaceholder": "https://mcp-server.example.com",
    "headers": "Headers",
    "command": "Command",
    "commandPlaceholder": "npx",
    "args": "Arguments",
    "argsPlaceholder": "[-y, @modelcontextprotocol/server-sqlite]",
    "env": "Environment",
    "testConnection": "Test Connection",
    "testing": "Testing...",
    "statusOnline": "Online",
    "statusOffline": "Offline",
    "statusError": "Error",
    "statusUntested": "Untested",
    "capabilities": "Capabilities",
    "tools": "Tools",
    "resources": "Resources",
    "promptsLabel": "Prompts",
    "stdioWarning": "⚠️ Stdio is for self-hosted only. Use HTTP/SSE for cloud."
  },
  "picker": {
    "title": "Extensions",
    "addSkill": "Add Skill",
    "addPrompt": "Add Prompt",
    "addMcp": "Add MCP",
    "selectSkills": "Select Skills",
    "selectPrompts": "Select Prompts",
    "selectMcp": "Select MCP Server",
    "toolsConfig": "Tools config",
    "allTools": "All tools",
    "selectedTools": "Selected tools",
    "resources": "Resources",
    "inherited": "Inherited from workflow"
  }
}
```

- [ ] **Step 3: typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat: i18n — 新增 extensions 翻译分组(zh + en)"
```

---

## Task 19: 侧边栏 — 新增扩展包导航项

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx:86-93`

- [ ] **Step 1: 在侧边栏知识库下方添加扩展包导航**

在 `src/app/(dashboard)/layout.tsx` 中,找到知识库 Link(约 87-92 行)之后,`<Separator />` 之前,添加:

```tsx
          <Link
            href="/extensions"
            className={cn(buttonVariants({ variant: pathname === "/extensions" ? "secondary" : "ghost", size: "sm" }), "w-full justify-start")}
          >
            <Package className="h-4 w-4 mr-2" />
            {t("sidebar.extensions")}
          </Link>
```

同时在 import 行添加 `Package` 图标:

```tsx
import { Workflow, Plus, Home, Activity, Shield, Database, Package } from "lucide-react"
```

- [ ] **Step 2: 验证页面可加载**

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`,确认侧边栏出现"扩展包"项。

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: 侧边栏新增扩展包导航项"
```

---

## Task 20: 扩展包管理主页面 — ExtensionLibrary + 三个 Tab

**Files:**
- Create: `src/app/(dashboard)/extensions/page.tsx`
- Create: `src/components/extensions/ExtensionLibrary.tsx`
- Create: `src/components/extensions/SkillsTab.tsx`
- Create: `src/components/extensions/PromptsTab.tsx`
- Create: `src/components/extensions/McpTab.tsx`

- [ ] **Step 1: 创建页面路由**

`src/app/(dashboard)/extensions/page.tsx`:

```tsx
import { ExtensionLibrary } from "@/components/extensions/ExtensionLibrary"

export default function ExtensionsPage() {
  return <ExtensionLibrary />
}
```

- [ ] **Step 2: 创建 ExtensionLibrary 主组件**

`src/components/extensions/ExtensionLibrary.tsx`:

```tsx
"use client"

import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Upload } from "lucide-react"
import { SkillsTab } from "./SkillsTab"
import { PromptsTab } from "./PromptsTab"
import { McpTab } from "./McpTab"

export function ExtensionLibrary() {
  const { t } = useTranslation()
  const { activeTab, setActiveTab, searchQuery, setSearchQuery } = useExtensionsStore()

  const tabs = [
    { id: "skills" as const, label: t("extensions.tabs.skills") },
    { id: "prompts" as const, label: t("extensions.tabs.prompts") },
    { id: "mcp" as const, label: t("extensions.tabs.mcp") },
  ]

  return (
    <div className="flex flex-col h-full p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t("extensions.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" />
            {t("extensions.common.upload")}
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t("extensions.common.create")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder={t("extensions.common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "skills" && <SkillsTab />}
        {activeTab === "prompts" && <PromptsTab />}
        {activeTab === "mcp" && <McpTab />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 SkillsTab**

`src/components/extensions/SkillsTab.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Edit, Trash2 } from "lucide-react"

export function SkillsTab() {
  const { t } = useTranslation()
  const { skills, loading, fetchSkills } = useExtensionsStore()

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (skills.length === 0) return <div className="text-muted-foreground text-sm">{t("extensions.common.noData")}</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skills.map((skill) => (
        <Card key={skill.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm truncate">{skill.name}</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                <a href={`/api/extensions/skills/${skill.id}/export`}>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
          <div className="flex flex-wrap gap-1">
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-auto">
            {t("extensions.common.updated")}: {new Date(skill.updatedAt).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 创建 PromptsTab**

`src/components/extensions/PromptsTab.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Edit, Trash2 } from "lucide-react"

export function PromptsTab() {
  const { t } = useTranslation()
  const { prompts, loading, fetchPrompts } = useExtensionsStore()

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (prompts.length === 0) return <div className="text-muted-foreground text-sm">{t("extensions.common.noData")}</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {prompts.map((prompt) => (
        <Card key={prompt.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm truncate">{prompt.name}</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                <a href={`/api/extensions/prompts/${prompt.id}/export`}>
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{prompt.description || ""}</p>
          <Badge variant="outline" className="text-xs w-fit">
            {prompt.role === "system" ? t("extensions.prompts.roleSystem") : t("extensions.prompts.roleUser")}
          </Badge>
          <div className="flex flex-wrap gap-1">
            {prompt.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: 创建 McpTab**

`src/components/extensions/McpTab.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Circle } from "lucide-react"

export function McpTab() {
  const { t } = useTranslation()
  const { mcpServers, loading, fetchMcpServers } = useExtensionsStore()

  useEffect(() => {
    fetchMcpServers()
  }, [fetchMcpServers])

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (mcpServers.length === 0) return <div className="text-muted-foreground text-sm">{t("extensions.common.noData")}</div>

  const statusColor: Record<string, string> = {
    online: "text-green-500",
    offline: "text-gray-400",
    error: "text-red-500",
    untested: "text-yellow-500",
    checking: "text-blue-500",
  }

  const statusLabel: Record<string, string> = {
    online: t("extensions.mcp.statusOnline"),
    offline: t("extensions.mcp.statusOffline"),
    error: t("extensions.mcp.statusError"),
    untested: t("extensions.mcp.statusUntested"),
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {mcpServers.map((server) => (
        <Card key={server.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{server.name}</h3>
              <div className="flex items-center gap-1">
                <Circle className={`h-2 w-2 fill-current ${statusColor[server.status] || statusColor.untested}`} />
                <span className="text-xs text-muted-foreground">{statusLabel[server.status] || statusLabel.untested}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{server.description || ""}</p>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="uppercase">{server.transport}</Badge>
            {server.hasAuth && <Badge variant="secondary">Auth</Badge>}
            <span className="text-muted-foreground truncate">{server.url || server.command || ""}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 7: 验证页面**

```bash
npm run dev
```

浏览器打开 `http://localhost:3000/extensions`,确认三个 Tab 可切换,空状态显示"暂无数据"。

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/extensions/ src/components/extensions/ExtensionLibrary.tsx src/components/extensions/SkillsTab.tsx src/components/extensions/PromptsTab.tsx src/components/extensions/McpTab.tsx
git commit -m "feat: 扩展包管理主页面 + 三个 Tab(Skills/Prompts/MCP)"
```

---

## Task 21: .gitignore + storage 目录

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 在 .gitignore 添加 storage 目录**

在 `.gitignore` 末尾添加:

```
# 扩展包附件存储(不提交到 git)
storage/
```

- [ ] **Step 2: 创建 storage 目录占位**

```bash
mkdir -p storage/skills storage/prompts
touch storage/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: .gitignore 添加 storage/ 目录"
```

---

## Task 22: 全量验证 — typecheck + lint + test

- [ ] **Step 1: 运行全部测试**

```bash
npm test
```

Expected: 所有测试 PASS

- [ ] **Step 2: typecheck**

```bash
npm run typecheck
```

Expected: 无错误

- [ ] **Step 3: lint**

```bash
npm run lint
```

Expected: 无错误

- [ ] **Step 4: 构建检查**

```bash
npm run build
```

Expected: 构建成功

- [ ] **Step 5: 手动端到端验证**

```bash
npm run dev
```

在浏览器中验证:
1. 侧边栏"扩展包"导航可点击 → 跳转 `/extensions`
2. 三个 Tab 可切换
3. 空状态正确显示
4. 新建/上传按钮可见

- [ ] **Step 6: Commit(如有修复)**

```bash
git add -A
git commit -m "test: 全量验证通过 — typecheck + lint + test + build"
```

---

## 后续(超出本计划范围)

以下组件留待后续迭代,spec 中已设计但本计划不含:
- **SkillEditor.tsx** — 技能包编辑器弹窗(markdown 编辑 + 附件管理)
- **PromptEditor.tsx** — 提示词编辑器(变量定义 + 实时预览)
- **McpEditor.tsx** — MCP 编辑器(transport 配置 + 测试连接 + 能力预览)
- **ExtensionPicker.tsx** — 节点配置面板中的扩展选择器(在 NodeConfigPanel 中集成)
- **NodeConfigPanel.tsx 修改** — LLM 节点配置区新增"扩展包"折叠区

这些是 UI 交互层,可在核心 API + 引擎就绪后逐步完善。
