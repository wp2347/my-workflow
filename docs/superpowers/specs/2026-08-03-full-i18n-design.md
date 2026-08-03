# 全量 i18n 改造设计

> 日期：2026-08-03
> 状态：已定稿，待用户审阅

## 目标

消除中英混合界面，所有面向用户的 UI 文案支持中英文切换。将项目中残留的硬编码中文/英文文案全部迁移到 i18n 体系。

## 背景

- 项目已有 i18n 体系：`src/i18n/locales/zh.json` + `en.json`（嵌套对象），`useTranslation()` 从 `@/i18n` 获取 `t`，`t("a.b.c")` 按 `.` 解析。
- 侧边栏的「首页/工作流/扩展包/新建工作流」等已 i18n，但「执行历史/凭证管理/知识库」硬编码中文。
- 多个页面（history/credentials/knowledge/editor/toolbar/cron node/widget）仍有硬编码中文。
- `LocaleSwitcher.tsx` 的 "Switch to English"/"切换到中文" 是语言切换按钮本身文案，**不翻译**。

## 范围

**改造文件（10 个）：**

| 文件 | 文案数 | 说明 |
|---|---|---|
| `src/app/(dashboard)/layout.tsx` | 3 | 执行历史/凭证管理/知识库 |
| `src/app/(dashboard)/history/page.tsx` | 6 | 标题/空态/状态/分页 |
| `src/app/(dashboard)/history/[id]/page.tsx` | 4 | 执行详情/成功失败/输出数据 |
| `src/app/(dashboard)/credentials/page.tsx` | ~15 | 添加/删除/名称/类型/作用域等 |
| `src/app/(dashboard)/knowledge/page.tsx` | ~10 | 知识库/添加文档/上传等 |
| `src/app/(dashboard)/workflow/[id]/page.tsx` | 1 | 未命名工作流 |
| `src/components/panels/Toolbar.tsx` | ~10 | 执行/执行结果/Webhook/已复制等 |
| `src/components/nodes/CronTriggerNode.tsx` | ~6 | 定时/每小时/每天/每周X（含动态占位符） |
| `src/components/canvas/Canvas.tsx` | 1 | 默认配置值"定时任务" |
| `src/app/widget/[workflowId]/page.tsx` | 3 | 请求失败/发送消息/输入消息 |
| `src/components/panels/NodeConfigPanel.tsx` | ~7 | Merge 节点文案 + HTTP 用户名/密码 placeholder |

**不改造：**
- `LocaleSwitcher.tsx` — 语言切换按钮文案本身。
- SelectItem 值类（"Text"/"JSON"/"Markdown"/"POST"/"GET"/"none"/"bearer" 等）—— 是配置值不是用户可见文案。
- 节点 data 的默认配置值（如 `name: "定时任务"`）—— 是存储数据非 UI 文案。但 Canvas.tsx 的 `getDefaultConfig("cron_trigger")` 返回 `name: "定时任务"` 会作为节点初始名称显示，需改为中性值（如 `"Cron Job"`）或留空由渲染层显示。
- 服务端错误消息（API 返回的英文 error）—— 面向开发者，保留。

## 方案

### 1. i18n key 分组

按页面/组件分组新增 key：

