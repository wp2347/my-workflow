# 全站 UI 优化（柔和智能 · 雾紫）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全站从纯灰度主题升级为「雾紫智能（Soft Violet）」风格：低饱和雾紫主色、柔和阴影、更大圆角、深浅双主题，并统一画布节点/连线/下拉/按钮等全部 UI。

**Architecture:** 以 CSS 设计令牌（design tokens）为核心驱动 —— 在 `globals.css` 定义浅/深两套颜色变量 + 节点色调令牌 + 柔和阴影工具类，颜色通过 `@theme inline` 映射为 Tailwind 类；再逐层改造共享 UI 组件（select/dropdown 项间距、badge 状态变体、dialog 圆角阴影），最后用共享 nodeStyles 帮助函数统一 9 个画布节点组件并清理页面级硬编码颜色。纯样式改动，不改任何业务逻辑。

**Tech Stack:** Next.js 16、Tailwind CSS v4、Base UI（shadcn 风格封装）、React Flow（@xyflow/react）、lucide-react。

**验证命令（每个任务通用）：**
```bash
npm run typecheck   # 期望：无错误
npm run lint        # 期望：无错误
npm run build       # 期望：构建成功
```

**说明：** 本计划全部为 CSS 类 / 样式改动，无新的可测业务逻辑，因此不使用单元测试（TDD 不适用于纯样式任务）；验证手段为 typecheck + lint + build + 浏览器人工目检（`npm run dev:webpack` 后访问各页面）。每个任务都必须跑上面的验证命令。

---

### Task 1: 设计令牌 —— globals.css 浅色/深色主题

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 更新浅色主题（`:root`）与深色主题（`.dark`）的颜色变量**

将 `:root` 块中的变量值整体替换为雾紫浅色板：

```css
:root {
  --background: #faf9fb;
  --foreground: #21192f;
  --card: #ffffff;
  --card-foreground: #21192f;
  --popover: #ffffff;
  --popover-foreground: #21192f;
  --primary: #6d5bd0;
  --primary-foreground: #ffffff;
  --secondary: #f0edf8;
  --secondary-foreground: #21192f;
  --muted: #f3f0f9;
  --muted-foreground: #6f6781;
  --accent: #f0edf8;
  --accent-foreground: #21192f;
  --destructive: #c2414c;
  --border: #e7e3f0;
  --input: #d9d3e8;
  --ring: #b3a6e8;
  --chart-1: #6d5bd0;
  --chart-2: #4f946e;
  --chart-3: #b07a2d;
  --chart-4: #3b74d0;
  --chart-5: #c2557e;
  --radius: 0.75rem;
  --sidebar: #fdfcfe;
  --sidebar-foreground: #21192f;
  --sidebar-primary: #6d5bd0;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f0edf8;
  --sidebar-accent-foreground: #21192f;
  --sidebar-border: #e7e3f0;
  --sidebar-ring: #b3a6e8;
  /* 状态色（低饱和） */
  --success: #4f946e;
  --warning: #b07a2d;
  --info: #3b74d0;
  /* 节点色调 */
  --node-input: #3b74d0;
  --node-input-bg: #eaf1fd;
  --node-llm: #6d5bd0;
  --node-llm-bg: #f1edfb;
  --node-output: #4f946e;
  --node-output-bg: #ecf7f1;
  --node-feishu: #2f9eb2;
  --node-feishu-bg: #e6f5f8;
  --node-http: #64748b;
  --node-http-bg: #eef1f5;
  --node-condition: #b07a2d;
  --node-condition-bg: #fbf3e4;
  --node-merge: #7c5aa8;
  --node-merge-bg: #f3edf9;
  --node-cron: #2e9d8b;
  --node-cron-bg: #e6f5f2;
  --node-music: #c2557e;
  --node-music-bg: #fbeef4;
  /* 画布 */
  --canvas-dot: #c4bedd;
  --canvas-edge: #b3a6e8;
  /* 阴影 */
  --shadow-soft: 0 1px 2px rgb(31 27 41 / 4%);
  --shadow-float: 0 8px 28px rgb(31 27 41 / 12%), 0 2px 8px rgb(31 27 41 / 6%);
}
```

将 `.dark` 块替换为：

