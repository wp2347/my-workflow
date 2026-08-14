# 技能包系统 + 官方文件/文档 MCP 包 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增"技能包"机制（清单 schema + 内置官方包 + JSON 导入 + 市场 UI），并交付官方 filesystem 与自研 office 两个 MCP 包（Markdown→docx / JSON→xlsx / 大纲→pptx / 内容→pdf），实现文件读取与 Word/Excel/PPT/PDF 生成，引擎零改动。

**Architecture:** 技能包清单（JSON）由 `src/lib/packs/` 负责校验与安装服务；内置包存 `src/packs/*.json`，导入包存新 `Pack` 表；安装 = 按清单创建 `McpServer`/`Skill`/`Prompt` 行（带 `packId`），复用现有 `mcp-manager.ts` 的 stdio 拉起。自研 `src/mcp/office-server.ts` 用 `@modelcontextprotocol/sdk` + `docx`/`exceljs`/`pptxgenjs`/`pdfmake`/`marked`（纯 JS 无浏览器）。扩展页新增"技能包市场"标签。

**Tech Stack:** Next.js 16、Prisma、zod、@modelcontextprotocol/sdk、docx、exceljs、pptxgenjs、pdfmake、marked、vitest。

**验证命令（每个任务通用）：**
```bash
npm run typecheck
npm run lint        # 仅允许存量 24 个 error（React hooks/require 规则），新增代码不得引入新 error
npm run build
```

---

### Task 1: Prisma schema —— packId 列 + Pack 表

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/stores/extensions.ts`

- [ ] **Step 1: 给 Skill/Prompt/McpServer 加 packId，新增 Pack 表**

在 `prisma/schema.prisma` 中：

`model Skill` 的 `category String?` 之后插入：
```prisma
  packId    String?  @map("pack_id")
```
（保持字段缩进与其余字段一致。）

`model Prompt` 的 `category String?` 之后插入：
```prisma
  packId    String?  @map("pack_id")
```

`model McpServer` 的 `tags String[] @default([])` 之前插入：
```prisma
  packId    String?  @map("pack_id")
```

文件末尾追加：
```prisma
model Pack {
  id          String   @id
  name        String
  description String   @db.Text
  category    String?
  icon        String?
  version     String
  source      String   @default("imported")
  manifest    Json
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("packs")
}
```

- [ ] **Step 2: 生成并同步数据库**

Run:
```bash
npm run db:push && npm run db:generate
```
Expected: 输出同步完成、Prisma Client 重新生成。

- [ ] **Step 3: 扩展 store 类型加 packId（可选字段）**

`src/stores/extensions.ts` 中三个 item 接口各加 `packId?: string`：
- `SkillItem`、`PromptItem`、`McpItem`（加在 `tags` 字段后）

- [ ] **Step 4: 验证**

Run: `npm run typecheck && npm run lint`
Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/stores/extensions.ts
git commit -m "feat(packs): Skill/Prompt/McpServer 增加 packId，新增 Pack 表"
```

---

### Task 2: 技能包清单 schema 与校验

**Files:**
- Create: `src/lib/packs/schema.ts`
- Create: `src/lib/packs/schema.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/packs/schema.test.ts`：

```ts
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
    const { mcps, ...noMcps } = validManifest
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/packs/schema.test.ts`
Expected: FAIL（`Cannot find module './schema'`）。

- [ ] **Step 3: 实现 schema.ts**

`src/lib/packs/schema.ts`：

```ts
import { z } from "zod"

export const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/

const mcpInManifestSchema = z.object({
  name: z.string().min(1).max(64),
  transport: z.enum(["stdio", "http", "sse"]),
  url: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tools: z.union([z.literal("all"), z.array(z.string())]).optional(),
  resources: z.array(z.string()).optional(),
})

const skillInManifestSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().min(1),
  category: z.string().optional(),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
})

const promptInManifestSchema = skillInManifestSchema.extend({
  role: z.enum(["system", "user"]).optional(),
  variables: z.array(z.string()).optional(),
})

export const packManifestSchema = z.object({
  id: z.string().regex(PACK_ID_PATTERN, "id must match ^[a-z0-9][a-z0-9-]{1,63}$"),
  name: z.string().min(1).max(64),
  description: z.string().min(1).max(1024),
  category: z.string().optional(),
  icon: z.string().optional(),
  version: z.string().min(1),
  mcps: z.array(mcpInManifestSchema).min(1, "at least one mcp required"),
  skills: z.array(skillInManifestSchema).optional().default([]),
  prompts: z.array(promptInManifestSchema).optional().default([]),
})

export type PackManifest = z.infer<typeof packManifestSchema>

export interface PackValidationResult {
  valid: boolean
  data?: PackManifest
  error?: string
}

export function validatePackManifest(input: unknown): PackValidationResult {
  const result = packManifestSchema.safeParse(input)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  const first = result.error.issues[0]
  return { valid: false, error: first ? `${first.path.join(".") || "manifest"}: ${first.message}` : "invalid manifest" }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/packs/schema.test.ts`
