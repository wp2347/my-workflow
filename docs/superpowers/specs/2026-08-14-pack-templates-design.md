# 技能包工作流模板库 + packId 自动绑定 设计

- 日期：2026-08-14
- 目标：为刚上线的 filesystem/office 技能包创建示例工作流模板库，并支持模板 LLM 节点按 `packId` 自动绑定已安装的技能包
- 前提：技能包系统已上线（`src/lib/packs/`、`src/app/api/packs/`、office/filesystem MCP server）

## 1. 目标

1. 模板 LLM 节点可用 `{ packId }` 引用技能包，执行时自动解析为已安装的同 packId MCP server / 技能 —— 模板装完包即开即用，无需手动绑定。
2. 新增 3 个工作流模板，展示"本地文件读取 + Word/Excel/PPT 生成"能力。
3. 不新增节点类型；不改动旧 `serverId` / skill-id 引用方式（向后兼容）。

## 2. 引擎改动：扩展绑定支持 packId

### 2.1 类型（`src/types/workflow.ts`）

```ts
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

export interface ExtensionBindings {
  skills: Array<string | SkillPackBinding>
  prompts: Array<string | SkillPackBinding>
  mcp: Array<McpBinding | McpPackBinding>
}
```

### 2.2 解析逻辑

- `loadSkills(entries, context)`：遍历 entries，`{packId}` → 查 `skill.where({ packId })` 取 id 集合；普通 string 原样保留；合并后按现有逻辑注入。
- `loadMcpExtensions(entries, context)`：遍历 bindings，`{packId}` → 查 `mcpServer.findMany({ where: { packId } })`，把每个 server 视为一个 binding（tools 过滤同现有）；`{serverId}` 走现有逻辑。
- `mergeExtensions`：仅类型放宽，行为不变。
- 解析不到的 packId（未安装）→ warn + 跳过（与现有"悬空 ID 跳过"一致）。

## 3. 新增模板（3 个）

注册进 `src/lib/templates.ts`，builder 放 `src/app/api/workflow/template/<id>/template.ts`，i18n 走 `templates.list.<id>.*`。

### 3.1 file-to-docx：本地文件 → Word 报告
- 输入节点（`message`，主题/文件路径提示）
- LLM 节点：绑定 `filesystem` + `office` 两包；systemPrompt 引导「先 list_directory/read_file 读取 storage 下文件，再 create_docx 生成 .docx 到 storage/export/」
- 输出节点

### 3.2 data-to-xlsx：数据 → Excel 报表
- 输入节点
- LLM 节点：绑定 `office` 包；systemPrompt 引导「把用户描述的数据整理成 JSON 数组，调用 create_xlsx 生成 .xlsx」
- 输出节点

### 3.3 markdown-to-pptx：大纲 → PPT
- 输入节点
- LLM 节点：绑定 `office` 包；systemPrompt 引导「生成 Markdown 大纲（# 分页、列表作要点），调用 create_pptx」
- 输出节点

节点数据：`type` 用现有 `input`/`llm`/`output`，LLM `config.extensions = { skills: [{ packId }], prompts: [], mcp: [{ packId }] }`。位置横向排列（输入→LLM→输出）。

## 4. i18n

- `templates.list.fileToDocx.name/description`、`dataToXlsx.*`、`markdownToPptx.*`（zh + en）
- 模板内 LLM systemPrompt 支持 zh/en（builder 按 lang 分支，参考 daily-brief 模板写法）

## 5. 不做的事

- 不改 ExtensionPicker / McpEditor 渲染 packId 条目（模板 JSON 直接写入，用户编辑扩展时可能覆盖，可接受）
- 不做包内多 server 的 UI 选择
- 不新增节点类型

## 6. 验证

- `npm run typecheck` / `npm run lint` / `npm run build`
- 单测：loadSkills / loadMcpExtensions 的 packId 解析（mock 或连库）
- 端到端：安装 office 包 → 用 data-to-xlsx 模板新建工作流 → 执行一次 → storage/ 出现 xlsx
