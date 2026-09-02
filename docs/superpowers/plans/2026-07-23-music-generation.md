# 音乐生成工作流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `music` 节点 + 增强 `output` 节点导出能力 + 执行历史页音频预览/下载/清空 + 预置 3 节点音乐生成模板，让用户输入提示词即可一键生成并导出音乐。

**Architecture:** `input → music → output` 三节点工作流。music 节点用项目统一的 `resolveExpression` 解析模板、调用用户配置的音乐生成 API（支持异步轮询）、把音频落盘到 `storage/music/`。output 节点按 exportMode（download/local/remote）处理上游音频。执行历史详情页用 `AudioResultCard` 组件提供 `<audio>` 预览、浏览器下载、清空服务端文件。预置模板 API + 工作流列表页按钮一键初始化。

**Tech Stack:** Next.js (Route Handlers) · React + @xyflow/react · Zustand · Prisma · Vitest · lucide-react · i18n（zh.json/en.json）

**测试策略说明：** 本仓库仅对纯逻辑（`src/lib/*`、`src/engine/*`、`src/types/*`）有 Vitest 单测先例，无 React 组件测试设施。本计划对执行器/工具/API 写 TDD 单测；对 UI 组件采用「实现 + `npm run typecheck` + `npm run lint`」验证（遵循仓库现有模式，不强行引入组件测试栈）。

**i18n 强制规则（AGENTS.md）：** 所有新增 UI 文案必须同步写入 `src/i18n/locales/zh.json` 与 `en.json`。Task 2 集中添加全部 key，后续 UI 任务直接引用。

---

## 文件结构

**新建：**
- `src/lib/json-path.ts` — `getByPath(obj, path)` 工具（从 `expression.ts` 抽出复用，music 执行器与测试共用）
- `src/engine/nodes/music.ts` — music 节点执行器
- `src/engine/nodes/music.test.ts` — 执行器单测
- `src/components/nodes/MusicNode.tsx` — 画布节点 UI
- `src/components/panels/AudioResultCard.tsx` — 预览/下载/清空卡片
- `src/app/api/music/file/route.ts` — 音频文件 GET/DELETE 服务
- `src/app/api/music/file/route.test.ts` — 文件服务单测
- `src/app/api/workflow/template/music/route.ts` — 预置模板 API
- `src/app/api/workflow/template/music/route.test.ts` — 模板 API 单测

**修改：**
- `src/types/workflow.ts` — `NodeType` 加 `"music"`；新增 `MusicNodeConfig`；`OutputNodeConfig` 加导出字段
- `src/i18n/locales/zh.json` + `en.json` — 新增文案
- `src/lib/expression.ts` — `getByPath` 改为从 `@/lib/json-path` 导入并 re-export（保持向后兼容）
- `src/engine/nodes/output.ts` — 扩展导出逻辑
- `src/engine/nodes/output.test.ts` — 新建单测
- `src/engine/executor.ts` — 注册 `music` 执行器
- `src/app/api/workflow/run/route.ts` — 修正节点类型窄化（含 music）
- `src/components/canvas/Canvas.tsx` — 注册 `music` nodeType + `getDefaultConfig`
- `src/components/canvas/NodePanel.tsx` — 拖拽入口 + 图标
- `src/components/panels/NodeConfigPanel.tsx` — music 配置分支 + output 导出设置
- `src/app/(dashboard)/history/[id]/page.tsx` — 集成 `AudioResultCard`
- `src/app/(dashboard)/workflows/page.tsx` — 模板入口按钮

---

## Task 1: 类型定义

**Files:**
- Modify: `src/types/workflow.ts:16` (NodeType), `:88-91` (OutputNodeConfig)
- Test: `src/types/workflow.ts`（类型变更由 typecheck 验证）

- [ ] **Step 1: 修改 NodeType 联合类型**

编辑 `src/types/workflow.ts:16`，把：
```ts
export type NodeType = "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger"
```
改为：
```ts
export type NodeType = "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger" | "music"
```

- [ ] **Step 2: 在 OutputNodeConfig 下方新增 MusicNodeConfig，并扩展 OutputNodeConfig**

把 `src/types/workflow.ts:88-91`：
```ts
export interface OutputNodeConfig {
  format: "text" | "json" | "markdown"
  template?: string
}
```
替换为：
```ts
export interface OutputNodeConfig {
  format: "text" | "json" | "markdown"
  template?: string
  exportMode: "download" | "local" | "remote"
  exportPath: string
  remoteUrl: string
}

export interface MusicNodeConfig {
  apiUrl: string
  method: "POST" | "GET"
  headers: Record<string, string>
  bodyTemplate: string
  auth: "none" | "bearer" | "api_key"
  authToken: string
  pollingEnabled: boolean
  taskIdField: string
  pollUrlTemplate: string
  pollIntervalMs: number
  pollMaxAttempts: number
  pollStatusField: string
  pollSuccessValue: string
  audioUrlField: string
  metadataField: string
}
```

- [ ] **Step 3: 运行 typecheck 验证**

Run: `npm run typecheck`
Expected: PASS（无新错误；若 run/route.ts 等处因窄化报错留待 Task 5 修）

- [ ] **Step 4: Commit**

```bash
git add src/types/workflow.ts
git commit -m "feat(types): 新增 music NodeType + MusicNodeConfig + OutputNodeConfig 导出字段"
```

---

## Task 2: i18n 文案

**Files:**
- Modify: `src/i18n/locales/zh.json`, `src/i18n/locales/en.json`

**重要：** 本仓库 i18n 采用**嵌套对象**结构（`{ "canvas": { "music": "..." } }`），`t("canvas.music")` 按 `.` 分割逐层取值。本任务在各分组对象内追加键，**不要**写成 flat key。已存在的 `config.authNone/authBearer/authApiKey`（HTTP 节点用）直接复用，不重复添加。

- [ ] **Step 1: 在 zh.json 的 `canvas` 对象内追加 music 项**

在 `src/i18n/locales/zh.json` 的 `"canvas": { ... }` 对象内，`"cronTriggerDesc"` 行后追加：
```json
    "music": "音乐生成",
    "musicDesc": "调用音乐生成 API 生成音频",
```

- [ ] **Step 2: 在 zh.json 的 `config` 对象内追加 music/export 系列键**

在 `"config": { ... }` 对象内，`"feishuVerificationToken"` 行之后（或任意不破坏逗号的位置）追加：
```json
    "musicApiUrl": "API 地址",
    "musicMethod": "请求方法",
    "musicHeaders": "请求头",
    "musicBody": "请求体模板",
    "musicBodyHint": "可用占位符：{{ $input.prompt }}、{{ $input.style }}、{{ $input.duration }}，或 {{ nodeId.field }} 引用上游节点",
    "musicAuth": "认证方式",
    "musicPolling": "异步轮询",
    "musicPollingHint": "音乐生成通常为异步任务，开启后按 task_id 轮询直到完成",
    "musicTaskIdField": "任务 ID 字段路径",
    "musicPollUrl": "轮询 URL 模板",
    "musicPollUrlHint": "例如 https://api.xxx.com/tasks/{{taskId}}",
    "musicPollInterval": "轮询间隔(ms)",
    "musicPollMaxAttempts": "最大轮询次数",
    "musicPollStatusField": "状态字段路径(可选)",
    "musicPollSuccessValue": "完成状态值(可选)",
    "musicResultExtract": "结果提取",
    "musicAudioUrlField": "音频 URL 字段路径",
    "musicMetadataField": "元信息字段路径(可选)",
    "exportSettings": "导出设置",
    "exportMode": "导出模式",
    "exportDownload": "下载到本地",
    "exportLocal": "保存到服务器目录",
    "exportRemote": "上传到远程 URL",
    "exportPath": "导出目录",
    "exportPathHint": "相对于项目根目录，默认 storage/exports/",
    "remoteUrl": "远程上传 URL",
```