Expected: PASS（4 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/packs/schema.ts src/lib/packs/schema.test.ts
git commit -m "feat(packs): 技能包清单 zod schema 与校验"
```

---

### Task 3: 内置官方技能包清单 + 加载器

**Files:**
- Create: `src/packs/filesystem.json`
- Create: `src/packs/office.json`
- Create: `src/lib/packs/builtin.ts`
- Create: `src/lib/packs/builtin.test.ts`

- [ ] **Step 1: 写 filesystem 包清单**

`src/packs/filesystem.json`：

```json
{
  "id": "filesystem",
  "name": "filesystem",
  "description": "Read, write, list and search local files under the allowed directories. Defaults to the storage/ folder; edit the server args to allow more directories.",
  "category": "file",
  "icon": "folder-open",
  "version": "1.0.0",
  "mcps": [
    {
      "name": "filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "storage"],
      "tools": "all"
    }
  ],
  "skills": [
    {
      "name": "filesystem-usage",
      "description": "Guide for reading local files with the filesystem MCP server.",
      "category": "file",
      "content": "You have access to a local filesystem MCP server. Use list_directory to enumerate a folder, read_file to read a file's content, and search_files to find files by name or pattern. All operations are restricted to the allowed directories configured on the server. When a workflow mentions reading local files, start by listing the target directory, then read the relevant files and summarize their content for the workflow."
    }
  ]
}
```

- [ ] **Step 2: 写 office 包清单**

`src/packs/office.json`：

```json
{
  "id": "office",
  "name": "office",
  "description": "Generate Word (.docx), Excel (.xlsx), PowerPoint (.pptx) and PDF files from content. All file paths must start with storage/.",
  "category": "office",
  "icon": "file-text",
  "version": "1.0.0",
  "mcps": [
    {
      "name": "office",
      "transport": "stdio",
      "command": "npx",
      "args": ["tsx", "src/mcp/office-server.ts"],
      "tools": "all"
    }
  ],
  "skills": [
    {
      "name": "office-usage",
      "description": "Guide for generating Office and PDF documents.",
      "category": "office",
      "content": "You can generate documents with these MCP tools:\n- create_docx({markdown, outputPath}): Word document from Markdown.\n- create_xlsx({rows, outputPath}): Excel spreadsheet from an array of JSON objects (keys become the header row).\n- create_pptx({outline, outputPath}): PowerPoint from a Markdown outline where each top-level heading (#) is a slide and lists become bullets.\n- create_pdf({content, outputPath}): PDF from Markdown.\n\nRules: outputPath must start with storage/ and end with the matching extension. Create the Markdown/JSON content yourself, then call the matching tool. If the user asked for a report, prefer create_docx or create_pdf. If they provided tabular data, use create_xlsx."
    }
  ]
}
```

- [ ] **Step 3: 写失败测试**

`src/lib/packs/builtin.test.ts`：

```ts
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
```

- [ ] **Step 4: 跑测试确认失败**

Run: `npx vitest run src/lib/packs/builtin.test.ts`
Expected: FAIL（`Cannot find module './builtin'`）。

- [ ] **Step 5: 实现 builtin.ts**

`src/lib/packs/builtin.ts`：

```ts
import fs from "fs"
import path from "path"
import { validatePackManifest, type PackManifest } from "./schema"

export function getBuiltinPacks(): PackManifest[] {
  const dir = path.join(process.cwd(), "src", "packs")
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
  const packs: PackManifest[] = []
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8")
    const result = validatePackManifest(JSON.parse(raw))
    if (!result.valid || !result.data) {
      throw new Error(`Invalid builtin pack ${file}: ${result.error}`)
    }
    packs.push(result.data)
  }
  return packs
}

