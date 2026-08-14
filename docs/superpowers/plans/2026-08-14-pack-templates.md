# 技能包模板库 + packId 自动绑定 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让模板 LLM 节点能按 `packId` 自动绑定已安装的技能包，并新增 3 个展示文件读取 + Word/Excel/PPT 生成能力的示例工作流模板。

**Architecture:** 放宽 `ExtensionBindings` 类型为 union（string/id 或 `{packId}`），在 `loadSkills` / `loadMcpExtensions` 里增加 packId → 已安装行解析分支（纯新增，向后兼容）。模板 builder 复用现有 input/llm/output 节点，LLM 节点 `config.extensions` 写入 `{ packId }` 绑定。

**Tech Stack:** Next.js 16、Prisma、TypeScript。

**验证命令：**
```bash
npm run typecheck
npm run lint        # 仅允许存量 24 error
npm run build
npx vitest run src/engine/extensions src/lib/templates
```

---

### Task 1: 扩展绑定类型支持 packId

**Files:**
- Modify: `src/types/workflow.ts`

- [ ] **Step 1: 更新类型**

将 `src/types/workflow.ts` 第 157-174 行的扩展类型改为：

```ts
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

/** 按 packId 引用技能包中的技能 */
export interface SkillPackBinding {
  packId: string
}

/** 按 packId 引用技能包中的 MCP server（可多个） */
export interface McpPackBinding {
  packId: string
  tools?: string[] | "all"
  resources?: string[]
  prompts?: string[]
}

/** 扩展包绑定(Skills + Prompts + MCP) */
export interface ExtensionBindings {
  skills: Array<string | SkillPackBinding>
  prompts: Array<string | SkillPackBinding>
  mcp: Array<McpBinding | McpPackBinding>
}
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 通过（若 `loadSkills`/`loadMcpExtensions` 报参数类型不兼容错误，属预期，Task 2/3 会改签名）。

- [ ] **Step 3: Commit**

```bash
git add src/types/workflow.ts
git commit -m "feat(extensions): ExtensionBindings 支持 {packId} 绑定"
```

---

### Task 2: loadSkills 支持 packId 解析

**Files:**
- Modify: `src/engine/extensions/skill-loader.ts`
- Create: `src/engine/extensions/skill-loader.test.ts`

- [ ] **Step 1: 写失败测试**

`src/engine/extensions/skill-loader.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { loadSkills } from "./skill-loader"
import { uninstallPack } from "@/lib/packs/service"

const TEST_PACK_ID = "test-pack"
const TEST_SKILL_NAME = "test-pack-skill"

beforeAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

afterAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

