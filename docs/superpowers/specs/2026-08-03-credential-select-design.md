# 节点凭证选择功能设计

> 日期：2026-08-03
> 状态：已定稿，待用户审阅

## 目标

用户在「凭证管理」中添加的全局凭证（AES-256 加密存 DB）应能被 music 节点和 LLM 节点直接引用。节点配置面板提供「选择凭证」下拉，选中后执行时从数据库解密读取凭证值作为认证凭据，无需手动填 key 或改 .env。

## 背景与现状

- 凭证系统：`prisma.credential` 表，`value` 字段经 `src/lib/crypto.ts` 的 `encrypt()`/`decrypt()` AES-256 加密。`GET /api/credentials` 返回列表（不含值），`GET /api/credentials/[id]` 解密返回明文值。
- LLM 节点（`src/engine/nodes/llm.ts:73-81`）：`config.apiKey` 优先，否则回退 `process.env[provider.defaultApiKeyEnv]`。无法引用数据库凭证。
- music 节点（`src/engine/nodes/music.ts`）：`config.authToken` 明文或 `{{ $env.X }}`。无法引用数据库凭证。
- `resolveExpression`（`src/lib/expression.ts`）是同步函数，不支持异步读 DB，因此不扩展表达式语法，改由执行器内部解析。

## 方案

在 `MusicNodeConfig` 与 `LLMNodeConfig` 各加一个可选字段 `credentialId`。NodeConfigPanel 的认证/API Key 区域增加「选择凭证」下拉（列出全局凭证）。选中凭证后隐藏手动 key/token 输入框；下拉含「手动输入」选项可切回。

执行器解析顺序（二选一强制）：
1. `credentialId` 存在 → 从 DB 查该凭证、`decrypt()` 取值，用作 authToken/apiKey。凭证不存在或解密失败 → 抛错。
2. `credentialId` 为空 → 走现有逻辑（手动 key → env 回退）。

现有已填 key 的配置不受影响：老配置没有 `credentialId` 字段，`credentialId` 为空 → 走手动 key 分支。

## 详细设计

### 1. 类型扩展（`src/types/workflow.ts`）

`LLMNodeConfig` 追加：
```ts
credentialId?: string
```

`MusicNodeConfig` 追加：
```ts
credentialId?: string
```

### 2. 凭证读取工具（新文件 `src/lib/credential.ts`）

提供服务端读取凭证值的纯函数，供执行器复用：

```ts
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

/** 按凭证 ID 读取解密后的值；不存在返回 null */
export async function resolveCredentialValue(credentialId?: string | null): Promise<string | null> {
  if (!credentialId) return null
  const cred = await prisma.credential.findUnique({ where: { id: credentialId } })
  if (!cred) return null
  return decrypt(cred.value)
}
```

职责单一、可独立测试。执行器通过它取值；取到 null（凭证被删）时执行器抛清晰错误。

### 3. music 执行器（`src/engine/nodes/music.ts`）

在认证头注入逻辑（当前第 35-36 行附近）之前，解析凭证：

```ts
const credentialId = (config.credentialId as string) || ""
const credentialToken = credentialId ? await resolveCredentialValue(credentialId) : null
if (credentialId && !credentialToken) throw new Error(`Credential not found: ${credentialId}`)

const authToken = credentialToken ?? ((config.authToken as string) || "")
if (auth === "bearer" && authToken) headers["Authorization"] = `Bearer ${resolveExpression(authToken, context)}`
else if (auth === "api_key" && authToken) headers["X-API-Key"] = resolveExpression(authToken, context)
```

- 凭证值直接作为 token，不再走 `resolveExpression`（凭证是明文 key，不是模板）。
- `auth` 仍由用户选择（none/bearer/api_key）；凭证只提供 token 值。

### 4. LLM 执行器（`src/engine/nodes/llm.ts`）

在 `finalApiKey` 计算（第 80-81 行）前插入凭证解析：