export function getBuiltinPack(id: string): PackManifest | undefined {
  return getBuiltinPacks().find((p) => p.id === id)
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run src/lib/packs/builtin.test.ts`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add src/packs/ src/lib/packs/builtin.ts src/lib/packs/builtin.test.ts
git commit -m "feat(packs): 内置 filesystem/office 官方技能包清单与加载器"
```

---

### Task 4: 技能包服务（安装/卸载/状态）

**Files:**
- Create: `src/lib/packs/service.ts`
- Create: `src/lib/packs/service.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/packs/service.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { PrismaClient } from "@prisma/client"
import { installPack, uninstallPack, getInstalledPackIds, isPackInstalled } from "./service"
import { validatePackManifest } from "./schema"

const prisma = new PrismaClient()
const TEST_PACK_ID = "test-pack"

const manifest = validatePackManifest({
  id: TEST_PACK_ID,
  name: "Test Pack",
  description: "for tests",
  version: "1.0.0",
  mcps: [
    { name: "test-mcp", transport: "stdio", command: "npx", args: ["-y", "some-server"], tools: "all" },
  ],
  skills: [
    { name: "test-skill", description: "d", content: "c" },
  ],
}).data!

beforeAll(async () => {
  await uninstallPack(TEST_PACK_ID)
  await prisma.pack.deleteMany({ where: { id: TEST_PACK_ID } })
})

afterAll(async () => {
  await uninstallPack(TEST_PACK_ID)
  await prisma.pack.deleteMany({ where: { id: TEST_PACK_ID } })
  await prisma.$disconnect()
})

describe("installPack", () => {
  it("creates mcp server and skill rows with packId", async () => {
    await installPack(manifest, "imported")
    const mcps = await prisma.mcpServer.findMany({ where: { packId: TEST_PACK_ID } })
    const skills = await prisma.skill.findMany({ where: { packId: TEST_PACK_ID } })
    expect(mcps.length).toBe(1)
    expect(skills.length).toBe(1)
    expect(mcps[0].command).toBe("npx")
    expect(await isPackInstalled(TEST_PACK_ID)).toBe(true)
    expect((await getInstalledPackIds()).includes(TEST_PACK_ID)).toBe(true)
  })

  it("throws when already installed", async () => {
    await expect(installPack(manifest, "imported")).rejects.toThrow(/already installed/i)
  })

  it("uninstall removes all rows", async () => {
    await uninstallPack(TEST_PACK_ID)
    const mcps = await prisma.mcpServer.findMany({ where: { packId: TEST_PACK_ID } })
    expect(mcps.length).toBe(0)
    expect(await isPackInstalled(TEST_PACK_ID)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/packs/service.test.ts`
Expected: FAIL（`Cannot find module './service'`）。

- [ ] **Step 3: 实现 service.ts**

`src/lib/packs/service.ts`：

```ts
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto"
import type { PackManifest } from "./schema"

export async function isPackInstalled(packId: string): Promise<boolean> {
  const [m, s, p] = await Promise.all([
    prisma.mcpServer.count({ where: { packId } }),
    prisma.skill.count({ where: { packId } }),
    prisma.prompt.count({ where: { packId } }),
  ])
  return m > 0 || s > 0 || p > 0
}

export async function getInstalledPackIds(): Promise<string[]> {
  const [mcps, skills, prompts] = await Promise.all([
    prisma.mcpServer.findMany({ where: { packId: { not: null } }, select: { packId: true } }),
    prisma.skill.findMany({ where: { packId: { not: null } }, select: { packId: true } }),
    prisma.prompt.findMany({ where: { packId: { not: null } }, select: { packId: true } }),
  ])
  const ids = new Set<string>()
  for (const row of [...mcps, ...skills, ...prompts]) {
    if (row.packId) ids.add(row.packId)
  }
  return [...ids]
}

export async function installPack(manifest: PackManifest, source: "builtin" | "imported"): Promise<void> {
  const { id, mcps, skills, prompts } = manifest
  if (await isPackInstalled(id)) {
    throw new Error(`Pack ${id} is already installed`)
  }
  await prisma.$transaction(async (tx) => {
    for (const m of mcps) {
      await tx.mcpServer.create({
        data: {
          name: m.name,
          description: manifest.description,
          transport: m.transport,
          url: m.url || null,
          headers: m.headers ? encrypt(JSON.stringify(m.headers)) : "{}",
          command: m.command || null,
          args: m.args || [],
          env: m.env ? encrypt(JSON.stringify(m.env)) : "{}",
          tags: ["pack"],
          packId: id,
        },
      })
    }
    for (const s of skills) {
      await tx.skill.create({
        data: {
          name: s.name,
          description: s.description,
          category: s.category || manifest.category || null,
          content: s.content,
          attachments: [],
          tags: s.tags || [],
          packId: id,
        },
      })
    }
    for (const p of prompts) {
      await tx.prompt.create({
        data: {
          name: p.name,
          description: p.description,
          category: p.category || manifest.category || null,
          content: p.content,
          variables: p.variables || [],
          role: p.role || "system",
          tags: p.tags || [],
          packId: id,
        },
      })
    }
  })
}

export async function uninstallPack(packId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mcpServer.deleteMany({ where: { packId } }),
    prisma.skill.deleteMany({ where: { packId } }),
    prisma.prompt.deleteMany({ where: { packId } }),
  ])
}
```

注意：该测试需要连接真实数据库（复用 vitest 默认环境）。若 vitest 环境无法连接 DB，可将本测试标记为手动运行（`describe.skip`），并在计划执行时用 `npm run db:push` 后手动跑一次确认。优先尝试直接运行。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/packs/service.test.ts`
Expected: PASS（若 DB 不可达则标注 DONE_WITH_CONCERNS，改用手动验证：安装/卸载一次）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/packs/service.ts src/lib/packs/service.test.ts
git commit -m "feat(packs): 安装/卸载/状态服务"
```

---

### Task 5: 技能包 API 路由

**Files:**
- Create: `src/app/api/packs/route.ts`
- Create: `src/app/api/packs/[id]/install/route.ts`
- Create: `src/app/api/packs/[id]/uninstall/route.ts`
- Create: `src/app/api/packs/[id]/route.ts`

- [ ] **Step 1: GET /api/packs + POST /api/packs/import**

`src/app/api/packs/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBuiltinPacks } from "@/lib/packs/builtin"
import { getInstalledPackIds } from "@/lib/packs/service"
import { validatePackManifest } from "@/lib/packs/schema"

export async function GET() {
  try {
    const builtin = getBuiltinPacks()
    const imported = await prisma.pack.findMany({ orderBy: { createdAt: "desc" } })
    const installed = new Set(await getInstalledPackIds())

    const items = [
      ...builtin.map((p) => ({ ...p, source: "builtin" as const })),
      ...imported.map((row) => {
        const m = validatePackManifest(row.manifest)
        return {
          ...(m.valid && m.data ? m.data : {}),
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          icon: row.icon,
          version: row.version,
          source: row.source as "imported",
        }
      }),
    ]

    return NextResponse.json(
      items.map((p) => ({ ...p, installed: installed.has(p.id) })),
    )
  } catch (error) {
    console.error("Failed to list packs:", error)
    return NextResponse.json({ error: "Failed to list packs" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = validatePackManifest(body)
    if (!result.valid || !result.data) {
      return NextResponse.json({ error: result.error || "invalid manifest" }, { status: 400 })
    }
    const builtinIds = new Set(getBuiltinPacks().map((p) => p.id))
    if (builtinIds.has(result.data.id)) {
      return NextResponse.json({ error: "id conflicts with a builtin pack" }, { status: 400 })
    }
    const pack = await prisma.pack.upsert({
      where: { id: result.data.id },
      update: {
        name: result.data.name,
        description: result.data.description,
        category: result.data.category || null,
        icon: result.data.icon || null,
        version: result.data.version,
        manifest: result.data as object,
      },
      create: {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        category: result.data.category || null,
        icon: result.data.icon || null,
        version: result.data.version,
        source: "imported",
        manifest: result.data as object,
      },
    })
    return NextResponse.json({ id: pack.id }, { status: 201 })
  } catch (error) {
    console.error("Failed to import pack:", error)
    return NextResponse.json({ error: "Failed to import pack" }, { status: 500 })
  }
}
```

- [ ] **Step 2: POST /api/packs/:id/install**

`src/app/api/packs/[id]/install/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBuiltinPack } from "@/lib/packs/builtin"
import { installPack, isPackInstalled } from "@/lib/packs/service"
import { validatePackManifest } from "@/lib/packs/schema"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    let manifest = getBuiltinPack(id)
    if (!manifest) {
      const row = await prisma.pack.findUnique({ where: { id } })
      if (!row) {
        return NextResponse.json({ error: "Pack not found" }, { status: 404 })
      }
      const r = validatePackManifest(row.manifest)
      if (!r.valid || !r.data) {
        return NextResponse.json({ error: "Pack manifest invalid" }, { status: 400 })
      }
      manifest = r.data
    }
    if (await isPackInstalled(id)) {
      return NextResponse.json({ error: "Pack already installed" }, { status: 409 })
    }
    await installPack(manifest, "builtin")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to install pack:", error)
    return NextResponse.json({ error: "Failed to install pack" }, { status: 500 })
  }
}
```

- [ ] **Step 3: POST /api/packs/:id/uninstall**

`src/app/api/packs/[id]/uninstall/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { uninstallPack } from "@/lib/packs/service"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await uninstallPack(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to uninstall pack:", error)
    return NextResponse.json({ error: "Failed to uninstall pack" }, { status: 500 })
  }
}
```

- [ ] **Step 4: DELETE /api/packs/:id（移除导入包，不卸载资源）**

`src/app/api/packs/[id]/route.ts`：

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBuiltinPack } from "@/lib/packs/builtin"

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (getBuiltinPack(id)) {
      return NextResponse.json({ error: "Cannot delete a builtin pack" }, { status: 400 })
    }
    await prisma.pack.deleteMany({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to delete pack:", error)
    return NextResponse.json({ error: "Failed to delete pack" }, { status: 500 })
  }
}
```

- [ ] **Step 5: 验证**

Run: `npm run typecheck && npm run lint`
Expected: 通过。手动 curl 验证：`curl -s localhost:3000/api/packs | head -c 300` 应返回含 filesystem/office 的 JSON 数组。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/packs/
git commit -m "feat(packs): 市场列表/导入/安装/卸载 API"
```