```css
.dark {
  --background: #16131d;
  --foreground: #e9e6f2;
  --card: #1e1a28;
  --card-foreground: #e9e6f2;
  --popover: #221d30;
  --popover-foreground: #e9e6f2;
  --primary: #a99de8;
  --primary-foreground: #1a1425;
  --secondary: #2a2436;
  --secondary-foreground: #e9e6f2;
  --muted: #282232;
  --muted-foreground: #9b94a8;
  --accent: #2a2436;
  --accent-foreground: #e9e6f2;
  --destructive: #e58a92;
  --border: rgb(255 255 255 / 8%);
  --input: rgb(255 255 255 / 12%);
  --ring: rgb(169 157 232 / 40%);
  --chart-1: #a99de8;
  --chart-2: #7cbb97;
  --chart-3: #d0a25e;
  --chart-4: #7aa5e8;
  --chart-5: #d486a6;
  --sidebar: #1e1a28;
  --sidebar-foreground: #e9e6f2;
  --sidebar-primary: #a99de8;
  --sidebar-primary-foreground: #1a1425;
  --sidebar-accent: #2a2436;
  --sidebar-accent-foreground: #e9e6f2;
  --sidebar-border: rgb(255 255 255 / 8%);
  --sidebar-ring: rgb(169 157 232 / 40%);
  --success: #7cbb97;
  --warning: #d0a25e;
  --info: #7aa5e8;
  --node-input: #7aa5e8;
  --node-input-bg: rgb(58 87 140 / 25%);
  --node-llm: #a99de8;
  --node-llm-bg: rgb(93 74 190 / 25%);
  --node-output: #7cbb97;
  --node-output-bg: rgb(66 138 96 / 25%);
  --node-feishu: #6cc3d4;
  --node-feishu-bg: rgb(45 130 145 / 25%);
  --node-http: #93a0b6;
  --node-http-bg: rgb(90 103 130 / 25%);
  --node-condition: #d0a25e;
  --node-condition-bg: rgb(150 110 45 / 25%);
  --node-merge: #9f7ec9;
  --node-merge-bg: rgb(106 76 150 / 25%);
  --node-cron: #5fbfab;
  --node-cron-bg: rgb(46 145 128 / 25%);
  --node-music: #d486a6;
  --node-music-bg: rgb(150 70 105 / 25%);
  --canvas-dot: rgb(196 190 221 / 18%);
  --canvas-edge: #8f81d9;
  --shadow-soft: 0 1px 2px rgb(0 0 0 / 30%);
  --shadow-float: 0 8px 28px rgb(0 0 0 / 40%), 0 2px 8px rgb(0 0 0 / 25%);
}
```

- [ ] **Step 2: 在 `@theme inline` 中为新颜色/节点色/阴影添加 Tailwind 映射**

在 `@theme inline { ... }` 块内（`--color-ring` 那行附近）追加：

```css
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-node-input: var(--node-input);
  --color-node-input-bg: var(--node-input-bg);
  --color-node-llm: var(--node-llm);
  --color-node-llm-bg: var(--node-llm-bg);
  --color-node-output: var(--node-output);
  --color-node-output-bg: var(--node-output-bg);
  --color-node-feishu: var(--node-feishu);
  --color-node-feishu-bg: var(--node-feishu-bg);
  --color-node-http: var(--node-http);
  --color-node-http-bg: var(--node-http-bg);
  --color-node-condition: var(--node-condition);
  --color-node-condition-bg: var(--node-condition-bg);
  --color-node-merge: var(--node-merge);
  --color-node-merge-bg: var(--node-merge-bg);
  --color-node-cron: var(--node-cron);
  --color-node-cron-bg: var(--node-cron-bg);
  --color-node-music: var(--node-music);
  --color-node-music-bg: var(--node-music-bg);
  --color-canvas-dot: var(--canvas-dot);
  --color-canvas-edge: var(--canvas-edge);
```

- [ ] **Step 3: 添加柔和阴影工具类（Tailwind v4 `@utility`）**

在 `@layer base { ... }` 块之后追加：

```css
@utility shadow-soft {
  box-shadow: var(--shadow-soft);
}

@utility shadow-float {
  box-shadow: var(--shadow-float);
}
```

- [ ] **Step 4: 添加 React Flow 主题覆盖（画布背景/小地图/控件/连线）**

在文件末尾追加：

```css
.react-flow__background {
  background-color: var(--background);
}
.react-flow__background pattern circle {
  fill: var(--canvas-dot);
}
.react-flow__edge-path {
  stroke: var(--canvas-edge);
  stroke-width: 2;
}
.react-flow__controls {
  box-shadow: var(--shadow-soft);
  border-radius: 10px;
  overflow: hidden;
  background: var(--popover);
}
.react-flow__controls-button {
  background: var(--popover);
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
}
.react-flow__controls-button:hover {
  background: var(--muted);
}
.react-flow__minimap {
  background-color: var(--popover);
  border-radius: 10px;
  box-shadow: var(--shadow-soft);
}
.react-flow__minimap-mask {
  fill: rgb(0 0 0 / 20%);
}
.react-flow__node.selected {
  box-shadow: 0 0 0 3px var(--ring);
}
```