describe("loadSkills with packId binding", () => {
  it("resolves {packId} to installed skills with that packId", async () => {
    await prisma.skill.create({
      data: {
        name: TEST_SKILL_NAME,
        description: "test",
        content: "You are a test skill.",
        packId: TEST_PACK_ID,
      },
    })

    const payload = await loadSkills([{ packId: TEST_PACK_ID }], {} as never)
    expect(payload.systemContext.length).toBe(1)
    expect(payload.systemContext[0]).toContain("test skill")
  })

  it("keeps plain skill ids and skips unknown packIds", async () => {
    const payload = await loadSkills(["nonexistent-id", { packId: "no-such-pack" }], {} as never)
    expect(payload.systemContext.length).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/engine/extensions/skill-loader.test.ts`
Expected: FAIL（类型或解析未实现）。

- [ ] **Step 3: 实现解析**

`src/engine/extensions/skill-loader.ts` 修改导入与签名：

```ts
import { prisma } from "@/lib/prisma"
import type { ExecutionContext, SkillPackBinding } from "@/types/workflow"

export type SkillBinding = string | SkillPackBinding
```

`loadSkills` 签名改为 `loadSkills(entries: SkillBinding[], _context: ExecutionContext)`，在函数开头把 entries 解析为 id 数组：

```ts
  // 解析 packId 引用为已安装技能 id
  const ids = await resolveSkillIds(entries)

  if (ids.length === 0) {
    return { systemContext: [] }
  }

  const skills = await prisma.skill.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, description: true, content: true, attachments: true },
  })
```

新增辅助函数（放在文件顶部）：

```ts
async function resolveSkillIds(entries: SkillBinding[]): Promise<string[]> {
  const ids: string[] = []
  const packIds = new Set<string>()
  for (const entry of entries) {
    if (typeof entry === "string") {
      ids.push(entry)
    } else {
      packIds.add(entry.packId)
    }
  }
  if (packIds.size > 0) {
    const rows = await prisma.skill.findMany({
      where: { packId: { in: [...packIds] } },
      select: { id: true, packId: true },
    })
    for (const row of rows) {
      if (row.packId) ids.push(row.id)
    }
  }
  return ids
}
```

其余逻辑（≤3 全量 / >3 摘要 + load_skill）保持不变，但 `skills.length < ids.length` 的悬空检查也要跳过 packId 场景（用解析后的 ids 即可，缺的记 warn）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/engine/extensions/skill-loader.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/engine/extensions/skill-loader.ts src/engine/extensions/skill-loader.test.ts
git commit -m "feat(extensions): loadSkills 支持 {packId} 解析为已安装技能"
```

---

### Task 3: loadMcpExtensions 支持 packId 解析

**Files:**
- Modify: `src/engine/extensions/mcp-manager.ts`
- Create: `src/engine/extensions/mcp-manager.test.ts`

- [ ] **Step 1: 写失败测试**

`src/engine/extensions/mcp-manager.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { loadMcpExtensions } from "./mcp-manager"
import { uninstallPack } from "@/lib/packs/service"
import { encrypt } from "@/lib/crypto"

const TEST_PACK_ID = "test-pack-mcp"
const TEST_SERVER_NAME = "test-pack-server"

beforeAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

afterAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

describe("loadMcpExtensions with packId binding", () => {
  it("resolves {packId} to installed MCP servers with that packId", async () => {
    await prisma.mcpServer.create({
      data: {
        name: TEST_SERVER_NAME,
        transport: "stdio",
        command: "echo",
        args: ["{}"],
        headers: "{}",
        env: encrypt(JSON.stringify({})),
        packId: TEST_PACK_ID,
      },
    })

    const payload = await loadMcpExtensions([{ packId: TEST_PACK_ID }], {} as never)
    expect(typeof payload).toBe("object")
    expect(payload.tools).toBeDefined()
  })

  it("skips unknown packIds gracefully", async () => {
    const payload = await loadMcpExtensions([{ packId: "no-such-pack" }], {} as never)
    expect(payload.tools).toEqual({})
    expect(payload.resourceContext).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/engine/extensions/mcp-manager.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现解析**

`src/engine/extensions/mcp-manager.ts`：

导入新增 `McpPackBinding`：
```ts
import type { ExecutionContext, McpBinding, McpPackBinding } from "@/types/workflow"
export type McpBindingEntry = McpBinding | McpPackBinding
```

`loadMcpExtensions` 签名改为 `loadMcpExtensions(entries: McpBindingEntry[], _context)`。函数开头新增 packId 预展开：

```ts
  if (entries.length === 0) {
    return { tools: {}, resourceContext: [] }
  }

  // 展开 packId 引用为具体 serverId 绑定
  const bindings: Array<McpBinding & { serverId: string }> = []
  const packIds = new Set<string>()
  for (const entry of entries) {
    if ("serverId" in entry) {
      bindings.push(entry as McpBinding)
    } else {
      packIds.add(entry.packId)
    }
  }
  if (packIds.size > 0) {
    const servers = await prisma.mcpServer.findMany({
      where: { packId: { in: [...packIds] } },
      select: { id: true, packId: true },
    })
    const byPack = new Map<string, McpPackBinding>()
    for (const entry of entries) {
      if ("packId" in entry) byPack.set(entry.packId, entry as McpPackBinding)
    }
    for (const server of servers) {
      const pack = byPack.get(server.packId!)
      bindings.push({
        serverId: server.id,
        tools: pack?.tools,
        resources: pack?.resources,
        prompts: pack?.prompts,
      })
    }
  }

  if (bindings.length === 0) {
    return { tools: {}, resourceContext: [] }
  }
```

随后的 `for (const binding of bindings)` 循环保持不变（现在都是 `{ serverId, ... }`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/engine/extensions/mcp-manager.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/engine/extensions/mcp-manager.ts src/engine/extensions/mcp-manager.test.ts
git commit -m "feat(extensions): loadMcpExtensions 支持 {packId} 解析为已安装 server"
```

---

### Task 4: 三个技能包模板 builder

**Files:**
- Create: `src/app/api/workflow/template/file-to-docx/template.ts`
- Create: `src/app/api/workflow/template/data-to-xlsx/template.ts`
- Create: `src/app/api/workflow/template/markdown-to-pptx/template.ts`
- Modify: `src/lib/templates.ts`

- [ ] **Step 1: file-to-docx builder**

`src/app/api/workflow/template/file-to-docx/template.ts`：

```ts
import type { Template } from "../types"

const I18N = {
  zh: {
    name: "本地文件生成 Word 报告",
    description: "读取 storage 目录下的文件，由 AI 生成 Word 报告",
    labelInput: "报告主题",
    labelLLM: "AI 撰写",
    labelOutput: "输出结果",
    prompt: "你是文档撰写助手。请完成以下任务：\n1. 先用 filesystem 工具的 list_directory 查看 storage 目录，用 read_file 读取用户指定或相关的文件内容。\n2. 基于读取到的内容，结合用户给出的报告主题，撰写一份结构清晰的 Word 报告（Markdown 格式，含标题层级、列表、表格）。\n3. 调用 office 的 create_docx 工具，参数 markdown 传你撰写的报告内容，outputPath 传 storage/export/报告-<日期>.docx。\n4. 用一句话告知生成的文件路径。",
  },
  en: {
    name: "Local Files to Word Report",
    description: "Read files under storage/ and generate a Word report with AI",
    labelInput: "Report Topic",
    labelLLM: "AI Writer",
    labelOutput: "Output",
    prompt: "You are a document writing assistant. Do the following:\n1. Use the filesystem tool list_directory to inspect the storage directory, and read_file to read files relevant to the user's topic.\n2. Based on the content, write a well-structured Word report (Markdown with headings, lists, tables).\n3. Call the office create_docx tool: markdown = your report content, outputPath = storage/export/report-<date>.docx.\n4. Reply with one sentence stating the generated file path.",
  },
}

export function buildFileToDocxTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "text", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.4,
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "filesystem" }, { packId: "office" }],
            prompts: [],
            mcp: [{ packId: "filesystem" }, { packId: "office" }],
          },
        } } },
      { id: "output-1", type: "output", position: { x: 580, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "{{ $node.llm-1.text }}" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "output-1" },
    ],
  }
}
```

- [ ] **Step 2: data-to-xlsx builder**

`src/app/api/workflow/template/data-to-xlsx/template.ts`：

```ts
import type { Template } from "../types"

const I18N = {
  zh: {
    name: "数据生成 Excel 报表",
    description: "把输入数据整理成表格，AI 生成 Excel 报表",
    labelInput: "数据描述",
    labelLLM: "AI 整理",
    labelOutput: "输出结果",
    prompt: "你是数据分析助手。请完成：\n1. 根据用户对数据的描述，把数据整理成 JSON 数组（每项是一个对象，键为列名）。\n2. 调用 office 的 create_xlsx 工具：rows 传该 JSON 数组，outputPath 传 storage/export/报表-<日期>.xlsx。\n3. 用一句话告知生成的文件路径和行列数。",
  },
  en: {
    name: "Data to Excel Report",
    description: "Turn described data into a spreadsheet and generate an Excel file with AI",
    labelInput: "Data Description",
    labelLLM: "AI Organizer",
    labelOutput: "Output",
    prompt: "You are a data analyst assistant. Do the following:\n1. Turn the user's described data into a JSON array (each item an object whose keys are column names).\n2. Call the office create_xlsx tool: rows = that JSON array, outputPath = storage/export/report-<date>.xlsx.\n3. Reply with one sentence stating the file path and row/column counts.",
  },
}

export function buildDataToXlsxTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "text", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.3,
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "office" }],
            prompts: [],
            mcp: [{ packId: "office" }],
          },
        } } },
      { id: "output-1", type: "output", position: { x: 580, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "{{ $node.llm-1.text }}" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "output-1" },
    ],
  }
}
```

- [ ] **Step 3: markdown-to-pptx builder**

`src/app/api/workflow/template/markdown-to-pptx/template.ts`：

```ts
import type { Template } from "../types"

const I18N = {
  zh: {
    name: "大纲生成 PPT",
    description: "输入主题，AI 生成 Markdown 大纲并输出 PPT 文件",
    labelInput: "演讲主题",
    labelLLM: "AI 制作",
    labelOutput: "输出结果",
    prompt: "你是演示文稿助手。请完成：\n1. 根据用户的演讲主题，生成一份 Markdown 大纲：每个 # 顶级标题是一页幻灯片，- 列表项是页面要点。\n2. 调用 office 的 create_pptx 工具：outline 传该大纲，outputPath 传 storage/export/演示-<日期>.pptx。\n3. 用一句话告知生成的文件路径和页数。",
  },
  en: {
    name: "Outline to PPT",
    description: "Enter a topic, AI generates a Markdown outline and a PPT file",
    labelInput: "Talk Topic",
    labelLLM: "AI Deck Builder",
    labelOutput: "Output",
    prompt: "You are a presentation assistant. Do the following:\n1. Create a Markdown outline for the user's topic: each # top-level heading is one slide, - list items become slide bullets.\n2. Call the office create_pptx tool: outline = that Markdown, outputPath = storage/export/deck-<date>.pptx.\n3. Reply with one sentence stating the file path and slide count.",
  },
}

export function buildMarkdownToPptxTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "text", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.5,
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "office" }],
            prompts: [],
            mcp: [{ packId: "office" }],
          },
        } } },
      { id: "output-1", type: "output", position: { x: 580, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "{{ $node.llm-1.text }}" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "output-1" },
    ],
  }
}
```

- [ ] **Step 4: 注册进 TEMPLATES**

`src/lib/templates.ts` 顶部加 import：

```ts
import { buildFileToDocxTemplate } from "@/app/api/workflow/template/file-to-docx/template"
import { buildDataToXlsxTemplate } from "@/app/api/workflow/template/data-to-xlsx/template"
import { buildMarkdownToPptxTemplate } from "@/app/api/workflow/template/markdown-to-pptx/template"
```

`TEMPLATES` 数组末尾追加三个条目：

```ts
  {
    id: "file-to-docx",
    nameKey: "templates.list.fileToDocx.name",
    descriptionKey: "templates.list.fileToDocx.description",
    icon: "FileText",
    category: "file",
    build: buildFileToDocxTemplate,
  },
  {
    id: "data-to-xlsx",
    nameKey: "templates.list.dataToXlsx.name",
    descriptionKey: "templates.list.dataToXlsx.description",
    icon: "Table",
    category: "file",
    build: buildDataToXlsxTemplate,
  },
  {
    id: "markdown-to-pptx",
    nameKey: "templates.list.markdownToPptx.name",
    descriptionKey: "templates.list.markdownToPptx.description",
    icon: "Presentation",
    category: "file",
    build: buildMarkdownToPptxTemplate,
  },
```

- [ ] **Step 5: 验证**

Run: `npm run typecheck`
Expected: 通过。`curl -s "http://localhost:3000/api/templates"` 应包含 3 个新模板 id。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/workflow/template/ src/lib/templates.ts
git commit -m "feat(templates): 新增 file-to-docx / data-to-xlsx / markdown-to-pptx 技能包模板"
```

---

### Task 5: 模板 i18n（zh/en）

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: 检查现有 templates.list 结构并追加**

先读现有 `templates.list` 里任一条目的结构，然后按同结构在 `templates.list` 追加三组 key（与 Task 4 的 `nameKey`/`descriptionKey` 一一对应）：

zh：
```json
  "templates": {
    "list": {
      ...existing...,
      "fileToDocx": { "name": "本地文件生成 Word 报告", "description": "读取 storage 目录下的文件，由 AI 生成 Word 报告" },
      "dataToXlsx": { "name": "数据生成 Excel 报表", "description": "把输入数据整理成表格，AI 生成 Excel 报表" },
      "markdownToPptx": { "name": "大纲生成 PPT", "description": "输入主题，AI 生成 Markdown 大纲并输出 PPT 文件" }
    }
  }
```

en：
```json
      "fileToDocx": { "name": "Local Files to Word Report", "description": "Read files under storage/ and generate a Word report with AI" },
      "dataToXlsx": { "name": "Data to Excel Report", "description": "Turn described data into a spreadsheet and generate an Excel file with AI" },
      "markdownToPptx": { "name": "Outline to PPT", "description": "Enter a topic, AI generates a Markdown outline and a PPT file" }
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 通过。浏览器 `/templates` 页出现 3 张新卡片。

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "i18n: 技能包模板库 zh/en 文案"
```

---

### Task 6: 回归验证

**Files:** 无

- [ ] **Step 1: 静态检查 + 构建 + 单测**

Run:
```bash
npm run typecheck && npm run lint && npm run build
npx vitest run src/engine/extensions src/lib/packs
```
Expected: 全部通过（lint 仅存量 24 error）。

- [ ] **Step 2: 端到端手测（`npm run dev:webpack`）**

1. `/extensions` → 技能包市场：确认 office 已安装（前序功能已装）
2. `/templates` → 出现 3 张新卡片
3. 用 `data-to-xlsx` 新建工作流 → 打开 LLM 节点 → 配置面板显示已绑定扩展（扩展拾取器保留 packId 绑定不报错）
4. 执行一次（需有效 LLM key）→ storage/export/ 出现 .xlsx
5. `file-to-docx` 模板：确认节点结构、绑定 filesystem+office 两包

- [ ] **Step 3: Commit（如有残留修复）**

```bash
git add -A
git commit -m "feat(templates): 回归验证与收尾"
```

---

## 自审清单

**Spec 覆盖：**
- 类型 union（string/id + `{packId}`）→ Task 1
- loadSkills packId 解析 → Task 2
- loadMcpExtensions packId 解析 → Task 3
- 3 个模板 builder + 注册 → Task 4
- i18n → Task 5
- 回归 → Task 6

**占位符扫描：** 无 TBD/TODO。

**类型一致性：**
- `SkillPackBinding` / `McpPackBinding` 在 Task 1 定义，Task 2/3 loader 引用一致
- `SkillBinding` / `McpBindingEntry` 类型别名在 Task 2/3 定义并被 loader 使用
- 模板 `config.extensions` 结构（`skills`/`prompts`/`mcp` 数组含 `{packId}`）与 Task 1 类型一致
- 模板 nameKey（`templates.list.fileToDocx.name` 等）与 Task 5 i18n key 完全一致
- builder 导出名（`buildFileToDocxTemplate` 等）与 Task 4 templates.ts 的 import 一致
