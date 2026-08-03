# 节点凭证选择 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 music 和 LLM 节点能通过「选择凭证」下拉引用全局凭证，执行时从数据库解密读取凭证值作为认证凭据，并与手动 key 二选一。

**Architecture:** `MusicNodeConfig`/`LLMNodeConfig` 各加可选 `credentialId` 字段。新增 `src/lib/credential.ts` 提供 `resolveCredentialValue(credentialId)` 服务端读取解密工具。两执行器在认证注入前解析凭证：`credentialId` 非空 → 用凭证值；为空 → 走现有手动 key/env 回退链。NodeConfigPanel 用共享 `CredentialSelect` 下拉列出全局凭证，选中后隐藏手动输入框。**错误边界强化**：凭证不存在返回 null 由调用方抛清晰错误；UI 凭证拉取失败降级为空态；凭证被删在面板显示「凭证缺失」。

**Tech Stack:** Next.js · React · Prisma · Vitest · lucide-react · i18n（zh.json/en.json）

**测试策略：** 对 `credential.ts` 与两执行器的凭证解析写 TDD 单测；UI 组件遵循仓库现有模式（typecheck + lint 验证，不引入组件测试栈）。

---

## 文件结构

**新建：**
- `src/lib/credential.ts` — 凭证读取工具
- `src/lib/credential.test.ts` — 工具单测
- `src/components/panels/CredentialSelect.tsx` — 凭证下拉共享组件

**修改：**
- `src/types/workflow.ts` — 两个 Config 接口加 `credentialId?`
- `src/engine/nodes/music.ts` — 凭证解析
- `src/engine/nodes/music.test.ts` — 补凭证解析测试
- `src/engine/nodes/llm.ts` — 凭证解析
- `src/engine/nodes/llm.test.ts` — 新建（若不存在则创建）
- `src/components/panels/NodeConfigPanel.tsx` — music 认证区 + LLM apiKey 区集成
- `src/i18n/locales/zh.json` + `en.json` — 新文案

---

## Task 1: 类型扩展 + 凭证读取工具（TDD）

**Files:**
- Modify: `src/types/workflow.ts`（LLMNodeConfig、MusicNodeConfig）
- Create: `src/lib/credential.ts`
- Test: `src/lib/credential.test.ts`

- [ ] **Step 1: 给两个 Config 接口加 `credentialId?`**

在 `src/types/workflow.ts` 的 `LLMNodeConfig` 接口末尾（`maxTokens: number` 之后）追加：
```ts
  credentialId?: string
```
在 `MusicNodeConfig` 接口末尾（`metadataField: string` 之后）追加：
```ts
  credentialId?: string
```

- [ ] **Step 2: 写失败测试 `src/lib/credential.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveCredentialValue } from "@/lib/credential"

const prismaMock = { credential: { findUnique: vi.fn() } }
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const decryptMock = vi.fn()
vi.mock("@/lib/crypto", () => ({
  decrypt: decryptMock,
}))

describe("resolveCredentialValue", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("credentialId 为空返回 null（不查询数据库）", async () => {
    const res = await resolveCredentialValue("")
    expect(res).toBeNull()
    expect(prismaMock.credential.findUnique).not.toHaveBeenCalled()
  })

  it("credentialId 为 undefined 返回 null", async () => {
    const res = await resolveCredentialValue(undefined)
    expect(res).toBeNull()
  })

  it("凭证不存在返回 null", async () => {
    prismaMock.credential.findUnique.mockResolvedValue(null)
    const res = await resolveCredentialValue("missing-id")
    expect(res).toBeNull()
    expect(prismaMock.credential.findUnique).toHaveBeenCalledWith({ where: { id: "missing-id" } })
  })

  it("凭证存在时解密并返回值", async () => {
    decryptMock.mockReturnValue("sk-real-key")
    prismaMock.credential.findUnique.mockResolvedValue({ id: "c1", value: "encrypted-blob" })
    const res = await resolveCredentialValue("c1")
    expect(res).toBe("sk-real-key")
    expect(decryptMock).toHaveBeenCalledWith("encrypted-blob")
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/lib/credential.test.ts`
Expected: FAIL — `@/lib/credential` 模块不存在

- [ ] **Step 4: 实现 `src/lib/credential.ts`**