- [ ] **Step 3: 在 zh.json 顶层新增 `audioResult` 与 `templates` 两个对象，并在 `workflows` 对象内追加两键**

在 `workflows` 对象内 `"cancel": "取消"` 行后追加：
```json
    "musicTemplate": "音乐生成模板",
    "musicTemplateDesc": "输入提示词自动生成音乐并导出",
```
在 zh.json 顶层（与 `canvas`/`config` 同级）追加两个新对象：
```json
  "audioResult": {
    "preview": "预览",
    "download": "下载",
    "clear": "清空",
    "clearing": "清除中…",
    "cleared": "已清空",
    "noMetadata": "无元信息",
    "title": "标题",
    "duration": "时长",
    "style": "风格",
    "clearFailed": "清空失败，请重试"
  },
  "templates": {
    "music": {
      "name": "音乐生成模板",
      "description": "输入提示词自动生成音乐并导出",
      "labelInput": "提示词",
      "labelMusic": "音乐生成",
      "labelOutput": "导出"
    }
  }
```

- [ ] **Step 4: 在 en.json 做对应英文追加（同结构同位置）**

`canvas` 内：
```json
    "music": "Music Generation",
    "musicDesc": "Call music generation API to produce audio",
```
`config` 内：
```json
    "musicApiUrl": "API URL",
    "musicMethod": "Method",
    "musicHeaders": "Headers",
    "musicBody": "Body Template",
    "musicBodyHint": "Placeholders: {{ $input.prompt }}, {{ $input.style }}, {{ $input.duration }}, or {{ nodeId.field }} to reference upstream nodes",
    "musicAuth": "Authentication",
    "musicPolling": "Async Polling",
    "musicPollingHint": "Music generation is usually async; enable to poll by task_id until done",
    "musicTaskIdField": "Task ID Field Path",
    "musicPollUrl": "Poll URL Template",
    "musicPollUrlHint": "e.g. https://api.xxx.com/tasks/{{taskId}}",
    "musicPollInterval": "Poll Interval (ms)",
    "musicPollMaxAttempts": "Max Poll Attempts",
    "musicPollStatusField": "Status Field Path (optional)",
    "musicPollSuccessValue": "Success Status Value (optional)",
    "musicResultExtract": "Result Extraction",
    "musicAudioUrlField": "Audio URL Field Path",
    "musicMetadataField": "Metadata Field Path (optional)",
    "exportSettings": "Export Settings",
    "exportMode": "Export Mode",
    "exportDownload": "Download to local",
    "exportLocal": "Save to server directory",
    "exportRemote": "Upload to remote URL",
    "exportPath": "Export Directory",
    "exportPathHint": "Relative to project root, default storage/exports/",
    "remoteUrl": "Remote Upload URL",
```
`workflows` 内：
```json
    "musicTemplate": "Music Generation Template",
    "musicTemplateDesc": "Generate music from a prompt and export it",
```
顶层新对象：
```json
  "audioResult": {
    "preview": "Preview",
    "download": "Download",
    "clear": "Clear",
    "clearing": "Clearing…",
    "cleared": "Cleared",
    "noMetadata": "No metadata",
    "title": "Title",
    "duration": "Duration",
    "style": "Style",
    "clearFailed": "Clear failed, please retry"
  },
  "templates": {
    "music": {
      "name": "Music Generation Template",
      "description": "Generate music from a prompt and export it",
      "labelInput": "Prompt",
      "labelMusic": "Music Generation",
      "labelOutput": "Export"
    }
  }
```

- [ ] **Step 5: 验证 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`

- [ ] **Step 6: 验证 t() 能解析新键（运行现有测试确保未破坏）**

Run: `npm test -- --run src/engine/extensions/merge.test.ts`
Expected: PASS（确认 JSON 结构改动未破坏现有 t() 消费）

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(i18n): 音乐生成工作流文案（嵌套结构）"
```

---

## Task 3: 抽出 getByPath 工具

**Files:**
- Create: `src/lib/json-path.ts`
- Create: `src/lib/json-path.test.ts`
- Modify: `src/lib/expression.ts:18-33`

- [ ] **Step 1: 写失败测试 `src/lib/json-path.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { getByPath } from "@/lib/json-path"

describe("getByPath", () => {
  it("按点路径取值", () => {
    expect(getByPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1)
  })
  it("数组索引 [n]", () => {
    expect(getByPath({ list: [{ x: 9 }] }, "list[0].x")).toBe(9)
  })
  it("路径不存在返回 undefined", () => {
    expect(getByPath({ a: 1 }, "b.c")).toBeUndefined()
  })
  it("null 中途返回 undefined", () => {
    expect(getByPath({ a: null }, "a.b")).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/json-path.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 `src/lib/json-path.ts`**

把 `src/lib/expression.ts:18-33` 的 `getByPath` 函数体原样搬过来：

```ts
export function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current = obj
  for (const key of keys) {
    if (current == null) return undefined
    const arrMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrMatch) {
      const arr = (current as Record<string, unknown>)[arrMatch[1]]
      current = Array.isArray(arr) ? arr[parseInt(arrMatch[2])] : undefined
      continue
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
```

- [ ] **Step 4: 让 expression.ts 复用，删除其本地 getByPath**

把 `src/lib/expression.ts:1-33` 中的 `function getByPath(...)` 整段删除，并在文件顶部 import 后加一行 re-export 保持向后兼容：

```ts
import type { ExecutionContext } from "@/types/workflow"
import { getByPath } from "@/lib/json-path"
export { getByPath }
```
（保留文件其余内容不变。）

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/lib/json-path.test.ts src/engine/extensions/prompt-renderer.test.ts`
Expected: PASS（新测试 + 依赖 expression 的现有测试都通过）

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/json-path.ts src/lib/json-path.test.ts src/lib/expression.ts
git commit -m "refactor: 抽出 getByPath 到 lib/json-path 供 music 执行器复用"
```

---

## Task 4: music 节点执行器（TDD）

**Files:**
- Create: `src/engine/nodes/music.test.ts`
- Create: `src/engine/nodes/music.ts`

**测试要点：** 占位符替换（resolveExpression）、轮询循环、扩展名推断、文件落盘。用 `vi.stubGlobal("fetch", ...)` mock fetch；用 `process.env.MUSIC_STORAGE_DIR` 指向 tmp 目录避免污染仓库。

- [ ] **Step 1: 写失败测试 `src/engine/nodes/music.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { executeMusicNode } from "@/engine/nodes/music"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

let tmpDir: string
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-"))
  process.env.MUSIC_STORAGE_DIR = tmpDir
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  delete process.env.MUSIC_STORAGE_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "music-1",
    type: "music",
    position: { x: 0, y: 0 },
    data: { type: "music", label: "music", config },
  }
}
function makeCtx(input: Record<string, unknown> = {}): ExecutionContext {
  return {
    workflowId: "wf", executionId: "exec-1", input,
    nodeResults: new Map(), logs: [],
  }
}