---

### Task 6: office 转换器（docx/xlsx/pptx/pdf）+ 安全路径

**Files:**
- Modify: `package.json`
- Create: `src/mcp/office/converters.ts`
- Create: `src/mcp/office/path.ts`
- Create: `src/mcp/office/path.test.ts`
- Create: `src/mcp/office/converters.test.ts`

- [ ] **Step 1: 安装依赖**

Run:
```bash
npm install docx exceljs pptxgenjs pdfmake marked
npm install -D @types/pdfmake
```

- [ ] **Step 2: 写失败测试（路径安全）**

`src/mcp/office/path.test.ts`：

```ts
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
```

- [ ] **Step 3: 实现 path.ts**

`src/mcp/office/path.ts`：

```ts
import path from "path"

export const ALLOWED_ROOT = path.resolve(process.env.OFFICE_ALLOWED_DIR || path.join(process.cwd(), "storage"))

export function resolveAllowedPath(outputPath: string): string {
  const resolved = path.resolve(process.cwd(), outputPath)
  const relative = path.relative(ALLOWED_ROOT, resolved)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`outputPath must be inside ${ALLOWED_ROOT}`)
  }
  return resolved
}
```

- [ ] **Step 4: 跑测试确认通过（path）**

Run: `npx vitest run src/mcp/office/path.test.ts`
Expected: PASS。

- [ ] **Step 5: 写失败测试（转换器）**

`src/mcp/office/converters.test.ts`：