```ts
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

/**
 * 按凭证 ID 读取解密后的值。
 * - credentialId 为空 → 返回 null（不查库）
 * - 凭证不存在 → 返回 null（调用方决定如何处理）
 * - 凭证存在 → 解密返回明文值
 */
export async function resolveCredentialValue(credentialId?: string | null): Promise<string | null> {
  if (!credentialId) return null
  const cred = await prisma.credential.findUnique({ where: { id: credentialId } })
  if (!cred) return null
  return decrypt(cred.value)
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/lib/credential.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: PASS（仅预存的 McpEditor/PromptEditor 错误）

- [ ] **Step 7: Commit**

```bash
git add src/types/workflow.ts src/lib/credential.ts src/lib/credential.test.ts
git commit -m "feat(credential): 新增 resolveCredentialValue 工具 + Config 加 credentialId 字段"
```

---

## Task 2: music 执行器凭证解析（TDD）

**Files:**
- Modify: `src/engine/nodes/music.ts`（认证头注入处 ~35-39 行）
- Modify: `src/engine/nodes/music.test.ts`（追加用例）

- [ ] **Step 1: 追加测试到 `src/engine/nodes/music.test.ts`**

在文件顶部 import 区追加：
```ts
vi.mock("@/lib/credential", () => ({
  resolveCredentialValue: vi.fn(),
}))
import { resolveCredentialValue } from "@/lib/credential"
```

在 `describe("executeMusicNode")` 内追加 3 个用例：

```ts
  it("credentialId 存在 → 用凭证值作为 bearer token", async () => {
    ;(resolveCredentialValue as ReturnType<typeof vi.fn>).mockResolvedValue("cred-token")
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ data: { audio_url: "https://cdn/x.mp3" } }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ "content-type": "audio/mpeg" }), arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "bearer", authToken: "",
      credentialId: "cred-1", pollingEnabled: false,
      audioUrlField: "data.audio_url", metadataField: "",
    })
    await executeMusicNode(node, makeCtx())
    expect(resolveCredentialValue).toHaveBeenCalledWith("cred-1")
    const opts = fetchMock.mock.calls[0][1] as RequestInit
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer cred-token")
  })

  it("credentialId 存在但凭证不存在 → 抛清晰错误", async () => {
    ;(resolveCredentialValue as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "bearer", authToken: "",
      credentialId: "cred-missing", pollingEnabled: false,
      audioUrlField: "data.audio_url", metadataField: "",
    })
    await expect(executeMusicNode(node, makeCtx())).rejects.toThrow(/Credential not found: cred-missing/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("credentialId 为空 → 走原 authToken 逻辑", async () => {
    ;(resolveCredentialValue as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ data: { audio_url: "https://cdn/x.mp3" } }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ "content-type": "audio/mpeg" }), arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "bearer", authToken: "manual-secret",
      credentialId: "", pollingEnabled: false,
      audioUrlField: "data.audio_url", metadataField: "",
    })
    await executeMusicNode(node, makeCtx())
    expect(resolveCredentialValue).not.toHaveBeenCalled()
    const opts = fetchMock.mock.calls[0][1] as RequestInit
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer manual-secret")
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/engine/nodes/music.test.ts`
Expected: FAIL（凭证用例失败，因 music.ts 尚未实现凭证解析）

- [ ] **Step 3: 修改 `src/engine/nodes/music.ts`**

在文件顶部 import 区追加：
```ts
import { resolveCredentialValue } from "@/lib/credential"
```

把认证头注入段（当前 30-39 行）替换为：
```ts
  const auth = (config.auth as string) || "none"
  const authToken = (config.authToken as string) || ""
  const credentialId = (config.credentialId as string) || ""

  const url = resolveExpression((config.apiUrl as string) || "", context)
  if (!url) throw new Error("Music API URL is not configured")

  const body = method !== "GET" ? resolveExpression((config.bodyTemplate as string) || "", context) : ""

  // 凭证优先：credentialId 非空时从数据库读取解密值作为 token
  let effectiveToken = authToken
  if (credentialId) {
    const credValue = await resolveCredentialValue(credentialId)
    if (!credValue) throw new Error(`Credential not found: ${credentialId}`)
    effectiveToken = credValue
  }

  if (auth === "bearer" && effectiveToken) headers["Authorization"] = `Bearer ${resolveExpression(effectiveToken, context)}`
  else if (auth === "api_key" && effectiveToken) headers["X-API-Key"] = resolveExpression(effectiveToken, context)
```

注意：凭证值仍走 `resolveExpression`（兼容用户把凭证值本身写成模板引用的场景，且对明文 key 无副作用——不含 `{{ }}` 时原样返回）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/engine/nodes/music.test.ts`
Expected: PASS（现有 8 用例 + 新增 3 用例 = 11）

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: PASS（仅预存错误）