describe("executeMusicNode", () => {
  it("同步 API：替换占位符并落盘音频", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "audio/mpeg" }),
        arrayBuffer: async () => new ArrayBuffer(8),
      } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      bodyTemplate: '{"prompt":"{{ $input.prompt }}"}',
      auth: "none", authToken: "",
      pollingEnabled: false,
      audioUrlField: "data.audio_url", metadataField: "data.metadata",
    })
    const res = await executeMusicNode(node, makeCtx({ prompt: "jazz" })) as Record<string, unknown>
    expect(fetchMock).toHaveBeenCalledOnce()
    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(opts.body).toBe('{"prompt":"jazz"}')
    expect(res.audioUrl).toContain("/api/music/file?executionId=exec-1&nodeId=music-1")
    expect(res.fileName).toMatch(/^exec-1_music-1\.mp3$/)
    const files = await fs.readdir(tmpDir)
    expect(files).toContain("exec-1_music-1.mp3")
    expect(typeof res.raw).toBe("string")
  })

  it("异步轮询：按 taskId 轮询直到 audio_url 出现", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, text: async () => JSON.stringify({ data: { task_id: "t-99" } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, text: async () => JSON.stringify({ data: { audio_url: "https://cdn/x.wav", metadata: { title: "T" } } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, headers: new Headers({ "content-type": "audio/wav" }),
        arrayBuffer: async () => new ArrayBuffer(4),
      } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "none", authToken: "",
      pollingEnabled: true,
      taskIdField: "data.task_id",
      pollUrlTemplate: "https://api.example.com/tasks/{{taskId}}",
      pollIntervalMs: 0, pollMaxAttempts: 5,
      pollStatusField: "", pollSuccessValue: "",
      audioUrlField: "data.audio_url", metadataField: "data.metadata",
    })
    const res = await executeMusicNode(node, makeCtx()) as Record<string, unknown>
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect((fetchMock.mock.calls[1][0] as string)).toBe("https://api.example.com/tasks/t-99")
    expect(res.fileName).toMatch(/\.wav$/)
    expect((res.metadata as Record<string, unknown>).title).toBe("T")
  })

  it("轮询超时抛错", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ data: { task_id: "t" } }) } as unknown as Response)
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: {} }) } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "none", authToken: "",
      pollingEnabled: true, taskIdField: "data.task_id",
      pollUrlTemplate: "https://api.example.com/tasks/{{taskId}}",
      pollIntervalMs: 0, pollMaxAttempts: 2,
      pollStatusField: "", pollSuccessValue: "",
      audioUrlField: "data.audio_url", metadataField: "",
    })
    await expect(executeMusicNode(node, makeCtx())).rejects.toThrow(/polling timed out/i)
  })

  it("bearer 认证注入 Authorization 头", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true, headers: new Headers({ "content-type": "audio/mpeg" }),
      arrayBuffer: async () => new ArrayBuffer(4),
    } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "bearer", authToken: "secret",
      pollingEnabled: false, audioUrlField: "data.audio_url", metadataField: "",
    })
    await executeMusicNode(node, makeCtx())
    const opts = fetchMock.mock.calls[0][1] as RequestInit
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer secret")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/engine/nodes/music.test.ts`
Expected: FAIL — `executeMusicNode` 不存在

- [ ] **Step 3: 实现 `src/engine/nodes/music.ts`**

```ts
import { promises as fs, existsSync } from "fs"
import path from "path"
import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"
import { getByPath } from "@/lib/json-path"

function musicStorageDir(): string {
  return process.env.MUSIC_STORAGE_DIR || path.join(process.cwd(), "storage", "music")
}

function inferExt(contentType: string | null, url: string): string {
  const ct = (contentType || "").toLowerCase()
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3"
  if (ct.includes("wav")) return "wav"
  if (ct.includes("ogg")) return "ogg"
  const m = url.match(/\.(mp3|wav|ogg)(\?|$)/i)
  if (m) return m[1].toLowerCase()
  return "mp3"
}

async function sleep(ms: number) { await new Promise((r) => setTimeout(r, ms)) }

export const executeMusicNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const method = (config.method as string) || "POST"
  const headers: Record<string, string> = { ...((config.headers as Record<string, string>) || {}) }
  const auth = (config.auth as string) || "none"
  const authToken = (config.authToken as string) || ""

  const url = resolveExpression((config.apiUrl as string) || "", context)
  if (!url) throw new Error("Music API URL is not configured")

  const body = method !== "GET" ? resolveExpression((config.bodyTemplate as string) || "", context) : ""

  if (auth === "bearer" && authToken) headers["Authorization"] = `Bearer ${authToken}`
  else if (auth === "api_key" && authToken) headers["X-API-Key"] = authToken

  const init: RequestInit = { method, headers }
  if (method !== "GET" && body) init.body = body

  const firstRes = await fetch(url, init)
  const firstText = await firstRes.text()
  let firstJson: unknown
  try { firstJson = JSON.parse(firstText) } catch { firstJson = { raw: firstText } }

  const pollingEnabled = Boolean(config.pollingEnabled)
  const taskIdField = (config.taskIdField as string) || ""
  const pollUrlTemplate = (config.pollUrlTemplate as string) || ""
  const pollIntervalMs = (config.pollIntervalMs as number) ?? 3000
  const pollMaxAttempts = (config.pollMaxAttempts as number) ?? 60
  const pollStatusField = (config.pollStatusField as string) || ""
  const pollSuccessValue = (config.pollSuccessValue as string) || ""
  const audioUrlField = (config.audioUrlField as string) || ""
  const metadataField = (config.metadataField as string) || ""

  let finalResp: unknown = firstJson

  if (pollingEnabled) {
    const taskId = String(getByPath(firstJson, taskIdField) ?? "")
    if (!taskId) throw new Error(`Polling enabled but taskId not found at path: ${taskIdField}`)
    const pollUrl = pollUrlTemplate.replace("{{taskId}}", taskId)
    for (let i = 0; i < pollMaxAttempts; i++) {
      await sleep(pollIntervalMs)
      const r = await fetch(pollUrl, { method: "GET", headers })
      const t = await r.text()
      try { finalResp = JSON.parse(t) } catch { finalResp = { raw: t } }
      if (pollStatusField && pollSuccessValue) {
        if (String(getByPath(finalResp, pollStatusField) ?? "") === pollSuccessValue) break
      } else {
        if (getByPath(finalResp, audioUrlField)) break
      }
      if (i === pollMaxAttempts - 1) throw new Error("Music generation polling timed out")
    }
  }

  const remoteAudioUrl = String(getByPath(finalResp, audioUrlField) ?? "")
  if (!remoteAudioUrl) throw new Error(`Audio URL not found at path: ${audioUrlField}`)
  const metadata = metadataField ? (getByPath(finalResp, metadataField) as Record<string, unknown>) ?? {} : {}

  const audioRes = await fetch(remoteAudioUrl)
  if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`)
  const contentType = audioRes.headers.get("content-type")
  const ext = inferExt(contentType, remoteAudioUrl)
  const buf = Buffer.from(await audioRes.arrayBuffer())

  const dir = musicStorageDir()
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })
  const fileName = `${context.executionId}_${node.id}.${ext}`
  const localPath = path.join(dir, fileName)
  await fs.writeFile(localPath, buf)

  const audioUrl = `/api/music/file?executionId=${encodeURIComponent(context.executionId)}&nodeId=${encodeURIComponent(node.id)}`
  return {
    audioUrl,
    localPath,
    fileName,
    metadata,
    raw: JSON.stringify({ audioUrl, metadata }),
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/engine/nodes/music.test.ts`
Expected: PASS（4 个用例全过）

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/nodes/music.ts src/engine/nodes/music.test.ts
git commit -m "feat(engine): music 节点执行器（API 调用/轮询/落盘）"
```

---

## Task 5: 注册 music 执行器 + 修正 run 路由类型窄化

**Files:**
- Modify: `src/engine/executor.ts:10-33`
- Modify: `src/app/api/workflow/run/route.ts:36-45`

- [ ] **Step 1: 在 executor.ts 注册 music**

在 `src/engine/executor.ts` 顶部 import 区追加：
```ts
import { executeMusicNode } from "./nodes/music"
```
在 `nodeExecutors` 对象（约 24-33 行）追加一行：
```ts
  music: executeMusicNode,
```

- [ ] **Step 2: 修正 run/route.ts 的节点类型窄化**

把 `src/app/api/workflow/run/route.ts:36-45`：
```ts
    const nodes = workflow.nodes.map((n) => ({
      id: n.id,
      type: n.type as "input" | "llm" | "output",
      position: { x: n.positionX, y: n.positionY },
      data: n.data as {
        type: "input" | "llm" | "output"
        label: string
        config: Record<string, unknown>
      },
    }))
```
改为：
```ts
    const nodes = workflow.nodes.map((n) => ({
      id: n.id,
      type: n.type as string,
      position: { x: n.positionX, y: n.positionY },
      data: n.data as {
        type: string
        label: string
        config: Record<string, unknown>
      },
    }))
```
（`executeWorkflow` 内部按 `node.data.type` 字符串查 `nodeExecutors` 表，无需窄化联合类型。）

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/engine/executor.ts src/app/api/workflow/run/route.ts
git commit -m "feat(engine): 注册 music 执行器并放宽 run 路由节点类型"
```

---

## Task 6: output 节点导出增强（TDD）

**Files:**
- Create: `src/engine/nodes/output.test.ts`
- Modify: `src/engine/nodes/output.ts`

- [ ] **Step 1: 写失败测试 `src/engine/nodes/output.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { executeOutputNode } from "@/engine/nodes/output"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "export-test-"))
  process.env.EXPORT_STORAGE_DIR = tmpDir
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true } as unknown as Response))
})
afterEach(async () => {
  vi.unstubAllGlobals()
  delete process.env.EXPORT_STORAGE_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "output-1", type: "output", position: { x: 0, y: 0 },
    data: { type: "output", label: "out", config },
  }
}
function makeCtxWithMusic(): ExecutionContext {
  const ctx: ExecutionContext = {
    workflowId: "wf", executionId: "exec-1", input: {},
    nodeResults: new Map(), logs: [],
  }
  ctx.nodeResults.set("music-1", {
    audioUrl: "/api/music/file?executionId=exec-1&nodeId=music-1",
    localPath: path.join(tmpDir, "src.mp3"),
    fileName: "exec-1_music-1.mp3",
    metadata: { title: "Song" },
    raw: '{"audioUrl":"/x","metadata":{}}',
  })
  return ctx
}