```ts
const credentialId = (config.credentialId as string) || ""
const credentialKey = credentialId ? await resolveCredentialValue(credentialId) : null
if (credentialId && !credentialKey) throw new Error(`Credential not found: ${credentialId}`)

const apiKey = (config.apiKey as string) || ""
const defaultApiKey = process.env[providerInfo?.defaultApiKeyEnv || ""] || ""
const finalApiKey = credentialKey ?? apiKey || defaultApiKey || process.env.OPENAI_API_KEY || ""
```

- 凭证优先；凭证未选时保留现有 apiKey→env 回退链。

### 5. NodeConfigPanel 凭证下拉（`src/components/panels/NodeConfigPanel.tsx`）

**新增共享组件** `src/components/panels/CredentialSelect.tsx`：

```tsx
"use client"

interface CredentialSelectProps {
  credentialId?: string
  onSelect: (id: string) => void
  onClear: () => void
}
```

- 挂载时 `fetch("/api/credentials")` 拉取列表，`filter(c => c.scope === "global")`。
- Select 选项：`__manual__`（手动输入）+ 各凭证（按 name 显示）。
- 选中 `__manual__` → `onClear()`；选中凭证 → `onSelect(cred.id)`。
- 空态提示「未配置全局凭证」并给出去凭证管理页的链接（`Link href="/credentials"`）。

**music 认证区**（当前 `auth` Select + authToken 输入附近）：
- 在 `auth !== "none"` 时显示凭证下拉 + 手动 token 输入框二选一：
  - `credentialId` 非空 → 隐藏 token 输入框，显示「已使用凭证 <name>」
  - `credentialId` 空 → 显示 token 输入框 + 凭证下拉（含「手动输入」选项）

**LLM apiKey 区**（当前 apiKey 输入框附近）：
- 同样逻辑：`credentialId` 非空 → 隐藏 apiKey 输入框与「获取密钥」链接，显示凭证摘要；为空 → 显示原 apiKey 输入框 + 凭证下拉。

### 6. i18n 文案（`zh.json` / `en.json`）

新增（`config.` 分组下）：
- `config.selectCredential`：选择凭证 / Select credential
- `config.credentialManual`：手动输入 / Manual input
- `config.credentialSelected`：已使用凭证 / Using credential
- `config.noCredential`：未配置全局凭证，请先到凭证管理添加 / No global credentials. Add one in Credentials first
- `config.credentialLink`：前往凭证管理 / Go to Credentials

### 7. 错误处理

- 凭证被删除或 ID 无效：执行器抛 `Credential not found: <id>`，由 executor 现有重试机制处理（若配置了 maxRetries）。
- 解密失败（ENCRYPTION_KEY 变更）：`decrypt` 抛错，向上传播。

## 涉及文件

1. `src/types/workflow.ts` — `LLMNodeConfig.credentialId?`、`MusicNodeConfig.credentialId?`
2. `src/lib/credential.ts` — 新建凭证读取工具
3. `src/engine/nodes/music.ts` — 凭证解析
4. `src/engine/nodes/llm.ts` — 凭证解析
5. `src/components/panels/CredentialSelect.tsx` — 新建凭证下拉组件
6. `src/components/panels/NodeConfigPanel.tsx` — music 认证区 + LLM apiKey 区集成
7. `src/i18n/locales/zh.json` + `en.json` — 新文案

## 测试要点

- `src/lib/credential.test.ts`：mock prisma，验证按 ID 读取解密值、空 ID 返回 null、不存在返回 null。
- music 执行器测试：mock `resolveCredentialValue`，验证 credentialId 存在时用凭证值作为 bearer token、凭证缺失抛错、credentialId 空时走原 authToken 逻辑。
- LLM 执行器测试：mock 凭证，验证 credentialKey 优先于 apiKey。

## 非目标（本次不做）

- 不扩展 `resolveExpression` 表达式语法（同步函数无法异步读 DB）。
- 不做 workflow/node 作用域过滤（只列全局凭证）。
- 不给 http/feishu 等其他节点加凭证选择。
- 凭证值不回填到工作流配置（不存快照，保持安全）。

## 不确定项

- 无。