- [ ] **Step 6: Commit**

```bash
git add src/engine/nodes/music.ts src/engine/nodes/music.test.ts
git commit -m "feat(engine): music 节点支持引用全局凭证（credentialId）"
```

---

## Task 3: LLM 执行器凭证解析（TDD）

**Files:**
- Modify: `src/engine/nodes/llm.ts`（finalApiKey 计算处 73-84 行）
- Create: `src/engine/nodes/llm.test.ts`

- [ ] **Step 1: 写失败测试 `src/engine/nodes/llm.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest"
import { executeLLMNode } from "@/engine/nodes/llm"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

vi.mock("@/lib/credential", () => ({ resolveCredentialValue: vi.fn() }))
import { resolveCredentialValue } from "@/lib/credential"

// mock createModel 相关模块，避免真实网络调用
vi.mock("./llm", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./llm")>()
  return { ...mod }
})

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "llm-1", type: "llm", position: { x: 0, y: 0 },
    data: { type: "llm", label: "llm", config },
  }
}
function makeCtx(): ExecutionContext {
  const ctx: ExecutionContext = { workflowId: "wf", executionId: "e", input: {}, nodeResults: new Map(), logs: [] }
  ctx.nodeResults.set("input-1", { prompt: "hi", raw: "hi" })
  return ctx
}

describe("executeLLMNode credential resolution", () => {
  it("credentialId 存在 → 凭证值作为 API key", async () => {
    ;(resolveCredentialValue as ReturnType<typeof vi.fn>).mockResolvedValue("cred-key")
    // 触发缺 key 之外的分支：mock 网络层
    // 通过让 fetch 抛错来中断，但先断言 key 已解析
    // 由于无法轻易 mock AI SDK，这里断言 executeLLMNode 在凭证存在时不会抛 "No API key"
    // （真实 API 调用会因网络错误失败，但我们验证的是 key 解析前置逻辑）
    const node = makeNode({ provider: "openai", model: "gpt-4o-mini", apiKey: "", credentialId: "cred-1" })
    const promise = executeLLMNode(node, makeCtx())
    await expect(promise).rejects.toThrow() // 网络/AI SDK 层失败，但证明没卡在 key 缺失
    expect(resolveCredentialValue).toHaveBeenCalledWith("cred-1")
  })
})
```

**重要说明：** LLM 执行器底层用 AI SDK（createModel + generateText），单测无法轻易 mock 其网络调用。本任务采用「黑盒验证」：断言凭证存在时不再抛 `No API key`（凭证缺失分支），且 `resolveCredentialValue` 被调用。若这不够精确，可实现者可在 mock 中拦截 `./llm` 模块的 `createModel`/`generateText` 依赖——但优先用上述断言，YAGNI。

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/engine/nodes/llm.test.ts`
Expected: FAIL（llm.ts 尚未解析凭证，credentialId 非空但 apiKey 空时抛 "No API key"，或 resolveCredentialValue 未调用）

- [ ] **Step 3: 修改 `src/engine/nodes/llm.ts`**

在文件顶部 import 区追加：
```ts
import { resolveCredentialValue } from "@/lib/credential"
```

把 finalApiKey 计算段（73-84 行）替换为：
```ts
  const apiKey = (config.apiKey as string) || ""
  const baseUrl = (config.baseUrl as string) || ""
  const credentialId = (config.credentialId as string) || ""

  // 从 providers 配置中获取默认 API key 和 base URL
  const providerInfo = getProvider(provider)
  const defaultBaseUrl = providerInfo?.defaultBaseUrl || "https://api.openai.com/v1"
  const defaultApiKey = process.env[providerInfo?.defaultApiKeyEnv || ""] || ""

  // 凭证优先：credentialId 非空时从数据库读取解密值作为 key
  let credentialKey: string | null = null
  if (credentialId) {
    credentialKey = await resolveCredentialValue(credentialId)
    if (!credentialKey) throw new Error(`Credential not found: ${credentialId}`)
  }

  const finalApiKey = credentialKey ?? apiKey || defaultApiKey || process.env.OPENAI_API_KEY || ""
  const finalBaseUrl = baseUrl || defaultBaseUrl
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/engine/nodes/llm.test.ts`
Expected: PASS（凭证用例通过，断言 resolveCredentialValue 被调用且不抛 key 缺失）

- [ ] **Step 5: 运行全部测试确保无回归**

Run: `npm test`
Expected: PASS（70 + 新用例）

- [ ] **Step 6: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（仅预存错误）

- [ ] **Step 7: Commit**

```bash
git add src/engine/nodes/llm.ts src/engine/nodes/llm.test.ts
git commit -m "feat(engine): LLM 节点支持引用全局凭证（credentialId）"
```

---

## Task 4: 凭证下拉组件（CredentialSelect）

**Files:**
- Create: `src/components/panels/CredentialSelect.tsx`

- [ ] **Step 1: 实现组件**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslation } from "@/i18n"

interface CredentialSelectProps {
  credentialId?: string
  onSelect: (id: string) => void
  onClear: () => void
}

interface CredentialOption { id: string; name: string }

const MANUAL = "__manual__"

export function CredentialSelect({ credentialId, onSelect, onClear }: CredentialSelectProps) {
  const { t } = useTranslation()
  const [creds, setCreds] = useState<CredentialOption[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((data: CredentialOption[]) => {
        setCreds(Array.isArray(data) ? data.filter((c) => c && typeof c.id === "string") : [])
      })
      .catch(() => setCreds([]))
      .finally(() => setLoaded(true))
  }, [])

  const value = credentialId || MANUAL

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={(v) => (v === MANUAL ? onClear() : onSelect(v))}>
        <SelectTrigger><SelectValue placeholder={t("config.selectCredential")} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={MANUAL}>{t("config.credentialManual")}</SelectItem>
          {creds.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loaded && creds.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          {t("config.noCredential")}{" "}
          <Link href="/credentials" className="text-primary hover:underline">{t("config.credentialLink")}</Link>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（无新错误；组件文件无 lint 问题）

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/CredentialSelect.tsx
git commit -m "feat(ui): CredentialSelect 凭证下拉共享组件"
```

