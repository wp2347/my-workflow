# 模板库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除工作流列表页右上角「音乐生成模板」按钮，新增左侧菜单「模板库」，通过统一模板注册表展示模板卡片，点击后初始化工作流编辑器。

**Architecture:** 新建 `src/lib/templates.ts` 统一注册表（引用现有 `buildMusicTemplate`），元信息存 i18n key。新建 `GET /api/templates`（列表）和 `GET /api/templates/[id]`（单个完整模板）。新建 `/templates` 页面展示卡片。侧边栏加「模板库」入口。工作流列表页移除模板按钮。编辑器页 `?template=<id>` 从统一 API 拉取。

**Tech Stack:** Next.js · React · Prisma · Vitest · lucide-react · i18n

**测试策略：** 注册表与模板 API 用 TDD 单测；UI 页面遵循仓库模式（typecheck + lint + 浏览器验证）。

---

## 文件结构

**新建：**
- `src/lib/templates.ts` — 模板注册表 + `listTemplates()`/`getTemplate()`
- `src/lib/templates.test.ts` — 注册表单测
- `src/app/api/templates/route.ts` — 模板列表 API
- `src/app/api/templates/[id]/route.ts` — 单个模板 API
- `src/app/(dashboard)/templates/page.tsx` — 模板库页面

**修改：**
- `src/app/api/workflow/template/music/template.ts` — 类型移到 `src/lib/templates.ts` 顶部（或保留在此由注册表 import，见 Task 1 决定），`buildMusicTemplate` 保留
- `src/app/api/workflow/template/music/route.ts` — 删除
- `src/app/api/workflow/template/music/route.test.ts` — 更新 import 路径
- `src/app/(dashboard)/layout.tsx` — 侧边栏加「模板库」
- `src/app/(dashboard)/workflows/page.tsx` — 移除模板按钮
- `src/app/(dashboard)/workflow/[id]/page.tsx` — `?template=` 通用加载
- `src/i18n/locales/zh.json` + `en.json` — 新文案

---

## Task 1: 模板注册表（TDD）

**Files:**
- Create: `src/lib/templates.ts`
- Test: `src/lib/templates.test.ts`
- Modify: `src/app/api/workflow/template/music/template.ts`（export 类型，供注册表引用）

- [ ] **Step 1: 让 template.ts 导出其接口类型**

`src/app/api/workflow/template/music/template.ts` 已导出 `TemplateNode`/`TemplateEdge`/`Template`（第 1-8 行）与 `buildMusicTemplate`（第 23 行）。无需改动，注册表直接 import。

- [ ] **Step 2: 写失败测试 `src/lib/templates.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { TEMPLATES, listTemplates, getTemplate } from "@/lib/templates"

describe("templates registry", () => {
  it("listTemplates 返回模板元信息列表（含 music）", () => {
    const list = listTemplates()
    expect(list.length).toBeGreaterThan(0)
    const music = list.find((t) => t.id === "music")
    expect(music).toBeDefined()
    expect(music?.icon).toBe("Music")
    expect(music?.category).toBe("music")
  })

  it("getTemplate 命中已有模板", () => {
    const tpl = getTemplate("music")
    expect(tpl).toBeDefined()
    expect(tpl?.id).toBe("music")
  })

  it("getTemplate 未知 id 返回 undefined", () => {
    expect(getTemplate("nonexistent")).toBeUndefined()
  })

  it("music 模板 build 返回 3 节点 2 边", () => {
    const tpl = getTemplate("music")
    const built = tpl!.build("zh")
    expect(built.nodes).toHaveLength(3)
    expect(built.edges).toHaveLength(2)
    expect(built.nodes[1].data.type).toBe("music")
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — `@/lib/templates` 模块不存在

- [ ] **Step 4: 实现 `src/lib/templates.ts`**

```ts
import { buildMusicTemplate, type Template } from "@/app/api/workflow/template/music/template"

export interface TemplateMeta {
  id: string
  nameKey: string      // i18n key，如 "templates.list.music.name"
  descriptionKey: string
  icon: string         // lucide 图标名
  category: string
}