- [ ] **Step 5: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "style(theme): 雾紫智能主题令牌（浅/深双主题 + 节点色 + 阴影工具类）"
```

---

### Task 2: 按钮组件 —— 默认态内高光与柔和阴影

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: 更新 default 与 secondary variant 的样式**

将 `buttonVariants` 中 `variant` 的 `default` 与 `secondary` 改为：

```ts
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 [a]:hover:bg-primary/90",
        outline:
          "border-border bg-background shadow-soft hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。浏览器目检 `/workflows` 与首页主按钮为雾紫实心带轻阴影、hover 略微加深。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "style(button): 主按钮雾紫实心 + 柔和阴影 + hover 加深"
```

---

### Task 3: Select 下拉 —— 选项间距 + 弹层圆角阴影

**Files:**
- Modify: `src/components/ui/select.tsx`

- [ ] **Step 1: 给选项加间距（用户反馈点）**

将 `SelectItem` 的 className 中 `py-1` 改为 `my-0.5 py-1`：

原：`"relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none ..."`
新：`"relative flex w-full cursor-default items-center gap-1.5 rounded-md my-0.5 last:my-0 py-1 pr-8 pl-1.5 text-sm outline-hidden select-none ..."`

（仅改 `py-1` → `my-0.5 last:my-0 py-1`，其余不变。）

- [ ] **Step 2: 分组标签留白**

将 `SelectLabel` 的 className 改为：

```ts
className={cn("px-1.5 pt-2 pb-1 text-xs text-muted-foreground", className)}
```

- [ ] **Step 3: 弹层圆角与阴影**

将 `SelectContent` 弹层 className 中的 `rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10` 改为：

```ts
"relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl bg-popover text-popover-foreground shadow-float ring-1 ring-foreground/10 duration-100 ..."
```

（即 `rounded-lg` → `rounded-xl`、`shadow-md` → `shadow-float`，其余动画类保持。）

- [ ] **Step 4: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。浏览器目检 `工作流编辑器` 任意下拉，选项间有 2px 间距、分组标签上下留白、弹层圆角更大阴影柔和。

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "style(select): 选项间距 + 分组留白 + 弹层圆角柔和阴影"
```

---

### Task 4: DropdownMenu —— 项间距 + 弹层阴影

**Files:**
- Modify: `src/components/ui/dropdown-menu.tsx`

- [ ] **Step 1: 给四个 Item 类加间距**

以下四处的 className 中 `py-1` 改为 `my-0.5 last:my-0 py-1`：

1. `DropdownMenuItem`：`"group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm ..."`
2. `DropdownMenuSubTrigger`：`"flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm ..."`
3. `DropdownMenuCheckboxItem`：`"relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm ..."`
4. `DropdownMenuRadioItem`：`"relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm ..."`

- [ ] **Step 2: 弹层圆角与阴影**

`DropdownMenuContent` 弹层 className 中 `rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10` 改为 `rounded-xl bg-popover p-1 text-popover-foreground shadow-float ring-1 ring-foreground/10`（`rounded-lg`→`rounded-xl`、`shadow-md`→`shadow-float`）。`DropdownMenuSubContent` 同理将 `shadow-lg` → `shadow-float`。

- [ ] **Step 3: 分组标签留白**

`DropdownMenuLabel` className 中 `px-1.5 py-1` 改为 `px-1.5 pt-2 pb-1`。

- [ ] **Step 4: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。目检扩展页/凭证页等的下拉菜单项间距合理。

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "style(dropdown): 项间距 + 弹层圆角阴影"
```

---

### Task 5: Badge —— 新增 success / warning / info 状态变体

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: 新增三个低饱和状态变体**

在 `badgeVariants` 的 `variant` 对象中 `outline` 之前新增：

```ts
        success: "bg-success/10 text-success [a]:hover:bg-success/20",
        warning: "bg-warning/10 text-warning [a]:hover:bg-warning/20",
        info: "bg-info/10 text-info [a]:hover:bg-info/20",
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "style(badge): 新增 success/warning/info 低饱和状态变体"
```

---

### Task 6: Dialog —— 圆角与阴影

**Files:**
- Modify: `src/components/ui/dialog.tsx`

- [ ] **Step 1: 内容弹层圆角 + 柔和浮层阴影 + 遮罩加深**

`DialogOverlay` className 中 `bg-black/10` 改为 `bg-black/20 backdrop-blur-xs`。
`DialogContent` className 中 `rounded-xl bg-popover p-4 ... ring-1 ring-foreground/10` 改为 `rounded-2xl bg-popover p-4 ... ring-1 ring-foreground/10 shadow-float`（`rounded-xl`→`rounded-2xl`，追加 `shadow-float`）。

- [ ] **Step 2: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。目检删除工作流弹窗更圆润、阴影更柔和。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "style(dialog): 圆角 2xl + 柔和浮层阴影 + 遮罩加深"
```

