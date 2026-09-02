# 模板库（Template Library）设计

> 日期：2026-08-03
> 状态：已定稿，待用户审阅

## 目标

移除工作流列表页右上角的「音乐生成模板」按钮，在左侧菜单栏新增「模板库」入口。模板库以统一注册表方式管理模板，便于以后扩展更多模板（音乐生成、视频生成等）。

## 背景

- 现有音乐生成模板通过 `GET /api/workflow/template/music` 提供（`buildMusicTemplate` 纯函数 + GET handler，位于 `src/app/api/workflow/template/music/`）。
- 工作流列表页（`src/app/(dashboard)/workflows/page.tsx`）右上角有「音乐生成模板」按钮，点击 `router.push("/workflow/new?template=music")`。
- 编辑器页（`src/app/(dashboard)/workflow/[id]/page.tsx`）在 `isNew && template === "music"` 时从单接口拉取模板初始化 store。

## 方案

### 1. 统一模板注册表（`src/lib/templates.ts`）

集中注册所有模板。每个模板定义元信息 + `build(lang)` 工厂函数（返回 nodes/edges）。

```ts
import type { Template } from "@/lib/template-types"
import { buildMusicTemplate } from "@/app/api/workflow/template/music/template"

export interface TemplateMeta {
  id: string
  name: string        // i18n key 或直接文案（见「i18n 说明」）
  description: string
  icon: string        // lucide 图标名，如 "Music"
  category: string    // 分类，如 "music" / "video"
}

export interface TemplateEntry extends TemplateMeta {
  build: (lang: string) => Template
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: "music",
    name: "music",            // 占位，实际用 i18n key
    description: "musicDesc", // 占位
    icon: "Music",
    category: "music",
    build: buildMusicTemplate,
  },
]

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function listTemplates(): TemplateMeta[] {
  return TEMPLATES.map(({ id, name, description, icon, category }) => ({ id, name, description, icon, category }))
}
```

**i18n 说明**：模板注册表不直接存中文/英文文案，而是存 i18n key。新增 key 分组 `templates.list.<id>.<name|description>`（如 `templates.list.music.name` = "音乐生成模板"）。页面渲染时用 `t(key)` 取当前语言文案。这样模板元信息天然支持 i18n。

### 2. 模板类型（`src/lib/template-types.ts`）

把现在 `src/app/api/workflow/template/music/template.ts` 中的 `TemplateNode`/`TemplateEdge`/`Template` 接口抽到共享文件，供注册表与 API 复用：

```ts
export interface TemplateNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: { type: string; label: string; config: Record<string, unknown> }
}
export interface TemplateEdge { id: string; source: string; target: string }
export interface Template { name: string; description: string; nodes: TemplateNode[]; edges: TemplateEdge[] }
```

### 3. 统一模板 API

**`GET /api/templates`**：返回所有模板元信息列表（不含节点），供模板库页面展示。

```jsonc
[
  { "id": "music", "name": "音乐生成模板", "description": "输入提示词自动生成音乐并导出", "icon": "Music", "category": "music" }
]
```
（name/description 已按请求 `Accept-Language` 或 `?lang=` 本地化，或由前端 `t(key)` 渲染——见「i18n 说明」决定。）

**`GET /api/templates/[id]`**：返回指定模板的完整 `{ name, description, nodes, edges }`，供编辑器初始化。

### 4. 模板库页面（`src/app/(dashboard)/templates/page.tsx`）

- 客户端组件，`fetch("/api/templates")` 拉取模板列表。
- 卡片网格：每张卡片显示模板图标 + 名称 + 描述 + 分类徽章 + 「使用模板」按钮。
- 点击「使用模板」→ `router.push("/workflow/new?template=<id>")`。
- 空态：无模板时显示提示。

### 5. 侧边栏入口（`src/app/(dashboard)/layout.tsx`）

在「工作流」与「执行历史」之间新增「模板库」菜单项：
```tsx
<Link href="/templates" className={cn(buttonVariants({ variant: pathname === "/templates" ? "secondary" : "ghost", size: "sm" }), "w-full justify-start")}>
  <LayoutTemplate className="h-4 w-4 mr-2" />
  {t("sidebar.templates")}
</Link>
```
lucide 图标用 `LayoutTemplate`。