export interface TemplateEntry extends TemplateMeta {
  build: (lang: string) => Template
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: "music",
    nameKey: "templates.list.music.name",
    descriptionKey: "templates.list.music.description",
    icon: "Music",
    category: "music",
    build: buildMusicTemplate,
  },
]

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function listTemplates(): TemplateMeta[] {
  return TEMPLATES.map(({ id, nameKey, descriptionKey, icon, category }) => ({ id, nameKey, descriptionKey, icon, category }))
}
```

注意：`Template` 类型从 template.ts re-export 使用（`import { buildMusicTemplate, type Template }`）。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS（4 用例）

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: PASS（仅预存 McpEditor/PromptEditor 错误）

- [ ] **Step 7: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m "feat(templates): 统一模板注册表（listTemplates/getTemplate）"
```

---

## Task 2: 统一模板 API

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[id]/route.ts`
- Modify: `src/app/api/workflow/template/music/route.test.ts`（import 路径更新，因旧 route.ts 将删）

- [ ] **Step 1: 实现 `src/app/api/templates/route.ts`（列表）**

```ts
import { NextResponse } from "next/server"
import { listTemplates } from "@/lib/templates"

export async function GET() {
  return NextResponse.json(listTemplates())
}
```

- [ ] **Step 2: 实现 `src/app/api/templates/[id]/route.ts`（单个）**

```ts
import { NextRequest, NextResponse } from "next/server"
import { getTemplate } from "@/lib/templates"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const tpl = getTemplate(id)
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  const lang = "zh"
  const built = tpl.build(lang)
  return NextResponse.json({ id: tpl.id, ...built })
}
```

注意：`build` 的 `lang` 参数——由于模板节点 label 需要本地化，而注册表 build 接受 lang。此 API 简化用 `lang` 从 query 读取：`const lang = _req.nextUrl.searchParams.get("lang") || "zh"`。采用这个（替换上面写死的 `"zh"`）。

- [ ] **Step 3: 更新旧测试 import 路径**

`src/app/api/workflow/template/music/route.test.ts` 当前 `import { buildMusicTemplate } from "@/app/api/workflow/template/music/route"`。因为 Task 3 将删除旧 `route.ts`，此测试改为从 `template.ts` import：

把 import 行改为：
```ts
import { buildMusicTemplate } from "@/app/api/workflow/template/music/template"
```
（若 Task 3 删除旧 route.ts 前先做此改动，则旧 route.test.ts 继续可用。）

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/templates/route.ts src/app/api/templates/[id]/route.ts src/app/api/workflow/template/music/route.test.ts
git commit -m "feat(api): 统一模板 API（列表 + 单个）"
```

---

## Task 3: 删除旧模板单接口 + 更新测试

**Files:**
- Delete: `src/app/api/workflow/template/music/route.ts`
- Modify: `src/app/api/workflow/template/music/route.test.ts`（若 Task 2 未改）

- [ ] **Step 1: 确认旧测试已指向 template.ts**

Task 2 Step 3 已把 `route.test.ts` 的 import 改为 `template.ts`。验证：
Run: `npx vitest run src/app/api/workflow/template/music/route.test.ts`
Expected: PASS（import 已改）

- [ ] **Step 2: 删除旧 route.ts**

```bash
git rm src/app/api/workflow/template/music/route.ts
```

- [ ] **Step 3: 运行测试确认无回归**

Run: `npm test`
Expected: PASS（80 个测试）

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: PASS（仅预存错误）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(api): 删除旧 music 模板单接口，迁移到统一模板 API"
```

---

## Task 4: i18n 文案

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: zh.json 追加（`sidebar` 加 `templates`，顶层加 `templates` 对象）**

`sidebar` 对象内 `"extensions"` 之后（或任意不破坏逗号的位置）追加：
```json
    "templates": "模板库",
```

顶层（与 `canvas`/`config` 同级）新增 `templates` 对象：
```json
  "templates": {
    "title": "模板库",
    "description": "选择预设模板快速创建工作流",
    "useTemplate": "使用模板",
    "noTemplates": "暂无可用模板",
    "category": {
      "music": "音乐"
    },
    "list": {
      "music": {
        "name": "音乐生成模板",
        "description": "输入提示词自动生成音乐并导出"
      }
    }
  }