---

### Task 7: 共享节点样式帮助函数

**Files:**
- Create: `src/components/nodes/nodeStyles.ts`

- [ ] **Step 1: 创建 nodeStyles.ts**

```ts
import { type NodeType } from "@/types/workflow"

// 注意：类名必须完整字面量出现在源文件中，Tailwind 扫描器才能生成对应样式，
// 因此使用静态映射表而非字符串拼接。
export const NODE_ICON_CLASS: Record<NodeType, string> = {
  input: "rounded-md p-1 bg-node-input-bg text-node-input",
  llm: "rounded-md p-1 bg-node-llm-bg text-node-llm",
  output: "rounded-md p-1 bg-node-output-bg text-node-output",
  feishu: "rounded-md p-1 bg-node-feishu-bg text-node-feishu",
  http: "rounded-md p-1 bg-node-http-bg text-node-http",
  condition: "rounded-md p-1 bg-node-condition-bg text-node-condition",
  merge: "rounded-md p-1 bg-node-merge-bg text-node-merge",
  cron_trigger: "rounded-md p-1 bg-node-cron-bg text-node-cron",
  music: "rounded-md p-1 bg-node-music-bg text-node-music",
}

export const NODE_HANDLE_CLASS: Record<NodeType, string> = {
  input: "!w-3 !h-3 !border-2 !border-background !bg-node-input",
  llm: "!w-3 !h-3 !border-2 !border-background !bg-node-llm",
  output: "!w-3 !h-3 !border-2 !border-background !bg-node-output",
  feishu: "!w-3 !h-3 !border-2 !border-background !bg-node-feishu",
  http: "!w-3 !h-3 !border-2 !border-background !bg-node-http",
  condition: "!w-3 !h-3 !border-2 !border-background !bg-node-condition",
  merge: "!w-3 !h-3 !border-2 !border-background !bg-node-merge",
  cron_trigger: "!w-3 !h-3 !border-2 !border-background !bg-node-cron",
  music: "!w-3 !h-3 !border-2 !border-background !bg-node-music",
}

export function nodeCard(selected: boolean): string {
  return `px-4 py-3 rounded-xl border bg-card shadow-soft min-w-[180px] transition-shadow ${selected ? "border-primary" : "border-border"}`
}

export function nodeIcon(nodeType: NodeType): string {
  return NODE_ICON_CLASS[nodeType]
}

export function nodeHandle(nodeType: NodeType): string {
  return NODE_HANDLE_CLASS[nodeType]
}
```

- [ ] **Step 2: 验证**

Run: `npm run typecheck`
Expected: 通过（该文件暂无使用方，类型正确即可）。

- [ ] **Step 3: Commit**

```bash
git add src/components/nodes/nodeStyles.ts
git commit -m "feat(nodes): 共享节点样式帮助函数 nodeStyles"
```

---

### Task 8: 统一 9 个节点组件

每个节点：替换卡片容器 class 为 `nodeCard(selected)`、图标小方块为 `nodeIcon(type)`、端口为 `nodeHandle(type)`。未选中描边从硬编码色改为 `border-border`（柔和中性），端口颜色跟随节点色调。

**Files:**
- Modify: `src/components/nodes/LLMNode.tsx`
- Modify: `src/components/nodes/InputNode.tsx`
- Modify: `src/components/nodes/OutputNode.tsx`
- Modify: `src/components/nodes/HttpNode.tsx`
- Modify: `src/components/nodes/FeishuNode.tsx`
- Modify: `src/components/nodes/MergeNode.tsx`
- Modify: `src/components/nodes/CronTriggerNode.tsx`
- Modify: `src/components/nodes/MusicNode.tsx`
- Modify: `src/components/nodes/ConditionNode.tsx`

- [ ] **Step 1: 重构 LLMNode**