```ts
import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { createDocx, createXlsx, createPptx, createPdf } from "./converters"

const outDir = path.join(process.cwd(), "storage", "test-office")

describe("office converters", () => {
  it("createDocx writes a non-empty .docx file", async () => {
    const file = path.join(outDir, "report.docx")
    await createDocx("# Title\n\nHello **world**.", file)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })

  it("createXlsx writes an .xlsx readable by exceljs", async () => {
    const file = path.join(outDir, "data.xlsx")
    await createXlsx([{ name: "A", value: 1 }, { name: "B", value: 2 }], file)
    expect(fs.existsSync(file)).toBe(true)
  })

  it("createPptx writes a non-empty .pptx file", async () => {
    const file = path.join(outDir, "deck.pptx")
    await createPptx("# Slide 1\n\n- Point A\n- Point B", file)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })

  it("createPdf writes a non-empty .pdf file", async () => {
    const file = path.join(outDir, "doc.pdf")
    await createPdf("# Title\n\nParagraph text.", file)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 6: 实现 converters.ts**

`src/mcp/office/converters.ts`：

```ts
import fs from "fs"
import path from "path"
import { marked, type Tokens } from "marked"
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, convertInchesToTwip } from "docx"
import ExcelJS from "exceljs"
import pptxgen from "pptxgenjs"
import pdfmake from "pdfmake/build/pdfmake"
import * as pdfFonts from "pdfmake/build/vfs_fonts"
import { resolveAllowedPath } from "./path"

;(pdfmake as unknown as { vfs: unknown }).vfs = pdfFonts.vfs

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function inlineRuns(text: string): TextRun[] {
  const lexer = new marked.Lexer()
  const tokens = lexer.lexInline(text) as Array<Tokens.Text | Tokens.Strong | Tokens.Em | Tokens.Codespan>
  const runs: TextRun[] = []
  const push = (content: string, bold?: boolean, italics?: boolean) => {
    if (!content) return
    runs.push(new TextRun({ text: content, bold, italics }))
  }
  for (const tok of tokens) {
    if (tok.type === "strong") push(tok.text, true, undefined)
    else if (tok.type === "em") push(tok.text, undefined, true)
    else if (tok.type === "codespan") push(tok.text, true, undefined)
    else if (tok.type === "text") push(tok.text)
  }
  return runs
}

function headingLevel(level: number): HeadingLevel {
  return [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1] || HeadingLevel.HEADING_3
}

export async function createDocx(markdown: string, outputPath: string): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const tokens = marked.lexer(markdown)
  const children: Paragraph[] = []
  for (const token of tokens) {
    if (token.type === "heading") {
      children.push(new Paragraph({ heading: headingLevel(token.depth), children: inlineRuns(token.text) }))
    } else if (token.type === "paragraph") {
      children.push(new Paragraph({ children: inlineRuns(token.text) }))
    } else if (token.type === "list") {
      for (const item of token.items) {
        const text = item.tokens.filter((t) => t.type === "text").map((t) => (t as Tokens.Text).text).join("")
        children.push(new Paragraph({ children: inlineRuns(text), bullet: { level: (token.ordered ? 0 : 0) } }))
      }
    } else if (token.type === "table") {
      const header = new TableRow(
        token.header.map((c) => new TableCell({ children: [new Paragraph({ children: inlineRuns(c.text) })] })),
      )
      const rows = token.rows.map((r) =>
        new TableRow(r.map((c) => new TableCell({ children: [new Paragraph({ children: inlineRuns(c.text) })] }))),
      )
      children.push(new Paragraph({}) as never)
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }) as never)
    } else if (token.type === "hr") {
      children.push(new Paragraph({ border: { bottom: { style: "single", size: 6, color: "CCCCCC" } }, text: "" }))
    }
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(file, buffer)
  return file
}

export async function createXlsx(rows: Array<Record<string, unknown>>, outputPath: string, sheetName = "Sheet1"): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  if (rows.length === 0) {
    await workbook.xlsx.writeFile(file)
    return file
  }
  const headers = Object.keys(rows[0])
  sheet.addRow(headers)
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ""))
  }
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 4, 12) }))
  await workbook.xlsx.writeFile(file)
  return file
}

export async function createPptx(outline: string, outputPath: string): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const pptx = new pptxgen()
  let slide = pptx.addSlide()
  let title = ""
  for (const line of outline.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith("# ")) {
      title = trimmed.slice(2).trim()
      slide = pptx.addSlide()
      slide.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 28, bold: true })
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      slide.addText(trimmed.slice(2).trim(), { x: 0.8, y: 1.2, w: 8.4, h: 0.4, fontSize: 18, bullet: true })
    } else {
      slide.addText(trimmed, { x: 0.8, y: 1.2, w: 8.4, h: 0.4, fontSize: 18 })
    }
  }
  await pptx.writeFile({ fileName: file })
  return file
}