- `history.title` / `history.description` / `history.noExecutions` / `history.noExecutionsDesc` / `history.completed` / `history.failed` / `history.prev` / `history.next`
- `historyDetail.notFound` / `historyDetail.title` / `historyDetail.completed` / `historyDetail.failed` / `historyDetail.output`
- `sidebar.history` / `sidebar.credentials` / `sidebar.knowledge`
- `credentials.title` / `credentials.description` / `credentials.add` / `credentials.noCreds` / `credentials.noCredsDesc` / `credentials.copy` / `credentials.view` / `credentials.copied` / `credentials.name` / `credentials.type` / `credentials.value` / `credentials.scope` / `credentials.global` / `credentials.workflow` / `credentials.node` / `credentials.cancel` / `credentials.save` / `credentials.deleteTitle` / `credentials.deleteDesc` / `credentials.delete` / `credentials.addTitle` / `credentials.addDesc` / `credentials.namePlaceholder`
- `knowledge.title` / `knowledge.description` / `knowledge.addDoc` / `knowledge.noDocs` / `knowledge.noDocsDesc` / `knowledge.uploadFile` / `knowledge.manualInput` / `knowledge.docName` / `knowledge.docNamePlaceholder` / `knowledge.content` / `knowledge.contentPlaceholder` / `knowledge.cancel` / `knowledge.upload` / `knowledge.chunks`（占位符）/ `knowledge.chunkSize`
- `workflow.untitled`（未命名工作流）
- `toolbar.run` / `toolbar.runResult` / `toolbar.webhook` / `toolbar.webhookDesc` / `toolbar.copied` / `toolbar.copy` / `toolbar.curlExample` / `toolbar.status` / `toolbar.duration` / `toolbar.error` / `toolbar.output` / `toolbar.requestFailed`
- `cronNode.label`（定时）/ `cronNode.unconfigured` / `cronNode.hourly` / `cronNode.daily` / `cronNode.weekday` / `cronNode.weekly`（占位符 {day}/{time}）/ `cronNode.days.0-6`（日一二三四五六）
- `widget.requestFailed` / `widget.startChat` / `widget.inputPlaceholder`
- `config.mergeStrategy` / `config.mergeConcat` / `config.mergeJsonArray` / `config.mergeFirst` / `config.mergeLast` / `config.mergeHint` / `config.authUsername` / `config.authPassword`

### 2. CronTriggerNode 动态文案（占位符 i18n）

把动态字符串改为占位符：
```tsx
if (expr === "0 * * * *") return t("cronNode.hourly")
if (expr.includes("* * 1-5")) return t("cronNode.weekday", { time })
const weekly = /(\d+) (\d+) \* \* (\d+)/.exec(expr)
if (weekly) return t("cronNode.weekly", { day: t(`cronNode.days.${weekly[3]}`), time })
return t("cronNode.daily", { time })
```
- zh: `cronNode.hourly` = "每小时", `cronNode.daily` = "每天 {time}", `cronNode.weekday` = "工作日 {time}", `cronNode.weekly` = "每周{day} {time}", `cronNode.days.1` = "一" 等。
- en: `cronNode.hourly` = "Hourly", `cronNode.daily` = "Daily {time}", `cronNode.weekday` = "Weekdays {time}", `cronNode.weekly` = "Weekly {day} {time}", `cronNode.days.1` = "Mon" 等。

### 3. 各文件改造模式

每个文件：
1. 文件顶部加 `import { useTranslation } from "@/i18n"`（若未引入）
2. 组件函数内加 `const { t } = useTranslation()`
3. 硬编码文案替换为 `t("key")`
4. 动态字符串用占位符：`t("key", { name: value })`（i18n 已支持 `{key}` 插值）

**注意服务端组件**：widget 页面如果是 server component 需要 `"use client"` 或改用客户端渲染——检查每个文件是否为 client component（dashboard 页面基本都是 "use client"，widget 需确认）。

### 4. Canvas.tsx 默认配置值

`getDefaultConfig("cron_trigger")` 的 `name: "定时任务"` 改为中性英文默认值 `name: "Cron Job"`（节点显示由 label 决定，name 是内部配置）。这不是 UI 文案翻译，而是避免中文默认值。

## 错误处理与测试

- i18n JSON 合法（node JSON.parse）。
- typecheck + lint 无新增错误。
- 浏览器验证：切换中英文，各页面无混合文案、无遗漏。

## 涉及文件

见「范围」表（10 个文件 + 2 个 locale 文件）。

## 非目标

- 不翻译 `LocaleSwitcher` 按钮文案。
- 不翻译 API 返回的服务端错误（面向开发者）。
- 不翻译 SelectItem 配置值。
- 不翻译执行日志中的原始数据（nodeType 等）。

## 不确定项

- widget 页面是否 server component —— 实现时确认，若是则需 `"use client"` 或调整。
- Canvas.tsx `name: "定时任务"` 是否影响已有数据 —— 仅影响新建 cron 节点的默认值，已有节点不受影响。