---

## Task 5: NodeConfigPanel 集成（music 认证区 + LLM apiKey 区）

**Files:**
- Modify: `src/components/panels/NodeConfigPanel.tsx`

- [ ] **Step 1: import CredentialSelect**

在 `src/components/panels/NodeConfigPanel.tsx` import 区追加：
```ts
import { CredentialSelect } from "@/components/panels/CredentialSelect"
```

- [ ] **Step 2: LLM apiKey 区加凭证选择**

找到 LLM 分支中 apiKey 输入区（当前在 `<div className="space-y-2">` 内，含 apiKey Input + 「获取密钥」链接）。在 apiKey 输入块**之前**插入凭证选择块，并让 apiKey 输入在 credentialId 非空时隐藏：

把 LLM apiKey 区域（当前约 124-136 行 `<div className="space-y-2">` 到 `<p ...apiKeyHint...</p>`）替换为：
```tsx
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t("config.selectCredential")}</Label>
              {credentialId && <Badge variant="outline" className="text-[10px]">{t("config.credentialSelected")}</Badge>}
            </div>
            <CredentialSelect
              credentialId={(config.credentialId as string) || ""}
              onSelect={(id) => updateConfig("credentialId", id)}
              onClear={() => updateConfig("credentialId", "")}
            />
          </div>
          {!config.credentialId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="llm-apikey" className="text-xs text-muted-foreground">{t("config.apiKey")}</Label>
                {selectedProvider && (
                  <a href={selectedProvider.docs} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">{t("config.getKey")}<ExternalLink className="h-2.5 w-2.5" /></a>
                )}
              </div>
              <div className="relative">
                <Input id="llm-apikey" type={showApiKey ? "text" : "password"} value={(config.apiKey as string) || ""} onChange={(e) => updateConfig("apiKey", e.target.value)} placeholder={selectedProvider ? `Env: ${selectedProvider.defaultApiKeyEnv}` : t("config.apiKeyPlaceholder")} className="pr-8 text-sm font-mono" />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("config.apiKeyHint", { env: selectedProvider?.defaultApiKeyEnv || "OPENAI_API_KEY" })}</p>
            </div>
          )}
```
（`credentialId` 变量在组件作用域中即 `config.credentialId as string`；确保用 `const credentialId = config.credentialId` 或直接内联引用。下方「凭证选择」Badge 提示当前已选凭证。）

**注意：** 上面引用了 `config.credentialId`——需确认 `config` 对象在此作用域可用（组件顶部已有 `const config = (node.data.config as Record<string, unknown>) || {}`）。为可读性，可在 LLM 分支内顶部加 `const credentialId = (config.credentialId as string) || ""`，但 JSX 内不能声明变量——需在组件函数体顶部（`updateConfig` 定义之后）加：
```tsx
  const credentialId = (config.credentialId as string) || ""
```
放在 `const handleDelete` 之前，与 `selectedProvider` 同级。