export async function createPdf(content: string, outputPath: string): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const tokens = marked.lexer(content)
  const ddContent: unknown[] = []
  for (const token of tokens) {
    if (token.type === "heading") {
      const fontSize = Math.max(24 - token.depth * 3, 12)
      ddContent.push({ text: token.text, fontSize, bold: true, margin: [0, 10, 0, 4] })
    } else if (token.type === "paragraph") {
      ddContent.push({ text: token.text, margin: [0, 2, 0, 2] })
    } else if (token.type === "list") {
      for (const item of token.items) {
        const text = item.tokens.filter((t) => t.type === "text").map((t) => (t as Tokens.Text).text).join("")
        ddContent.push({ text: `• ${text}`, margin: [10, 1, 0, 1] })
      }
    } else if (token.type === "table") {
      const header = token.header.map((c) => ({ text: c.text, bold: true }))
      const bodyRows = token.rows.map((r) => r.map((c) => ({ text: c.text })))
      ddContent.push({ table: { headerRows: 1, widths: token.header.map(() => "*"), body: [header, ...bodyRows] }, margin: [0, 6, 0, 6] })
    }
  }
  const docDefinition = {
    content: ddContent,
    defaultStyle: { font: "Roboto", fontSize: 11 },
  }
  const pdfDoc = pdfmake.createPdf(docDefinition as never)
  await new Promise<void>((resolve, reject) => {
    pdfDoc.getBuffer((buffer: Buffer) => {
      fs.writeFileSync(file, buffer)
      resolve()
    })
  })
  return file
}
```

注意 `marked.lexer` 返回的 token 类型用 `Tokens` 命名空间，`marked.parseInline` 返回 `string | Tokens.Text[]`，需要按需 `as`。转换器是纯函数，通过文件落盘测试验证。

- [ ] **Step 7: 跑测试确认通过（converters）**

Run: `npx vitest run src/mcp/office/converters.test.ts src/mcp/office/path.test.ts`
Expected: PASS（4 个文件各生成成功）。若 `marked` 类型签名与上面不符导致编译错误，按实际类型修正（保持行为不变）。

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/mcp/office/ src/mcp/office/*.test.ts
git commit -m "feat(office): docx/xlsx/pptx/pdf 转换器（纯 JS，无 Chromium）"
```

---

### Task 7: office MCP server

**Files:**
- Create: `src/mcp/office-server.ts`

- [ ] **Step 1: 实现 office-server.ts**

`src/mcp/office-server.ts`：

```ts
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { createDocx, createXlsx, createPptx, createPdf } from "./office/converters"

const server = new McpServer({ name: "office", version: "1.0.0" })

server.tool(
  "create_docx",
  "Create a Word (.docx) document from Markdown. outputPath must end with .docx and start with storage/.",
  { markdown: z.string(), outputPath: z.string() },
  async ({ markdown, outputPath }) => {
    try {
      const path = await createDocx(markdown, outputPath)
      return { content: [{ type: "text" as const, text: `Created docx at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