`src/components/nodes/LLMNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Brain } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function LLMNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("llm")}>
          <Brain className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">LLM</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.model ? String(config.model) : "No model selected"}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("llm")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("llm")} />
    </div>
  )
}

export const LLMNodeComponent = memo(LLMNode)
```

- [ ] **Step 2: 重构 InputNode**

`src/components/nodes/InputNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { MessageSquare } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function InputNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("input")}>
          <MessageSquare className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Input</span>
      </div>
      <div className="text-xs text-muted-foreground">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className={nodeHandle("input")} />
    </div>
  )
}

export const InputNodeComponent = memo(InputNode)
```

- [ ] **Step 3: 重构 OutputNode**

`src/components/nodes/OutputNode.tsx` 完整替换为：

```tsx
"use client"

import { memo, useEffect } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { BookOpen } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"
import { useWorkflowStore } from "@/stores/workflow"
import { useRunResultsStore } from "@/stores/runResults"
import { MusicPlayer } from "@/components/music/MusicPlayer"

function OutputNode({ id, data, selected }: NodeProps) {
  const workflowId = useWorkflowStore((s) => s.workflowId)
  const hydrate = useRunResultsStore((s) => s.hydrate)
  const result = useRunResultsStore((s) => (workflowId && s.results[workflowId]?.[id]) || null)

  useEffect(() => {
    if (workflowId) hydrate(workflowId)
  }, [workflowId, hydrate])

  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("output")}>
          <BookOpen className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Output</span>
      </div>
      {result ? (
        <div className="mt-1 -mx-1">
          <MusicPlayer audioUrl={result.audioUrl} fileName={result.fileName} compact />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{data.label as string}</div>
      )}
      <Handle type="target" position={Position.Top} className={nodeHandle("output")} />
    </div>
  )
}

export const OutputNodeComponent = memo(OutputNode)
```

- [ ] **Step 4: 重构 HttpNode**

`src/components/nodes/HttpNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Globe } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function HttpNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("http")}>
          <Globe className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">HTTP</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.method ? `${config.method} ${(config.url as string || "").substring(0, 30)}` : "No URL configured"}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("http")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("http")} />
    </div>
  )
}

export const HttpNodeComponent = memo(HttpNode)
```

- [ ] **Step 5: 重构 FeishuNode**

`src/components/nodes/FeishuNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Send } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function FeishuNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("feishu")}>
          <Send className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Feishu</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {data.label as string}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("feishu")} />
    </div>
  )
}

export const FeishuNodeComponent = memo(FeishuNode)
```

- [ ] **Step 6: 重构 MergeNode**

`src/components/nodes/MergeNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Combine } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function MergeNode({ data, selected }: NodeProps) {
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("merge")}>
          <Combine className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Merge</span>
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("merge")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("merge")} />
    </div>
  )
}

export const MergeNodeComponent = memo(MergeNode)
```

- [ ] **Step 7: 重构 CronTriggerNode**

`src/components/nodes/CronTriggerNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Timer } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"
import { useTranslation } from "@/i18n"

function formatCron(expr: string, t: (k: string, params?: Record<string, string | number>) => string): string {
  if (!expr) return t("cronNode.unconfigured")
  if (expr === "0 * * * *") return t("cronNode.hourly")
  const parts = expr.split(" ")
  const hour = parts[1] || "9"
  const minute = parts[0] || "0"
  const time = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  if (expr.includes("* * 1-5")) return t("cronNode.weekday", { time })
  const m = expr.match(/^\S+\s+\S+\s+\*\s+\*\s+(\d)$/)
  if (m) {
    const dayKey = `cronNode.days.${m[1]}`
    return t("cronNode.weekly", { day: t(dayKey), time })
  }
  return t("cronNode.daily", { time })
}

function CronTriggerNode({ data, selected }: NodeProps) {
  const { t } = useTranslation()
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("cron_trigger")}>
          <Timer className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">{t("cronNode.label")}</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
        {formatCron((config?.cronExpr as string) || "", t)}
      </div>
      <Handle type="source" position={Position.Bottom} className={nodeHandle("cron_trigger")} />
    </div>
  )
}

export const CronTriggerNodeComponent = memo(CronTriggerNode)
```

- [ ] **Step 8: 重构 MusicNode**

`src/components/nodes/MusicNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Music } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function MusicNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("music")}>
          <Music className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">Music</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {config?.apiUrl ? `${config.method || "POST"} ${(config.apiUrl as string).substring(0, 30)}` : "No API configured"}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("music")} />
      <Handle type="source" position={Position.Bottom} className={nodeHandle("music")} />
    </div>
  )
}

export const MusicNodeComponent = memo(MusicNode)
```