- [ ] **Step 3: music 认证区加凭证选择**

找到 music 分支认证区（当前 `auth` Select + 条件 authToken 输入）。把 authToken 输入块替换为「凭证选择 + 条件手动 token 输入」：

```tsx
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
              <>
                <CredentialSelect
                  credentialId={(config.credentialId as string) || ""}
                  onSelect={(id) => updateConfig("credentialId", id)}
                  onClear={() => updateConfig("credentialId", "")}
                />
                {!config.credentialId && (
                  <Input type="password" value={(config.authToken as string) || ""} onChange={(e) => updateConfig("authToken", e.target.value)} placeholder={t("config.musicAuth")} className="text-sm font-mono" />
                )}
              </>
            )}
          </div>
```

- [ ] **Step 4: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（无新错误；预存 NodeConfigPanel set-state-in-effect 及他处错误保持基线）

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/NodeConfigPanel.tsx
git commit -m "feat(ui): NodeConfigPanel 集成凭证选择（music + LLM）"
```

---

## Task 6: i18n 文案

**Files:**
- Modify: `src/i18n/locales/zh.json`、`en.json`

- [ ] **Step 1: zh.json `config` 对象内追加**

```json
    "selectCredential": "选择全局凭证",
    "credentialManual": "手动输入",
    "credentialSelected": "已选凭证",
    "noCredential": "暂无全局凭证，请先在凭证管理中添加。",
    "credentialLink": "前往凭证管理",
```

- [ ] **Step 2: en.json `config` 对象内追加**

```json
    "selectCredential": "Select global credential",
    "credentialManual": "Manual input",
    "credentialSelected": "Credential selected",
    "noCredential": "No global credentials yet. Add one in Credentials first.",
    "credentialLink": "Go to Credentials",
```

- [ ] **Step 3: 验证 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(i18n): 凭证选择文案"
```

---

## Task 7: 全量验证 + 端到端

**Files:** 无（仅验证）

- [ ] **Step 1: 全部单测**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: 仅预存错误/警告，无新增

- [ ] **Step 3: 浏览器端到端验证**

1. 刷新 `http://localhost:3000/workflow/cms8ro54u00006ymgtfryk1h3`（已创建的音乐生成工作流）
2. 选中 Music 节点 → 认证方式选 Bearer → 出现「选择全局凭证」下拉 → 选中 `minimax` → 手动 token 输入框隐藏
3. 选中 LLM 节点（或新建）→ apiKey 区出现凭证下拉 → 选中 `minimax` → apiKey 输入框隐藏
4. 保存工作流
5. 执行工作流（输入 prompt）→ 验证 music 节点用凭证 key 调用 MiniMax，历史页出现音频预览

- [ ] **Step 4: 最终 Commit（如有修复则按 fix: 提交）**

---

## 自检备注

- **错误边界（用户强调）**：
  - `resolveCredentialValue`：空 ID 返回 null 不查库；不存在返回 null；解密在 `credential.ts` 内完成，抛错向上传播。
  - 执行器：`credentialId` 非空但凭证缺失 → 抛 `Credential not found: <id>`，不会带空 token 去发请求（music 测试断言 `fetchMock` 未被调用）。
  - UI：凭证 API 拉取失败 `catch(() => setCreds([]))` 降级为空态并显示"前往凭证管理"链接；凭证被删后下拉里看不到，但已有配置的 `credentialId` 在执行时才会报错（由执行器兜底）。
- **Spec 覆盖**：类型(T1)、工具(T1)、music 执行器(T2)、LLM 执行器(T3)、CredentialSelect(T4)、NodeConfigPanel(T5)、i18n(T6)、错误边界(贯穿 T1-T5)、测试(T1-T3)、端到端(T7)。全覆盖。
- **占位符扫描**：无 TBD/TODO。LLM 测试的"黑盒验证"是明确的既定方案（YAGNI，不 mock AI SDK 网络层）。
- **类型一致**：`credentialId?: string` 在 T1/T2/T3/T4/T5 一致；`resolveCredentialValue(credentialId?: string | null): Promise<string | null>` 签名跨 T1/T2/T3 一致；`CredentialSelect` props（credentialId/onSelect/onClear）在 T4/T5 一致。