server.tool(
  "create_xlsx",
  "Create an Excel (.xlsx) file from an array of JSON objects. Keys become the header row. outputPath must end with .xlsx and start with storage/.",
  { rows: z.array(z.record(z.string(), z.any())), outputPath: z.string() },
  async ({ rows, outputPath }) => {
    try {
      const path = await createXlsx(rows, outputPath)
      return { content: [{ type: "text" as const, text: `Created xlsx at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

server.tool(
  "create_pptx",
  "Create a PowerPoint (.pptx) from a Markdown outline. Each top-level heading is a slide; bullets become list items. outputPath must end with .pptx and start with storage/.",
  { outline: z.string(), outputPath: z.string() },
  async ({ outline, outputPath }) => {
    try {
      const path = await createPptx(outline, outputPath)
      return { content: [{ type: "text" as const, text: `Created pptx at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

server.tool(
  "create_pdf",
  "Create a PDF file from Markdown content. outputPath must end with .pdf and start with storage/.",
  { content: z.string(), outputPath: z.string() },
  async ({ content, outputPath }) => {
    try {
      const path = await createPdf(content, outputPath)
      return { content: [{ type: "text" as const, text: `Created pdf at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

- [ ] **Step 2: 冒烟测试（直接 spawn 一次）**

Run:
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n' | npx tsx src/mcp/office-server.ts
```
Expected: 输出包含 `serverInfo` 的 initialize 响应 JSON，进程正常启动。

- [ ] **Step 3: 验证**

Run: `npm run typecheck && npm run lint`
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/mcp/office-server.ts
git commit -m "feat(office): office MCP server（create_docx/xlsx/pptx/pdf 工具）"
```

---

### Task 8: UI —— 扩展页"技能包市场"标签

**Files:**
- Modify: `src/stores/extensions.ts`
- Modify: `src/components/extensions/ExtensionLibrary.tsx`
- Create: `src/components/extensions/PacksTab.tsx`
- Create: `src/components/extensions/PackImportDialog.tsx`

- [ ] **Step 1: store 增加 packs 状态与操作**

`src/stores/extensions.ts` 增加类型与 state：

```ts
export interface PackItem {
  id: string
  name: string
  description: string
  category?: string
  icon?: string
  version: string
  source: "builtin" | "imported"
  installed: boolean
}

type TabType = "skills" | "prompts" | "mcp" | "packs"
```

state 增加 `packs: PackItem[]`，actions 增加：

```ts
  fetchPacks: () => Promise<void>
  installPack: (id: string) => Promise<void>
  uninstallPack: (id: string) => Promise<void>
  importPack: (manifest: unknown) => Promise<void>
```

实现：

```ts
  fetchPacks: async () => {
    const res = await fetch("/api/packs")
    if (!res.ok) throw new Error("Failed to fetch packs")
    set({ packs: await res.json() })
  },

  installPack: async (id) => {
    const res = await fetch(`/api/packs/${id}/install`, { method: "POST" })
    if (!res.ok) throw new Error("Install failed")
    await get().fetchPacks()
  },

  uninstallPack: async (id) => {
    const res = await fetch(`/api/packs/${id}/uninstall`, { method: "POST" })
    if (!res.ok) throw new Error("Uninstall failed")
    await get().fetchPacks()
  },

  importPack: async (manifest) => {
    const res = await fetch("/api/packs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifest),
    })
    if (!res.ok) throw new Error("Import failed")
    await get().fetchPacks()
  },
```

- [ ] **Step 2: ExtensionLibrary 增加 packs 标签**

`src/components/extensions/ExtensionLibrary.tsx`：
- `tabs` 数组追加 `{ id: "packs" as const, label: t("extensions.tabs.packs") }`
- store 解构增加 `packs, fetchPacks, installPack, uninstallPack, importPack`
- `handleSaved`/`refresh` 增加 `else if (activeTab === "packs") fetchPacks()`
- 渲染区增加 `{activeTab === "packs" && <PacksTab packs={packs} loading={loading} onInstall={installPack} onUninstall={uninstallPack} onImport={importPack} onRefresh={fetchPacks} />}`
- 顶部操作按钮：packs 标签时不显示"新建"（无编辑入口），显示"导入"按钮：

把按钮区改为：

```tsx
        <div className="flex gap-2">
          {activeTab !== "mcp" && activeTab !== "packs" && (
            <Button variant="outline" size="sm" onClick={handleUpload}>
              <Upload className="h-4 w-4 mr-1" />
              {t("extensions.common.upload")}
            </Button>
          )}
          {activeTab === "packs" ? (
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              {t("packs.import")}
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              {t("extensions.common.create")}
            </Button>
          )}
        </div>
```

并增加 `const [importOpen, setImportOpen] = useState(false)`，在文件末尾渲染 `<PackImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={handleSaved} />`。

- [ ] **Step 3: PacksTab.tsx**

`src/components/extensions/PacksTab.tsx`：

```tsx
"use client"

import { useTranslation } from "@/i18n"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FolderOpen, FileText, Package, Loader2 } from "lucide-react"
import type { PackItem } from "@/stores/extensions"

interface PacksTabProps {
  packs: PackItem[]
  loading: boolean
  onInstall: (id: string) => Promise<void>
  onUninstall: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
}

const iconMap: Record<string, React.ReactNode> = {
  "folder-open": <FolderOpen className="h-5 w-5" />,
  "file-text": <FileText className="h-5 w-5" />,
}

export function PacksTab({ packs, loading, onInstall, onUninstall }: PacksTabProps) {
  const { t } = useTranslation()

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (packs.length === 0) return <div className="text-muted-foreground text-sm">{t("packs.empty")}</div>

  const handleToggle = async (pack: PackItem) => {
    if (pack.installed) {
      if (!confirm(t("packs.uninstallConfirm", { name: pack.name }))) return
      await onUninstall(pack.id)
    } else {
      await onInstall(pack.id)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {packs.map((pack) => (
        <Card key={pack.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-node-llm-bg p-1.5 text-node-llm">
                {iconMap[pack.icon || ""] || <Package className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-sm">{pack.name}</h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{pack.version}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {pack.source === "builtin" ? t("packs.source.official") : t("packs.source.imported")}
                  </Badge>
                  {pack.installed && <Badge variant="info" className="text-[10px]">{t("packs.installed")}</Badge>}
                </div>
              </div>
            </div>
            <Button
              variant={pack.installed ? "outline" : "default"}
              size="sm"
              disabled={loading}
              onClick={() => handleToggle(pack)}
            >
              {pack.installed ? t("packs.uninstall") : t("packs.install")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{pack.description}</p>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: PackImportDialog.tsx**

`src/components/extensions/PackImportDialog.tsx`：

```tsx
"use client"

import { useState, useRef } from "react"
import { useTranslation } from "@/i18n"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

interface PackImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => Promise<void> | void
}

export function PackImportDialog({ open, onOpenChange, onImported }: PackImportDialogProps) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => { setText(""); setError(null) }

  const importManifest = async (manifest: unknown) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Import failed")
      }
      onOpenChange(false)
      reset()
      await onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(text)
      importManifest(parsed)
    } catch {
      setError(t("packs.importInvalidJson"))
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      await importManifest(parsed)
    } catch {
      setError(t("packs.importInvalidJson"))
    }
    e.target.value = ""
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("packs.importTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={8}
            placeholder={t("packs.importPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono text-xs"
          />
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            {t("extensions.common.upload")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("extensions.common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving || !text.trim()}>{t("packs.import")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: 验证**

Run: `npm run typecheck && npm run lint`
Expected: 通过。浏览器目检 `/extensions` 出现"技能包市场"标签，展示 filesystem/office 两张卡。

- [ ] **Step 6: Commit**

```bash
git add src/stores/extensions.ts src/components/extensions/ExtensionLibrary.tsx src/components/extensions/PacksTab.tsx src/components/extensions/PackImportDialog.tsx
git commit -m "feat(packs): 扩展页技能包市场标签 + 导入对话框"
```

---

### Task 9: i18n（zh/en）

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: zh.json 增加 packs 分组**

在 `extensions` 之后新增顶级 key：

```json
  "packs": {
    "title": "技能包市场",
    "install": "安装",
    "uninstall": "卸载",
    "uninstallConfirm": "确定要卸载技能包「{name}」吗？已安装的 MCP 服务与技能将被删除。",
    "installed": "已安装",
    "import": "导入技能包",
    "importTitle": "导入技能包",
    "importPlaceholder": "粘贴技能包 JSON 清单...",
    "importInvalidJson": "JSON 解析失败，请检查格式",
    "empty": "暂无技能包",
    "source": {
      "official": "官方",
      "imported": "导入"
    },
    "office": {
      "name": "文档生成",
      "description": "由 LLM 生成 Word/Excel/PPT/PDF 文件（Markdown/JSON 内容自动转换）"
    },
    "filesystem": {
      "name": "本地文件读写",
      "description": "读取/列出/搜索 storage 目录下的本地文件，供工作流使用"
    }
  }
```

- [ ] **Step 2: en.json 增加 packs 分组**

```json
  "packs": {
    "title": "Skill Packs",
    "install": "Install",
    "uninstall": "Uninstall",
    "uninstallConfirm": "Uninstall pack \"{name}\"? Installed MCP servers and skills will be removed.",
    "installed": "Installed",
    "import": "Import Pack",
    "importTitle": "Import Skill Pack",
    "importPlaceholder": "Paste the pack manifest JSON...",
    "importInvalidJson": "Invalid JSON, please check the format",
    "empty": "No packs yet",
    "source": {
      "official": "Official",
      "imported": "Imported"
    },
    "office": {
      "name": "Document Generation",
      "description": "Generate Word/Excel/PPT/PDF files from LLM content (Markdown/JSON converted automatically)"
    },
    "filesystem": {
      "name": "Local File Access",
      "description": "List, read and search local files under the storage/ directory for workflows"
    }
  }
```

- [ ] **Step 3: 官方包名称/描述改为走 i18n**

由于内置包 `name`/`description` 在 UI 中用 i18n key 渲染，`PacksTab` 中名称与描述改为：

```tsx
                <h3 className="font-semibold text-sm">
                  {pack.source === "builtin"
                    ? t(`packs.${pack.id}.name`)
                    : pack.name}
                </h3>
```

```tsx
          <p className="text-xs text-muted-foreground line-clamp-2">
            {pack.source === "builtin"
              ? t(`packs.${pack.id}.description`)
              : pack.description}
          </p>
```

- [ ] **Step 4: 验证**

Run: `npm run typecheck && npm run lint`
Expected: 通过。浏览器切中/英文均正常显示。

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json src/components/extensions/PacksTab.tsx
git commit -m "i18n: 技能包市场 zh/en 文案 + 官方包名称走 i18n"
```

---

### Task 10: 回归验证

**Files:** 无

- [ ] **Step 1: 静态检查 + 构建**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 全部通过（lint 仅存量 24 个 error）。

- [ ] **Step 2: 端到端手测（`npm run dev:webpack`）**

1. `/extensions` → 技能包市场：看到 filesystem + office 两张卡
2. 安装 office → 出现"已安装"；MCP 列表出现 `office` server
3. 安装 filesystem → MCP 列表出现 `filesystem` server
4. 打开一个 LLM 节点 → 扩展绑定：勾选 office skill + filesystem skill + 对应 MCP
5. 新建工作流：输入 → LLM（绑定 office）→ 输出；执行一次让 LLM 调用 `create_docx` 生成到 `storage/export/xxx.docx`
6. 检查 `storage/` 下生成文件存在、可用（可打开）
7. 卸载 office → MCP/技能列表中的 packId 行消失
8. 导入对话框：粘贴一个合法 pack JSON → 出现在市场并带"导入"标记；非法 JSON → 报错

- [ ] **Step 3: Commit（如有残留修复）**

```bash
git add -A
git commit -m "feat(packs): 回归验证与收尾"
```

---

## 自审清单

**Spec 覆盖：**
- 包清单 schema → Task 2
- 数据模型（packId + Pack 表）→ Task 1
- 内置官方包（filesystem/office 清单）→ Task 3
- 安装/卸载/状态服务 → Task 4
- API（列表/导入/安装/卸载/删除）→ Task 5
- office MCP server（4 工具，纯 JS）→ Task 6、7
- UI 市场标签 + 导入对话框 → Task 8
- i18n → Task 9
- 安全（outputPath 限制在 storage）→ Task 6（path.ts）
- 引擎零改动 → 全计划未触碰 `src/engine/`、`src/types/workflow.ts`、节点组件

**占位符扫描：** 无 TBD/TODO，所有代码完整。

**类型一致性：**
- `validatePackManifest` 返回 `{ valid, data?, error? }`，在 Task 5 API 与 Task 4 测试中一致使用
- `getInstalledPackIds`/`isPackInstalled`/`installPack`/`uninstallPack` 签名在 Task 4 定义、Task 5 调用一致
- office 转换器函数名 `createDocx/createXlsx/createPptx/createPdf` 在 Task 6 定义、Task 7 server 调用一致
- `ALLOWED_ROOT`/`resolveAllowedPath` 在 Task 6 定义并被 converters 引用
- `PackItem` 类型在 Task 8 store 定义、PacksTab 引用一致