- [ ] **Step 9: 重构 ConditionNode**

`src/components/nodes/ConditionNode.tsx` 完整替换为：

```tsx
"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { GitFork } from "lucide-react"
import { nodeCard, nodeIcon, nodeHandle } from "@/components/nodes/nodeStyles"

function ConditionNode({ data, selected }: NodeProps) {
  const config = data.config as Record<string, unknown> | undefined
  const op = (config?.operator as string) || "=="
  const left = (config?.left as string) || "value"
  const right = (config?.right as string) || ""

  return (
    <div className={nodeCard(!!selected)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={nodeIcon("condition")}>
          <GitFork className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">IF</span>
      </div>
      <div className="text-xs text-muted-foreground truncate max-w-[160px]">
        {left.substring(0, 10)} {op} {right.substring(0, 10)}
      </div>
      <Handle type="target" position={Position.Top} className={nodeHandle("condition")} />
      <Handle type="source" position={Position.Bottom} id="true" className={`${nodeHandle("condition")} !left-[30%]`} />
      <Handle type="source" position={Position.Bottom} id="false" className={`${nodeHandle("condition")} !left-[70%]`} />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-2">
        <span>TRUE</span>
        <span>FALSE</span>
      </div>
    </div>
  )
}

export const ConditionNodeComponent = memo(ConditionNode)
```

- [ ] **Step 10: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。浏览器目检工作流编辑器：节点卡片中性底+细边框、图标小方块为各类型低饱和色、选中节点雾紫描边+光圈。

- [ ] **Step 11: Commit**

```bash
git add src/components/nodes/
git commit -m "style(nodes): 9 个节点统一为 nodeStyles 柔和风格 + 低饱和节点色调"
```

---

### Task 9: Canvas 连线/背景/端口

**Files:**
- Modify: `src/components/canvas/Canvas.tsx`

- [ ] **Step 1: 连线颜色改为雾紫**

将 `edges.map(...)` 中的 `style: { strokeWidth: 2, stroke: "#94a3b8" }` 改为：

```ts
          style: { strokeWidth: 2, stroke: "var(--canvas-edge)" },
```

- [ ] **Step 2: 背景点颜色改为柔和（通过 CSS 变量）**

将 `<Background variant={BackgroundVariant.Dots} gap={16} size={1} />` 改为：

```tsx
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--canvas-dot)" />
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。目检画布连线为低饱和雾紫、背景点为柔和紫灰。

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/Canvas.tsx
git commit -m "style(canvas): 连线与背景点改为雾紫/柔和紫灰"
```

---

### Task 10: 侧边栏 + 首页卡片

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: 侧边栏激活态微调**

`src/app/(dashboard)/layout.tsx` 中 7 处 `variant: pathname === ... ? "secondary" : "ghost"` 保持 `secondary` 不变（新 token 下自动变为浅雾紫底）。仅将 Logo 区的 `text-primary` 图标保留，并给侧边栏底部版本号区加一点间距：

把：
```tsx
        <div className="p-3 border-t border-border flex items-center justify-between">
```
改为：
```tsx
        <div className="px-3 py-3 border-t border-border flex items-center justify-between">
```

- [ ] **Step 2: 首页卡片用节点色调**

`src/app/(dashboard)/page.tsx` 中三张节点卡片的图标小方块替换为：

输入卡：
```tsx
            <div className="rounded-md bg-node-input-bg p-2 w-fit mb-2">
              <MessageSquare className="h-5 w-5 text-node-input" />
            </div>
```
LLM 卡：
```tsx
            <div className="rounded-md bg-node-llm-bg p-2 w-fit mb-2">
              <Brain className="h-5 w-5 text-node-llm" />
            </div>
```
输出卡：
```tsx
            <div className="rounded-md bg-node-output-bg p-2 w-fit mb-2">
              <BookOpen className="h-5 w-5 text-node-output" />
            </div>
```