```

注意：已有顶层 `templates` 对象（含 `templates.music.*`，是 Task 2 早前遗留的未使用 key）。新 `templates` 对象需**合并**而非冲突——`templates.music`（旧，name/description/labelInput/labelMusic/labelOutput）与 `templates.list.music`（新）路径不同，不冲突。但为避免混乱，若旧 `templates.music.*` 已无引用（之前审计确认是 dead key），可保留不删（YAGNI，避免动多余文件）。

- [ ] **Step 2: en.json 追加**

`sidebar` 内：
```json
    "templates": "Templates",
```
顶层 `templates` 对象：
```json
  "templates": {
    "title": "Templates",
    "description": "Choose a preset template to quickly create a workflow",
    "useTemplate": "Use template",
    "noTemplates": "No templates available",
    "category": {
      "music": "Music"
    },
    "list": {
      "music": {
        "name": "Music Generation Template",
        "description": "Generate music from a prompt and export it"
      }
    }
  }
```

- [ ] **Step 3: 验证 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(i18n): 模板库文案"
```

---

## Task 5: 模板库页面

**Files:**
- Create: `src/app/(dashboard)/templates/page.tsx`

- [ ] **Step 1: 实现页面**

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LayoutTemplate, Loader2, Music, ArrowRight } from "lucide-react"
import { useTranslation } from "@/i18n"

interface TemplateItem {
  id: string
  nameKey: string
  descriptionKey: string
  icon: string
  category: string
}

const iconMap: Record<string, React.ReactNode> = {
  Music: <Music className="h-6 w-6" />,
}