describe("executeOutputNode", () => {
  it("download 模式：透传 audio 字段，保留原 output/raw/format", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    const res = await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "download", exportPath: "", remoteUrl: "" }), makeCtxWithMusic()) as Record<string, unknown>
    expect(res.output).toBeDefined()
    expect(res.raw).toBeDefined()
    expect(res.format).toBe("text")
    expect(res.audioUrl).toContain("/api/music/file")
    expect(res.fileName).toBe("exec-1_music-1.mp3")
    expect((res.metadata as Record<string, unknown>).title).toBe("Song")
  })

  it("local 模式：复制到 exportPath", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    const res = await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "local", exportPath: tmpDir, remoteUrl: "" }), makeCtxWithMusic()) as Record<string, unknown>
    const copied = await fs.readdir(tmpDir)
    expect(copied).toContain("exec-1_music-1.mp3")
    expect(res.fileName).toBe("exec-1_music-1.mp3")
  })

  it("remote 模式：POST 文件到 remoteUrl", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    const fetchMock = vi.mocked(fetch)
    await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "remote", exportPath: "", remoteUrl: "https://upload.example.com" }), makeCtxWithMusic())
    expect(fetchMock).toHaveBeenCalled()
    const [, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
    expect(opts.method).toBe("POST")
    expect((opts.body as FormData).get("file")).not.toBeNull()
  })

  it("无上游 music：返回原结构，不追加 audio 字段", async () => {
    const ctx: ExecutionContext = { workflowId: "wf", executionId: "e", input: {}, nodeResults: new Map(), logs: [] }
    ctx.nodeResults.set("llm-1", { raw: "hello" })
    const res = await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "download", exportPath: "", remoteUrl: "" }), ctx) as Record<string, unknown>
    expect(res.audioUrl).toBeUndefined()
    expect(res.output).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/engine/nodes/output.test.ts`
Expected: FAIL（exportMode 等字段尚未使用 / 字段缺失）

- [ ] **Step 3: 改写 `src/engine/nodes/output.ts`**

```ts
import { promises as fs, existsSync } from "fs"
import path from "path"
import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"

function exportBaseDir(): string {
  return process.env.EXPORT_STORAGE_DIR || path.join(process.cwd(), "storage", "exports")
}

interface MusicResult {
  audioUrl: string
  localPath: string
  fileName: string
  metadata: Record<string, unknown>
}

function findUpstreamMusic(context: ExecutionContext): MusicResult | null {
  for (const [, output] of context.nodeResults) {
    if (output && typeof output === "object" && "audioUrl" in (output as Record<string, unknown>)) {
      const r = output as Record<string, unknown>
      if (typeof r.audioUrl === "string" && typeof r.localPath === "string") {
        return {
          audioUrl: r.audioUrl,
          localPath: r.localPath,
          fileName: (r.fileName as string) || path.basename(r.localPath),
          metadata: (r.metadata as Record<string, unknown>) || {},
        }
      }
    }
  }
  return null
}

export const executeOutputNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const format = (config.format as string) || "text"
  const template = (config.template as string) || ""

  const previousOutputs: string[] = []
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.raw && typeof obj.raw === "string") previousOutputs.push(obj.raw)
    } else if (typeof output === "string") {
      previousOutputs.push(output)
    }
  }

  let output: unknown
  switch (format) {
    case "json":
      try { output = JSON.parse(previousOutputs.join("")) } catch { output = previousOutputs }
      break
    case "markdown":
      output = previousOutputs.join("\n\n---\n\n")
      break
    case "text":
    default:
      output = previousOutputs.join("\n\n")
      break
  }

  if (template) {
    let formatted = template
    for (const [nodeId, result] of context.nodeResults) {
      if (typeof result === "object" && result !== null) {
        const obj = result as Record<string, unknown>
        if (typeof obj.raw === "string") formatted = formatted.replace(`{{${nodeId}}}`, obj.raw)
      }
    }
    output = formatted
  }

  const music = findUpstreamMusic(context)
  const exportMode = (config.exportMode as string) || "download"

  if (music) {
    if (exportMode === "local") {
      const dir = (config.exportPath as string) || exportBaseDir()
      if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })
      await fs.copyFile(music.localPath, path.join(dir, music.fileName))
    } else if (exportMode === "remote") {
      const remoteUrl = (config.remoteUrl as string) || ""
      if (!remoteUrl) throw new Error("Export mode is remote but remoteUrl is empty")
      const fileBuf = await fs.readFile(music.localPath)
      const form = new FormData()
      form.append("file", new Blob([fileBuf]), music.fileName)
      const res = await fetch(remoteUrl, { method: "POST", body: form })
      if (!res.ok) throw new Error(`Remote upload failed: ${res.status}`)
    }
    return { output, raw: typeof output === "string" ? output : JSON.stringify(output), format, audioUrl: music.audioUrl, fileName: music.fileName, metadata: music.metadata }
  }

  return { output, raw: typeof output === "string" ? output : JSON.stringify(output), format }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/engine/nodes/output.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/engine/nodes/output.ts src/engine/nodes/output.test.ts