- [ ] **Step 3: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。目检首页与侧边栏。

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/page.tsx"
git commit -m "style(layout): 侧边栏间距 + 首页卡片使用节点色调"
```

---

### Task 11: 状态色清理 —— 历史/凭证/知识库/聊天/MCP 扩展

将散落的硬编码语义色替换为低饱和 token 色，保持状态语义。

**Files:**
- Modify: `src/app/(dashboard)/history/page.tsx`
- Modify: `src/app/(dashboard)/history/[id]/page.tsx`
- Modify: `src/app/(dashboard)/credentials/page.tsx`
- Modify: `src/app/(dashboard)/knowledge/page.tsx`
- Modify: `src/components/chat/ChatPanel.tsx`
- Modify: `src/components/extensions/McpTab.tsx`
- Modify: `src/components/extensions/McpEditor.tsx`

- [ ] **Step 1: history/page.tsx 状态图标**

`src/app/(dashboard)/history/page.tsx`：
- `text-green-500` → `text-success`
- `text-red-500` → `text-destructive`
- `text-blue-500` → `text-info`

（三处图标类名，分别出现在 CheckCircle / XCircle / Loader2 上。）

- [ ] **Step 2: history/[id]/page.tsx 状态卡片与错误框**

`src/app/(dashboard)/history/[id]/page.tsx`：
- `"border-red-200"` → `"border-destructive/30"`，`"border-green-200"` → `"border-success/30"`
- `text-green-500` → `text-success`，`text-red-500` → `text-destructive`
- `bg-red-50 dark:bg-red-950 text-xs text-red-600` → `bg-destructive/10 dark:bg-destructive/20 text-xs text-destructive`

- [ ] **Step 3: credentials/page.tsx**

`src/app/(dashboard)/credentials/page.tsx`：
- `text-yellow-500`（Key 图标）→ `text-warning`
- `text-green-500`（已复制）→ `text-success`

- [ ] **Step 4: knowledge/page.tsx**

`src/app/(dashboard)/knowledge/page.tsx`：
- `text-blue-500`（FileText 图标）→ `text-info`
- `text-red-500`（Trash2 图标）→ `text-destructive`

- [ ] **Step 5: ChatPanel.tsx 节点状态徽章**

`src/components/chat/ChatPanel.tsx` 第 115-119 行改为：

```tsx
                  <Badge variant="outline" className={
                    node.status === "completed" ? "border-success/40 text-success" :
                    node.status === "failed" ? "border-destructive/40 text-destructive" :
                    node.status === "running" ? "border-info/40 text-info" : ""
                  }>
```

- [ ] **Step 6: McpTab.tsx 与 McpEditor.tsx 状态点**

`src/components/extensions/McpTab.tsx` 第 40-44 行与 `src/components/extensions/McpEditor.tsx` 第 181-185 行的 statusColor 映射改为：

```ts
    online: "text-success",
    offline: "text-muted-foreground",
    error: "text-destructive",
    untested: "text-warning",
    checking: "text-info",
```

`McpEditor.tsx` 第 298 行 `text-yellow-600` → `text-warning`。

- [ ] **Step 7: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。目检历史/凭证/知识库/聊天/MCP 状态颜色柔和。

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/history" "src/app/(dashboard)/credentials/page.tsx" "src/app/(dashboard)/knowledge/page.tsx" src/components/chat/ChatPanel.tsx src/components/extensions/McpTab.tsx src/components/extensions/McpEditor.tsx
git commit -m "style(status): 历史/凭证/知识库/聊天/MCP 状态色统一为低饱和 token"
```

---

### Task 12: 音乐播放器 + 音频结果卡片 + 面板紫渐变清理

**Files:**
- Modify: `src/components/music/MusicPlayer.tsx`
- Modify: `src/components/panels/AudioResultCard.tsx`
- Modify: `src/components/panels/Toolbar.tsx`
- Modify: `src/components/panels/NodeConfigPanel.tsx`

- [ ] **Step 1: MusicPlayer.tsx 紫色 → 节点音乐色**

`src/components/music/MusicPlayer.tsx`：
- 第 153 行 `bg-purple-600`（均衡条）→ `bg-node-music`
- 第 184 行 `bg-purple-100 dark:bg-purple-950`（进度条轨道）→ `bg-node-music-bg`
- 第 186 行 `[&::-webkit-slider-thumb]:bg-purple-600`（滑块圆点）→ `[&::-webkit-slider-thumb]:bg-node-music`

- [ ] **Step 2: AudioResultCard.tsx**

`src/components/panels/AudioResultCard.tsx`：
- `bg-purple-100 p-1 dark:bg-purple-900/60` → `bg-node-music-bg p-1`
- `text-purple-600` → `text-node-music`

- [ ] **Step 3: Toolbar.tsx 与 NodeConfigPanel.tsx 音频结果容器**

将两处相同的紫色渐变容器替换为中性柔和容器：

`src/components/panels/Toolbar.tsx` 第 210 行：
```tsx
            <div className="rounded-xl border border-node-music-bg bg-node-music-bg/40 p-3">
```