export default function TemplatesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(() => {
    setLoading(true)
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutTemplate className="h-6 w-6" />{t("templates.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("templates.description")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <LayoutTemplate className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{t("templates.noTemplates")}</h3>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="group hover:border-primary transition-colors">
              <CardHeader className="py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary flex-shrink-0">{iconMap[tpl.icon] || <LayoutTemplate className="h-6 w-6" />}</div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm">{t(tpl.nameKey)}</CardTitle>
                    <CardDescription className="text-xs mt-1">{t(tpl.descriptionKey)}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant="outline" className="text-[10px]">{t(`templates.category.${tpl.category}`)}</Badge>
                  <Button size="sm" onClick={() => router.push(`/workflow/new?template=${tpl.id}`)}>
                    {t("templates.useTemplate")}<ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（无新错误）

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/templates/page.tsx"
git commit -m "feat(ui): 模板库页面（卡片网格 + 使用模板）"
```

---

## Task 6: 侧边栏入口 + 移除工作流列表页按钮

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/workflows/page.tsx`

- [ ] **Step 1: layout.tsx 加「模板库」菜单项**

在 `src/app/(dashboard)/layout.tsx` 的 import（第 10 行）加 `LayoutTemplate`：
```tsx
import { Workflow, Plus, Home, Activity, Shield, Database, Package, LayoutTemplate } from "lucide-react"
```

在「工作流」Link（第 45-57 行）之后、「执行历史」Link 之前插入：
```tsx
          <Link
            href="/templates"
            className={cn(
              buttonVariants({ variant: pathname === "/templates" ? "secondary" : "ghost", size: "sm" }),
              "w-full justify-start",
            )}
          >
            <LayoutTemplate className="h-4 w-4 mr-2" />
            {t("sidebar.templates")}
          </Link>
```

- [ ] **Step 2: workflows/page.tsx 移除模板按钮**

`src/app/(dashboard)/workflows/page.tsx`：
- 移除 `Music` 从 lucide import（第 13 行 `Workflow, Plus, ArrowRight, Loader2, Trash2, Music` → 去掉 Music）
- 移除 `handleCreateFromMusicTemplate` 函数（当前只 `router.push("/workflow/new?template=music")`）
- 移除模板按钮 JSX（「音乐生成模板」Button），恢复为仅「新建工作流」Link 包裹：
```tsx
        <Link href="/workflow/new">
          <Button><Plus className="h-4 w-4 mr-2" />{t("workflows.newWorkflow")}</Button>
        </Link>
```
- 移除不再使用的 `useRouter` import（若仅模板按钮用它）
- 移除不再使用的 `createTemplate`/`creatingTemplate` state（若有）

- [ ] **Step 3: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（无新错误；预存错误保持基线）

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/workflows/page.tsx"
git commit -m "feat(ui): 侧边栏加模板库入口，移除工作流列表页模板按钮"
```

---

## Task 7: 编辑器页通用模板加载

**Files:**
- Modify: `src/app/(dashboard)/workflow/[id]/page.tsx`（第 24-57 行）

- [ ] **Step 1: 把写死的 template === "music" 改为通用**

把 `src/app/(dashboard)/workflow/[id]/page.tsx` 第 24-57 行的 `isNew` 分支改为：

```tsx
  useEffect(() => {
    if (isNew) {
      const searchParams = new URLSearchParams(window.location.search)
      const templateId = searchParams.get("template")

      if (templateId) {
        const lang = localStorage.getItem("workflow-locale") || "zh"
        fetch(`/api/templates/${templateId}?lang=${lang}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`template ${templateId} not found`))))
          .then((tpl) => {
            setWorkflow(
              { id: "", name: tpl.name, description: tpl.description, config: {}, createdAt: "", updatedAt: "" },
              tpl.nodes.map((n: {
                id: string
                type: string
                position: { x: number; y: number }
                data: Record<string, unknown>
              }) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
              tpl.edges.map((e: { id: string; source: string; target: string }) => ({ id: e.id, source: e.source, target: e.target })),
            )
            setWorkflowId(null)
          })
          .catch(console.error)
          .finally(() => setLoading(false))
      } else {
        // Reset store for new workflow
        setWorkflow(
          { id: "", name: "未命名工作流", description: "", config: {}, createdAt: "", updatedAt: "" },
          [], [],
        )
        setWorkflowId(null)
        setLoading(false)
      }
      return
    }
```

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（无新错误）

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/workflow/[id]/page.tsx"
git commit -m "feat(ui): 编辑器页 ?template= 通用模板加载"
```

---

## Task 8: 全量验证 + 端到端

**Files:** 无（仅验证）

- [ ] **Step 1: 全部单测**

Run: `npm test`
Expected: PASS（80 个测试）

- [ ] **Step 2: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: 仅预存错误/警告，无新增

- [ ] **Step 3: 浏览器验证**

1. 侧边栏出现「模板库」入口（lucide LayoutTemplate 图标），点击 → `/templates` 页
2. 模板库页面显示「音乐生成模板」卡片（图标 + 名称 + 描述 + 「音乐」分类徽章 + 「使用模板」按钮）
3. 点击「使用模板」→ 跳转 `/workflow/new?template=music`，画布显示 input→music→output 三节点
4. 工作流列表页（/workflows）右上角**不再有**「音乐生成模板」按钮
5. 切换英文 → 模板库显示 "Music Generation Template" / "Use template"
6. 直接访问 `/workflow/new?template=unknown` → 空白新建工作流（不崩溃）
7. 直接访问 `/api/templates/nonexistent` → 404

- [ ] **Step 4: 最终 Commit（如有修复则按 fix: 提交）**

---

## 自检备注

- Spec 覆盖：注册表(T1)、统一 API(T2)、删旧接口(T3)、i18n(T4)、模板库页面(T5)、侧边栏+移除按钮(T6)、编辑器通用加载(T7)、验证(T8)。全覆盖。
- 占位符扫描：无 TBD/TODO。
- 类型一致：`TemplateEntry`/`TemplateMeta` 字段（id/nameKey/descriptionKey/icon/category/build）在 T1 定义、T2/T5 使用一致；`listTemplates`/`getTemplate` 签名跨 T1/T2/T5 一致；i18n key `templates.list.music.*`/`sidebar.templates`/`templates.category.music` 在 T4 定义、T5 引用一致。