git commit -m "feat(engine): output 节点支持 download/local/remote 导出模式"
```

---

## Task 7: 音频文件服务 API（TDD）

**Files:**
- Create: `src/app/api/music/file/route.test.ts`
- Create: `src/app/api/music/file/route.ts`

**说明：** Next.js Route Handler 在 Vitest 中无法直接当函数调用测试。本任务采用「实现 + 手工 curl 验证脚本」而非单测，因仓库无 route handler 测试设施。若需自动化，可在 Task 后单独引入 `next` 测试工具，但 YAGNI。

- [ ] **Step 1: 实现 `src/app/api/music/file/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

function musicStorageDir(): string {
  return process.env.MUSIC_STORAGE_DIR || path.join(process.cwd(), "storage", "music")
}

async function resolveFile(executionId: string, nodeId: string): Promise<{ filePath: string; ext: string } | null> {
  const dir = musicStorageDir()
  const base = `${executionId}_${nodeId}`
  for (const ext of ["mp3", "wav", "ogg"]) {
    const p = path.join(dir, `${base}.${ext}`)
    try {
      await fs.access(p)
      return { filePath: p, ext }
    } catch {}
  }
  return null
}

export async function GET(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get("executionId")
  const nodeId = req.nextUrl.searchParams.get("nodeId")
  if (!executionId || !nodeId) {
    return NextResponse.json({ error: "executionId and nodeId are required" }, { status: 400 })
  }
  const found = await resolveFile(executionId, nodeId)
  if (!found) return NextResponse.json({ error: "File not found" }, { status: 404 })
  const buf = await fs.readFile(found.filePath)
  const fileName = path.basename(found.filePath)
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": `audio/${found.ext}`,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buf.length),
    },
  })
}