`src/components/panels/NodeConfigPanel.tsx` 第 257 行：
```tsx
                <div className="rounded-xl border border-node-music-bg bg-node-music-bg/40 p-3">
```

- [ ] **Step 4: NodeConfigPanel.tsx 三个提示框**

- 第 560 行条件节点提示：`bg-yellow-50 dark:bg-yellow-950` → `bg-warning/10 dark:bg-warning/20`
- 第 583 行合并节点提示：`bg-indigo-50 dark:bg-indigo-950` → `bg-node-merge-bg dark:bg-node-merge-bg`
- 第 660 行 cron 提示：`bg-teal-50 dark:bg-teal-950` → `bg-node-cron-bg dark:bg-node-cron-bg`

- [ ] **Step 5: 验证**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 通过。目检音乐播放器与音频结果卡片与主题协调。

- [ ] **Step 6: Commit**

```bash
git add src/components/music/MusicPlayer.tsx src/components/panels/AudioResultCard.tsx src/components/panels/Toolbar.tsx src/components/panels/NodeConfigPanel.tsx
git commit -m "style(music/panels): 播放器与音频卡片改用节点色调，提示框柔和化"
```

---

### Task 13: 全站回归验证

**Files:** 无（验证任务）

- [ ] **Step 1: 静态检查 + 构建**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 全部通过。

- [ ] **Step 2: 浏览器人工回归（`npm run dev:webpack`）**

逐页目检（浅色 + 深色各一遍，`.dark` 可通过在 `<html>` 加 `class="dark"` 或 DevTools 验证）：
1. 首页 `/` —— 卡片/按钮/侧边栏
2. 工作流列表 `/workflows` —— 卡片、Switch、删除弹窗
3. 工作流编辑器 `/workflow/new` —— 节点拖拽、选中、下拉（选项间距）、输入框聚焦、配置面板
4. 模板库/历史/凭证/知识库/扩展 —— 状态色、下拉、徽章
5. 聊天页 —— 消息气泡、节点状态徽章
6. 音乐播放器 —— 均衡条/进度条配色

确认无硬编码旧色残留：`rg -n "(bg-(red|blue|green|yellow|purple|indigo|cyan|teal|orange|pink|violet|emerald|amber|rose|slate|gray|zinc|stone|neutral|sky|lime|fuchsia)-\d)" src/app src/components --glob '!components/ui/**'` 应无输出（除 `text-muted-foreground` 等中性类外）。

- [ ] **Step 3: 最终 Commit（如有残留修复）**

```bash
git add -A
git commit -m "style: 全站雾紫智能风格回归验证与收尾"
```

（若无改动则跳过本步。）

---

## 自审清单

**Spec 覆盖：**
- 配色系统（浅/深）→ Task 1
- 阴影规范 → Task 1（shadow-soft / shadow-float）
- 按钮 → Task 2
- 下拉/选择（选项间距）→ Task 3、4
- 输入/文本域 → Task 1（token 自动生效，`focus-visible:ring-ring` 已存在，无需改）
- 开关 → Task 1（`data-checked:bg-primary` 自动生效，无需改）
- 徽章状态变体 → Task 5
- 标签页 → Task 1（`bg-muted` 容器 + `data-active:bg-background shadow-sm` 自动生效，无需改）
- 卡片 → Task 1（`rounded-xl` + token 自动生效）
- 弹窗 → Task 6
- 画布节点 → Task 7、8
- 画布连线/背景/小地图/控件 → Task 1（globals.css 覆盖）、Task 9
- 侧边栏/布局 → Task 10
- 列表页状态色清理 → Task 11
- 音乐播放器/音频卡片 → Task 12

**占位符扫描：** 无 TBD/TODO，所有 class 替换均为完整字符串。

**类型一致性：** `nodeStyles.ts` 导出的 `nodeCard/nodeIcon/nodeHandle` 在 Task 8 各节点中调用，参数为 `NodeType` 字符串（`"input" | "llm" | "output" | "feishu" | "http" | "condition" | "merge" | "cron_trigger" | "music"`），静态映射表 `NODE_ICON_CLASS / NODE_HANDLE_CLASS` 中每个 key 都有对应的完整字面量类名，`cron_trigger` 映射到 `node-cron`（token 名为 `--node-cron`），与 Task 1 的 `--color-node-*` 令牌命名完全一致。类名以完整字符串出现在源文件中，Tailwind v4 扫描器可正常生成 `bg-node-input-bg`、`text-node-cron` 等工具类。