### 6. 移除工作流列表页按钮（`src/app/(dashboard)/workflows/page.tsx`）

删除右上角「音乐生成模板」按钮及 `Music` 图标 import、`handleCreateFromMusicTemplate`。恢复为仅「新建工作流」按钮。

### 7. 编辑器页通用模板加载（`src/app/(dashboard)/workflow/[id]/page.tsx`）

把写死的 `if (template === "music")` 改为通用：从 `GET /api/templates/<templateId>` 拉取，初始化 store。模板 ID 校验由 API 处理（不存在返回 404）。

### 8. 原有单接口迁移

`src/app/api/workflow/template/music/` 的两个文件：
- `template.ts`（含 `buildMusicTemplate` + 类型）→ 类型移到 `template-types.ts`，`buildMusicTemplate` 移到 `src/lib/templates.ts` 内联（作为 music 模板的 build）。
- `route.ts` → 删除（被统一 `/api/templates` 取代）。

## 涉及文件

1. `src/lib/template-types.ts` — 新建：共享模板类型
2. `src/lib/templates.ts` — 新建：模板注册表
3. `src/app/api/templates/route.ts` — 新建：模板列表 API
4. `src/app/api/templates/[id]/route.ts` — 新建：单个模板 API
5. `src/app/(dashboard)/templates/page.tsx` — 新建：模板库页面
6. `src/app/(dashboard)/layout.tsx` — 侧边栏加「模板库」入口
7. `src/app/(dashboard)/workflows/page.tsx` — 移除模板按钮
8. `src/app/(dashboard)/workflow/[id]/page.tsx` — `?template=` 通用加载
9. `src/app/api/workflow/template/music/route.ts` — 删除
10. `src/app/api/workflow/template/music/template.ts` — 迁移后删除（或保留 buildMusicTemplate 供注册表引用，见「不确定项」）
11. `src/app/api/workflow/template/music/route.test.ts` — 更新（buildMusicTemplate 新位置）
12. `src/i18n/locales/zh.json` + `en.json` — `sidebar.templates`、`templates.list.*` 文案

## i18n 文案

- `sidebar.templates`：模板库 / Templates
- `templates.title`：模板库 / Templates
- `templates.description`：选择预设模板快速创建工作流 / Choose a preset template to quickly create a workflow
- `templates.useTemplate`：使用模板 / Use template
- `templates.noTemplates`：暂无可用模板 / No templates available
- `templates.list.music.name`：音乐生成模板 / Music Generation Template
- `templates.list.music.description`：输入提示词自动生成音乐并导出 / Generate music from a prompt and export it
- `templates.category.music`：音乐 / Music

## 错误处理

- `/api/templates/[id]`：模板不存在返回 404。
- 模板库页面 fetch 失败：显示空态 + 错误提示（可重试）。
- 编辑器页模板加载失败：`console.error` + 回退为空白新建工作流（保持 `isNew` 行为）。

## 测试要点

- `templates.ts` 注册表：`listTemplates()` 返回含 music 模板，`getTemplate("music")` 命中，未知 id 返回 undefined。
- `route.ts` GET 列表：返回元信息数组。
- `[id]` route：命中返回完整模板，未知 404。
- 编辑器页 `?template=` 通用加载：typecheck + 浏览器验证。

## 非目标（本次不做）

- 不做模板的数据库持久化（注册表即源码）。
- 不做模板搜索/分页。
- 不做用户自定义模板。

## 不确定项

- `buildMusicTemplate` 的位置：方案 A（移入 `src/lib/templates.ts` 内联）或方案 B（保留在 `template.ts`，注册表 import 引用）。推荐 B——保持 `buildMusicTemplate` 可独立测试，注册表只引用。采用 B。
- 模板元信息 name/description 的 i18n：方案 A（API 按 lang 返回本地化文案，前端直接显示）或方案 B（API 返回 i18n key，前端 `t(key)` 渲染）。推荐 B——与前端 i18n 体系一致，避免 API 重复语言判断。采用 B。