export async function DELETE(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get("executionId")
  const nodeId = req.nextUrl.searchParams.get("nodeId")
  if (!executionId || !nodeId) {
    return NextResponse.json({ error: "executionId and nodeId are required" }, { status: 400 })
  }
  const found = await resolveFile(executionId, nodeId)
  if (!found) return NextResponse.json({ ok: true, alreadyAbsent: true })
  await fs.unlink(found.filePath)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 手工验证脚本**

Run（启动 dev 后另开终端）：
```bash
npm run dev:webpack &  # 后台启动
sleep 8
mkdir -p storage/music && printf '\x00\x01\x02' > storage/music/testexec_testnode.mp3
curl -sI "http://localhost:3000/api/music/file?executionId=testexec&nodeId=testnode" | grep -i content-type
curl -s -X DELETE "http://localhost:3000/api/music/file?executionId=testexec&nodeId=testnode"
ls storage/music/ 2>/dev/null | grep testnode || echo "deleted ok"
```
Expected: `Content-Type: audio/mp3`；DELETE 返回 `{"ok":true}`；文件已删除

- [ ] **Step 3: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/music/file/route.ts
git commit -m "feat(api): 音频文件 GET/DELETE 服务（预览/下载/清空）"
```

---

## Task 8: MusicNode 画布组件

**Files:**
- Create: `src/components/nodes/MusicNode.tsx`

- [ ] **Step 1: 实现组件（仿 HttpNode.tsx 风格，紫色主题）**

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Music } from "lucide-react"

function MusicNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-card shadow-sm min-w-[200px] ${selected ? "border-primary" : "border-purple-200"}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-md bg-purple-100 p-1">
          <Music className="h-4 w-4 text-purple-600" />
        </div>
        <span className="text-sm font-semibold text-foreground">Music</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.apiUrl ? `${config.method || "POST"} ${(config.apiUrl as string).substring(0, 30)}` : "No API configured"}
      </div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-purple-400 !border-2 !border-background" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-purple-400 !border-2 !border-background" />
    </div>
  )
}

export const MusicNodeComponent = memo(MusicNode)
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/nodes/MusicNode.tsx
git commit -m "feat(ui): MusicNode 画布节点组件"
```

---

## Task 9: Canvas 注册 music + getDefaultConfig

**Files:**
- Modify: `src/components/canvas/Canvas.tsx:20-38`（import + nodeTypes）, `:102-108`（addNode 类型）, `:149-176`（getDefaultConfig）

- [ ] **Step 1: import + 注册**

在 `src/components/canvas/Canvas.tsx` import 区（约 27 行 CronTriggerNode 之后）追加：
```ts
import { MusicNodeComponent } from "@/components/nodes/MusicNode"
```
在 `nodeTypes` 对象（约 29-38 行）追加：
```ts
  music: MusicNodeComponent,
```

- [ ] **Step 2: addNode 调用处放宽类型**

把约 102-108 行 `addNode({ ... type: type as "input" | "llm" | ... })` 中两处 `as "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger"` 改为 `as string`（与 Task 5 同理，避免每加节点都改）。具体把：
```ts
        type: type as "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger",
        position,
        data: {
          type: type as "input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger",
```
改为：
```ts
        type: type as string,
        position,
        data: {
          type: type as string,
```

- [ ] **Step 3: getDefaultConfig 加 music 分支**

在 `getDefaultConfig` 函数签名（约 149 行）参数类型追加 `| "music"`，并在 switch 末尾 `case "feishu":` 之后追加：
```ts
    case "music":
      return {
        apiUrl: "",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        bodyTemplate: '{\n  "prompt": "{{ $input.prompt }}",\n  "style": "",\n  "duration": 0\n}',
        auth: "none",
        authToken: "",
        pollingEnabled: false,
        taskIdField: "data.task_id",
        pollUrlTemplate: "",
        pollIntervalMs: 3000,
        pollMaxAttempts: 60,
        pollStatusField: "",
        pollSuccessValue: "",
        audioUrlField: "data.audio_url",
        metadataField: "data.metadata",
      }
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "feat(canvas): 注册 music 节点 + 默认配置"
```

---

## Task 10: NodePanel 拖拽入口

**Files:**
- Modify: `src/components/canvas/NodePanel.tsx:5`（icon import）, `:9-18`（iconMap）, `:23-32`（nodeList）

- [ ] **Step 1: import 加 Music 图标**

把 `src/components/canvas/NodePanel.tsx:5`：
```ts
import { MessageSquare, Brain, BookOpen, Send, Globe, GitFork, Combine, Timer, ArrowRight } from "lucide-react"
```
改为：
```ts
import { MessageSquare, Brain, BookOpen, Send, Globe, GitFork, Combine, Timer, ArrowRight, Music } from "lucide-react"
```

- [ ] **Step 2: iconMap 加 music**

在 `iconMap` 对象（约 9-18 行）`cron_trigger:` 行后追加：
```ts
  music: <Music className="h-4 w-4" />,
```

- [ ] **Step 3: nodeList 加 music 项**

在 `nodeList` 数组（约 23-32 行）`cron_trigger` 项后追加：
```ts
    { type: "music", label: t("canvas.music"), description: t("canvas.musicDesc") },
```

- [ ] **Step 4: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/NodePanel.tsx
git commit -m "feat(canvas): NodePanel 新增 music 拖拽入口"
```

---

## Task 11: NodeConfigPanel music 配置 + output 导出设置

**Files:**
- Modify: `src/components/panels/NodeConfigPanel.tsx`（import、music 分支、output 分支增强）

- [ ] **Step 1: import 补 Switch 已有；无需新 import（现有 Input/Label/Textarea/Switch/Separator/Select 都已导入）**

确认文件顶部 import 块已含 `Switch`、`Separator`、`Music` 不需要（无图标）。

- [ ] **Step 2: 在 OUTPUT NODE 分支增强导出设置**

把 `src/components/canvas/.../NodeConfigPanel.tsx` 中 `{/* ===== OUTPUT NODE ===== */}` 分支（约 218-237 行）的整个 output 块替换为：
```tsx
      {/* ===== OUTPUT NODE ===== */}
      {node.data.type === "output" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("config.format")}</Label>
            <Select value={(config.format as string) || "text"} onValueChange={(v) => updateConfig("format", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="output-template">{t("config.template")}</Label>
            <Textarea id="output-template" value={(config.template as string) || ""} onChange={(e) => updateConfig("template", e.target.value)} placeholder={t("config.templatePlaceholder")} rows={4} />
          </div>
          <Separator />
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("config.exportSettings")}</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label>{t("config.exportMode")}</Label>
                <Select value={(config.exportMode as string) || "download"} onValueChange={(v) => updateConfig("exportMode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="download">{t("config.exportDownload")}</SelectItem>
                    <SelectItem value="local">{t("config.exportLocal")}</SelectItem>
                    <SelectItem value="remote">{t("config.exportRemote")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {((config.exportMode as string) || "download") === "local" && (
                <div className="space-y-2">
                  <Label htmlFor="export-path">{t("config.exportPath")}</Label>
                  <Input id="export-path" value={(config.exportPath as string) || ""} onChange={(e) => updateConfig("exportPath", e.target.value)} placeholder="storage/exports/" className="text-sm font-mono" />
                  <p className="text-[10px] text-muted-foreground">{t("config.exportPathHint")}</p>
                </div>
              )}
              {((config.exportMode as string) || "download") === "remote" && (
                <div className="space-y-2">
                  <Label htmlFor="remote-url">{t("config.remoteUrl")}</Label>
                  <Input id="remote-url" value={(config.remoteUrl as string) || ""} onChange={(e) => updateConfig("remoteUrl", e.target.value)} placeholder="https://upload.example.com" className="text-sm font-mono" />
                </div>
              )}
            </div>
          </details>
        </div>
      )}
```

- [ ] **Step 3: 在 FEISHU 分支之前插入 MUSIC 分支**

在 `{/* ===== HTTP NODE ===== */}` 注释行之前插入：
```tsx
      {/* ===== MUSIC NODE ===== */}
      {node.data.type === "music" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2 col-span-1">
              <Label>{t("config.musicMethod")}</Label>
              <Select value={(config.method as string) || "POST"} onValueChange={(v) => updateConfig("method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-3">
              <Label htmlFor="music-api-url">{t("config.musicApiUrl")}</Label>
              <Input id="music-api-url" value={(config.apiUrl as string) || ""} onChange={(e) => updateConfig("apiUrl", e.target.value)} placeholder="https://api.example.com/generate" className="text-sm font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="music-headers">{t("config.musicHeaders")}</Label>
            <Textarea id="music-headers" value={JSON.stringify(config.headers || {}, null, 2)} onChange={(e) => { try { updateConfig("headers", JSON.parse(e.target.value || "{}")) } catch {} }} placeholder='{\n  "Content-Type": "application/json"\n}' rows={3} className="text-sm font-mono" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="music-body">{t("config.musicBody")}</Label>
            <Textarea id="music-body" value={(config.bodyTemplate as string) || ""} onChange={(e) => updateConfig("bodyTemplate", e.target.value)} placeholder='{"prompt":"{{ $input.prompt }}"}' rows={4} className="text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground">{t("config.musicBodyHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("config.musicAuth")}</Label>
            <Select value={(config.auth as string) || "none"} onValueChange={(v) => updateConfig("auth", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("config.authNone")}</SelectItem>
                <SelectItem value="bearer">{t("config.authBearer")}</SelectItem>
                <SelectItem value="api_key">{t("config.authApiKey")}</SelectItem>
              </SelectContent>
            </Select>
            {((config.auth as string) || "none") !== "none" && (
              <Input type="password" value={(config.authToken as string) || ""} onChange={(e) => updateConfig("authToken", e.target.value)} placeholder={t("config.musicAuth")} className="text-sm font-mono" />
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="music-polling">{t("config.musicPolling")}</Label>
              <p className="text-[10px] text-muted-foreground">{t("config.musicPollingHint")}</p>
            </div>
            <Switch id="music-polling" checked={(config.pollingEnabled as boolean) || false} onCheckedChange={(v) => updateConfig("pollingEnabled", v)} />
          </div>
          {(config.pollingEnabled as boolean) && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="music-task-id" className="text-xs">{t("config.musicTaskIdField")}</Label>
                <Input id="music-task-id" value={(config.taskIdField as string) || ""} onChange={(e) => updateConfig("taskIdField", e.target.value)} placeholder="data.task_id" className="text-sm font-mono" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="music-poll-url" className="text-xs">{t("config.musicPollUrl")}</Label>
                <Input id="music-poll-url" value={(config.pollUrlTemplate as string) || ""} onChange={(e) => updateConfig("pollUrlTemplate", e.target.value)} placeholder="https://api.xxx.com/tasks/{{taskId}}" className="text-sm font-mono" />
                <p className="text-[10px] text-muted-foreground">{t("config.musicPollUrlHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="music-poll-interval" className="text-xs">{t("config.musicPollInterval")}</Label>
                  <Input id="music-poll-interval" type="number" min={0} step={100} value={config.pollIntervalMs as number ?? 3000} onChange={(e) => updateConfig("pollIntervalMs", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="music-poll-max" className="text-xs">{t("config.musicPollMaxAttempts")}</Label>
                  <Input id="music-poll-max" type="number" min={1} value={config.pollMaxAttempts as number ?? 60} onChange={(e) => updateConfig("pollMaxAttempts", parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="music-poll-status" className="text-xs">{t("config.musicPollStatusField")}</Label>
                  <Input id="music-poll-status" value={(config.pollStatusField as string) || ""} onChange={(e) => updateConfig("pollStatusField", e.target.value)} placeholder="data.status" className="text-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="music-poll-success" className="text-xs">{t("config.musicPollSuccessValue")}</Label>
                  <Input id="music-poll-success" value={(config.pollSuccessValue as string) || ""} onChange={(e) => updateConfig("pollSuccessValue", e.target.value)} placeholder="success" className="text-sm font-mono" />
                </div>
              </div>
            </div>
          )}
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs font-semibold">{t("config.musicResultExtract")}</Label>
            <div className="space-y-2">
              <Label htmlFor="music-audio-url-field" className="text-xs">{t("config.musicAudioUrlField")}</Label>
              <Input id="music-audio-url-field" value={(config.audioUrlField as string) || ""} onChange={(e) => updateConfig("audioUrlField", e.target.value)} placeholder="data.audio_url" className="text-sm font-mono" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-metadata-field" className="text-xs">{t("config.musicMetadataField")}</Label>
              <Input id="music-metadata-field" value={(config.metadataField as string) || ""} onChange={(e) => updateConfig("metadataField", e.target.value)} placeholder="data.metadata" className="text-sm font-mono" />
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/NodeConfigPanel.tsx
git commit -m "feat(ui): NodeConfigPanel music 配置分支 + output 导出设置"
```

---

## Task 12: AudioResultCard 组件

**Files:**
- Create: `src/components/panels/AudioResultCard.tsx`

- [ ] **Step 1: 实现组件**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Play, Download, Trash2, Loader2 } from "lucide-react"
import { useTranslation } from "@/i18n"

interface AudioResultCardProps {
  executionId: string
  nodeId: string
  audioUrl: string
  fileName: string
  metadata: Record<string, unknown>
  onCleared?: () => void
}

export function AudioResultCard({ executionId, nodeId, audioUrl, fileName, metadata, onCleared }: AudioResultCardProps) {
  const { t } = useTranslation()
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClear = async () => {
    setClearing(true)
    setError(null)
    try {
      const res = await fetch(`/api/music/file?executionId=${encodeURIComponent(executionId)}&nodeId=${encodeURIComponent(nodeId)}`, { method: "DELETE" })
      if (!res.ok) throw new Error("delete failed")
      onCleared?.()
    } catch {
      setError(t("audioResult.clearFailed"))
    } finally {
      setClearing(false)
    }
  }

  const known: Record<string, string> = {
    title: t("audioResult.title"),
    duration: t("audioResult.duration"),
    style: t("audioResult.style"),
  }
  const entries = Object.entries(metadata || {})

  return (
    <div className="mt-3 space-y-3">
      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Play className="h-3.5 w-3.5" />{t("audioResult.preview")}
        </div>
        <audio controls src={audioUrl} className="w-full" />
        <div className="text-xs text-muted-foreground break-all">{fileName}</div>
      </Card>

      <Card className="p-3 space-y-2">
        <div className="text-xs font-semibold text-foreground">{t("audioResult.preview")}</div>
        {entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">{t("audioResult.noMetadata")}</div>
        ) : (
          <dl className="text-xs space-y-1">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-muted-foreground min-w-[60px]">{known[k] || k}</dt>
                <dd className="text-foreground break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <div className="flex items-center gap-2">
        <a href={audioUrl} download={fileName}>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />{t("audioResult.download")}</Button>
        </a>
        <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing}>
          {clearing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
          {clearing ? t("audioResult.clearing") : t("audioResult.clear")}
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/AudioResultCard.tsx
git commit -m "feat(ui): AudioResultCard 预览/下载/清空组件"
```

---

## Task 13: 执行历史详情页集成 AudioResultCard

**Files:**
- Modify: `src/app/(dashboard)/history/[id]/page.tsx`

- [ ] **Step 1: import AudioResultCard**

在 `src/app/(dashboard)/history/[id]/page.tsx` import 区追加：
```ts
import { AudioResultCard } from "@/components/panels/AudioResultCard"
import { useTranslation } from "@/i18n"
```
并在组件函数体顶部加 `const { t } = useTranslation()`（现有代码未用 i18n，但本任务保持现状不强制中文化已有文案，仅新增部分用 t）。

- [ ] **Step 2: 替换 log 渲染块**

把 `src/app/(dashboard)/history/[id]/page.tsx` 中 `{Boolean(log.output) && (...)}` 整块（约 78-85 行）替换为：
```tsx
                {(() => {
                  const out = log.output as Record<string, unknown> | null
                  const isAudio = out && typeof out === "object" && typeof out.audioUrl === "string"
                  if (isAudio) {
                    return (
                      <AudioResultCard
                        executionId={id}
                        nodeId={log.nodeId as string}
                        audioUrl={out!.audioUrl as string}
                        fileName={(out!.fileName as string) || "audio"}
                        metadata={(out!.metadata as Record<string, unknown>) || {}}
                      />
                    )
                  }
                  if (out) {
                    return (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">输出数据</summary>
                        <pre className="mt-1 p-2 rounded bg-muted font-mono text-[11px] whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {JSON.stringify(out, null, 2).substring(0, 1000)}
                        </pre>
                      </details>
                    )
                  }
                  return null
                })()}
```

- [ ] **Step 3: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/history/[id]/page.tsx"
git commit -m "feat(ui): 执行历史详情页集成 AudioResultCard"
```

---

## Task 14: 预置模板 API（TDD）

**Files:**
- Create: `src/app/api/workflow/template/music/route.test.ts`
- Create: `src/app/api/workflow/template/music/route.ts`

**说明：** Route Handler 无法直接单测；改为把模板构造逻辑抽成纯函数 `buildMusicTemplate(lang)` 同文件导出，测试纯函数。

- [ ] **Step 1: 写失败测试 `src/app/api/workflow/template/music/route.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { buildMusicTemplate } from "@/app/api/workflow/template/music/route"

describe("buildMusicTemplate", () => {
  it("zh 返回中文 label 与 3 节点 2 边", () => {
    const tpl = buildMusicTemplate("zh")
    expect(tpl.name).toBe("音乐生成模板")
    expect(tpl.nodes).toHaveLength(3)
    expect(tpl.edges).toHaveLength(2)
    const labels = tpl.nodes.map((n) => n.data.label)
    expect(labels).toEqual(["提示词", "音乐生成", "导出"])
    expect(tpl.nodes[1].data.type).toBe("music")
    expect((tpl.nodes[1].data.config as Record<string, unknown>).audioUrlField).toBe("data.audio_url")
  })

  it("en 返回英文 label", () => {
    const tpl = buildMusicTemplate("en")
    expect(tpl.nodes.map((n) => n.data.label)).toEqual(["Prompt", "Music Generation", "Export"])
  })

  it("默认(未知 lang) 回退 zh", () => {
    expect(buildMusicTemplate("fr").nodes.map((n) => n.data.label)).toEqual(["提示词", "音乐生成", "导出"])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/api/workflow/template/music/route.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 `src/app/api/workflow/template/music/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server"

interface TemplateNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: { type: string; label: string; config: Record<string, unknown> }
}
interface TemplateEdge { id: string; source: string; target: string }
interface Template { name: string; description: string; nodes: TemplateNode[]; edges: TemplateEdge[] }

const I18N = {
  zh: {
    name: "音乐生成模板",
    description: "输入提示词自动生成音乐并导出",
    labelInput: "提示词", labelMusic: "音乐生成", labelOutput: "导出",
  },
  en: {
    name: "Music Generation Template",
    description: "Generate music from a prompt and export it",
    labelInput: "Prompt", labelMusic: "Music Generation", labelOutput: "Export",
  },
}

export function buildMusicTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  const musicDefault: Record<string, unknown> = {
    apiUrl: "", method: "POST", headers: { "Content-Type": "application/json" },
    bodyTemplate: '{\n  "prompt": "{{ $input.prompt }}",\n  "style": "",\n  "duration": 0\n}',
    auth: "none", authToken: "",
    pollingEnabled: false, taskIdField: "data.task_id", pollUrlTemplate: "",
    pollIntervalMs: 3000, pollMaxAttempts: 60, pollStatusField: "", pollSuccessValue: "",
    audioUrlField: "data.audio_url", metadataField: "data.metadata",
  }
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 200 },
        data: { type: "input", label: i.labelInput, config: { name: "prompt", type: "text", required: true, default: "" } } },
      { id: "music-1", type: "music", position: { x: 400, y: 200 },
        data: { type: "music", label: i.labelMusic, config: musicDefault } },
      { id: "output-1", type: "output", position: { x: 700, y: 200 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "", exportMode: "download", exportPath: "storage/exports/", remoteUrl: "" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "music-1" },
      { id: "e2", source: "music-1", target: "output-1" },
    ],
  }
}

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") || "zh"
  return NextResponse.json(buildMusicTemplate(lang))
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/app/api/workflow/template/music/route.test.ts`
Expected: PASS（3 用例）

- [ ] **Step 5: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/workflow/template/music/route.ts src/app/api/workflow/template/music/route.test.ts
git commit -m "feat(api): 音乐生成预置模板 API（buildMusicTemplate 纯函数 + GET）"
```

---

## Task 15: 工作流列表页模板入口按钮

**Files:**
- Modify: `src/app/(dashboard)/workflows/page.tsx`

- [ ] **Step 1: import useRouter + Music 图标 + useTranslation（已有）**

在 `src/app/(dashboard)/workflows/page.tsx` import 区追加：
```ts
import { useRouter } from "next/navigation"
import { Music } from "lucide-react"
import { useWorkflowStore } from "@/stores/workflow"
```
（`useTranslation` 已导入；`Workflow, Plus, ArrowRight, Loader2, Trash2` 已在，仅需加 `Music`。）

- [ ] **Step 2: 在组件内加创建模板逻辑**

在 `WorkflowsPage` 函数体顶部已有 `const { t } = useTranslation()` 之后追加：
```ts
  const router = useRouter()
  const { setWorkflow, setWorkflowId } = useWorkflowStore()
  const [creatingTemplate, setCreatingTemplate] = useState(false)

  const handleCreateFromMusicTemplate = async () => {
    setCreatingTemplate(true)
    try {
      const lang = typeof localStorage !== "undefined" ? (localStorage.getItem("workflow-locale") || "zh") : "zh"
      const tpl = await fetch(`/api/workflow/template/music?lang=${lang}`).then((r) => r.json())
      setWorkflow(
        { id: "", name: tpl.name, description: tpl.description, config: {}, createdAt: "", updatedAt: "" },
        tpl.nodes.map((n: TemplateNode) => ({ id: n.id, type: n.type as never, position: n.position, data: n.data })),
        tpl.edges.map((e: TemplateEdge) => ({ id: e.id, source: e.source, target: e.target })),
      )
      setWorkflowId(null)
      router.push("/workflow/new")
    } catch (e) {
      console.error(e)
    } finally {
      setCreatingTemplate(false)
    }
  }
```
并在 import 末尾或文件顶部加类型（同文件内）：
```ts
type TemplateNode = { id: string; type: string; position: { x: number; y: number }; data: { type: string; label: string; config: Record<string, unknown> } }
type TemplateEdge = { id: string; source: string; target: string }
```

- [ ] **Step 3: 在「新建工作流」按钮旁加模板按钮**

把 `src/app/(dashboard)/workflows/page.tsx` 中（约 59-61 行）：
```tsx
        <Link href="/workflow/new">
          <Button><Plus className="h-4 w-4 mr-2" />{t("workflows.newWorkflow")}</Button>
        </Link>
```
替换为：
```tsx
        <div className="flex items-center gap-2">
          <Link href="/workflow/new">
            <Button><Plus className="h-4 w-4 mr-2" />{t("workflows.newWorkflow")}</Button>
          </Link>
          <Button variant="outline" onClick={handleCreateFromMusicTemplate} disabled={creatingTemplate}>
            <Music className="h-4 w-4 mr-2" />{t("workflows.musicTemplate")}
          </Button>
        </div>
```

- [ ] **Step 4: 确认 setWorkflow 签名匹配 store**

Run: `rg -n "setWorkflow\(|setWorkflowId" src/stores/workflow.ts | head`
Expected: 看到 `setWorkflow: (wf, nodes, edges) => void` 与 `setWorkflowId: (id) => void`，签名与 Step 2 调用一致；若不一致则按实际签名调整。

- [ ] **Step 5: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/workflows/page.tsx"
git commit -m "feat(ui): 工作流列表页新增「音乐生成模板」入口"
```

---

## Task 16: 全量验证

**Files:** 无（仅验证）

- [ ] **Step 1: 跑全部单测**

Run: `npm test`
Expected: PASS（含新增 music/output/json-path/template 测试）

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: 生产构建冒烟**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: 手工端到端验证**

启动 `npm run dev:webpack`，浏览器：
1. 访问 `/workflows` → 点击「音乐生成模板」→ 跳转 `/workflow/new`，画布显示 input→music→output 三节点。
2. 选中 music 节点 → 配置面板填入测试音乐 API（可用本地 mock server：`node -e "require('http').createServer((q,s)=>s.end(JSON.stringify({data:{audio_url:'https://www.kozco.com/tech/piano2.wav'}}))).listen(9999)"`），audioUrlField=`data.audio_url`，关闭轮询。
3. 保存工作流并运行（输入 prompt）。
4. 进 `/history/<id>` → output/music log 下出现 `<audio>` 播放器能播放钢琴音、元信息卡片、下载按钮可下载、清空按钮删除服务端文件后卡片消失。
Expected: 全流程通过

- [ ] **Step 6: 最终 Commit（仅元数据/无代码改动则跳过）**

如有验证中发现的修复，按 fix: 提交。

---

## 自检备注（plan 自检已执行）

- 自检修正（已应用）：i18n 结构从 flat key 改为嵌套对象（仓库实际结构）；移除重复的 `authNone/authBearer/authApiKey`（复用 HTTP 节点已有键）；store `setWorkflow(config, nodes, edges)` / `setWorkflowId(id|null)` 签名已与 Task 15 调用核对一致。
- Spec 覆盖：music 节点(T1,3,4,5,8,9,11)、output 增强(T1,6,11)、AudioResultCard(T12,13)、模板 API(T14)、模板入口(T15)、i18n(T2)、文件服务(T7)、错误处理(各执行器/组件内)、测试要点(T3,4,6,7,14,16)。全覆盖。
- 占位符扫描：无 TBD/TODO。
- 类型一致：`MusicNodeConfig` 字段名在 T1/T4/T9/T14 完全一致（apiUrl/method/headers/bodyTemplate/auth/authToken/pollingEnabled/taskIdField/pollUrlTemplate/pollIntervalMs/pollMaxAttempts/pollStatusField/pollSuccessValue/audioUrlField/metadataField）。`buildMusicTemplate` 默认值与 `getDefaultConfig("music")`（T9）一致。AudioResultCard props（executionId/nodeId/audioUrl/fileName/metadata）与 T13 传参一致。
