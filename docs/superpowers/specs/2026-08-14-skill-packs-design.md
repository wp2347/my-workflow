# 技能包系统 + 官方文件/文档 MCP 包 设计

- 日期：2026-08-14
- 目标：让"文件读取 + Word/Excel/PDF/PPT 生成"等能力以**技能包**形式提供，用户一键安装，引擎零改动
- 路线：全 MCP / 技能包（不新增引擎节点、不改执行器）

## 1. 目标

1. 新增"技能包"机制：一个包 = 一个或多个 MCP server 配置 + 可选 skill/prompt + 元数据（id/名称/图标/版本/描述）。
2. 平台内置官方技能包（v1 两个：**filesystem 文件读写**、**office 文档生成**），用户可一键安装/卸载。
3. 支持用户导入第三方技能包（粘贴/上传 JSON 清单）。
4. 自研官方 `office` MCP server（Markdown→docx、JSON→xlsx、大纲→pptx、内容→pdf），**全部纯 JS、无 Chromium 依赖**。
5. 复用现有 `mcp-manager.ts` 的 stdio spawn 机制，引擎/执行器/节点类型零改动。

## 2. 技能包清单（Pack Manifest）Schema

一个 JSON 文件描述一个技能包，zod 校验：

```jsonc
{
  "id": "office",                    // 全局唯一，install/uninstall 幂等键
  "name": "文档生成",                 // 显示名（内置包在 UI 中改用 i18n key，见 §7）
  "description": "生成 Word/Excel/PPT/PDF 文件",
  "category": "office",
  "icon": "file-text",               // lucide 图标名（可选）
  "version": "1.0.0",
  "mcps": [
    {
      "name": "office",              // 安装后创建的 McpServer.name
      "transport": "stdio",          // stdio | http | sse
      "command": "npx",              // stdio 必需
      "args": ["tsx", "src/mcp/office-server.ts"],
      "env": {},                     // 加密存储
      "tools": "all"                 // 绑定工具过滤："all" 或数组
    }
  ],
  "skills": [                        // 可选
    {
      "name": "office-usage",
      "description": "文档生成工具使用指南",
      "category": "office",
      "content": "Use the office MCP tools to create files..."
    }
  ],
  "prompts": []                      // 可选，结构同 skills
}
```

必填校验：`id`（唯一、合法格式）、`version`（semver）、`mcps` 非空。`skill`/`prompt` 可选。

## 3. 数据模型改动（Prisma）

- 给 `Skill`、`Prompt`、`McpServer` 各加一个可空字段：

```prisma
  packId String? @map("pack_id")
```

`packId` 用于：幂等安装（已存在该 packId 则跳过/提示）、整包卸载（删该 packId 全部行）。加索引便于查询。

- 新增 `Pack` 表，存"已导入的三方包"元数据（内置包从 `src/packs/*.json` 读取，不入库）：

```prisma
model Pack {
  id          String   @id
  name        String
  description String   @db.Text
  category    String?
  icon        String?
  version     String
  source      String   @default("imported") // "imported"（保留扩展位）
  manifest    Json     // 完整清单，用于重复导入校验与重装
  createdAt   DateTime @default(now()) @map("created_at")
  @@map("packs")
}
```

## 4. 官方内置包（`src/packs/*.json`）

### 4.1 filesystem 包
- 包装官方 `@modelcontextprotocol/server-filesystem`（stdio 通过 `npx -y @modelcontextprotocol/server-filesystem <dirs...>` 拉起）
- 安装时默认参数 `["storage"]`（工作目录下的 `storage/`），**用户可在 MCP 编辑器中编辑 args 追加允许目录**
- 提供 `read_file / list_directory / search_files / write_file / edit_file` 等官方工具
- 附带 skill：说明可读取本地文件，引导 LLM 用 `list_directory` + `read_file`

### 4.2 office 包（自研，核心交付物）
- 新增 `src/mcp/office-server.ts`：`@modelcontextprotocol/sdk` 的 `McpServer` + `StdioServerTransport`，暴露 4 个工具：

| 工具 | 入参 | 实现 |
|---|---|---|
| `create_docx` | `{ markdown, outputPath }` | `marked` 解析 → `docx` 库生成（标题/段落/列表/表格/粗体斜体） |
| `create_xlsx` | `{ rows: object[], outputPath }` | `exceljs`，首行对象键作表头，自动列宽 |
| `create_pptx` | `{ outline, outputPath }` | `pptxgenjs`，按 Markdown 标题分页、列表转要点 |
| `create_pdf` | `{ content, outputPath }` | `marked` 解析 → `pdfmake` 文档定义生成 PDF（无 Chromium） |

- **安全**：`outputPath` 必须解析后位于允许根目录内（默认 `<project>/storage/`，可用环境变量 `OFFICE_ALLOWED_DIR` 覆盖），越界返回错误
- **依赖新增**：`@modelcontextprotocol/sdk`（已有）、`docx`、`exceljs`、`pptxgenjs`、`pdfmake`、`marked`
- 附带 skill：说明各工具的入参约定与"输出路径需以 storage/ 开头"

## 5. API 路由（Next.js Route Handlers）

- `GET /api/packs` → 市场列表：内置包（读 `src/packs/*.json`）+ 导入包（`Pack` 表），每项附 `installed` 布尔（是否存在该 packId 的行）
- `POST /api/packs/:id/install` → 按清单创建 `McpServer`/`Skill`/`Prompt` 行（已安装则 409）
- `DELETE /api/packs/:id/uninstall` → 删除该 packId 的全部行
- `POST /api/packs/import` → 校验清单 JSON（zod）→ upsert `Pack` 行（幂等，manifest 更新）
- `DELETE /api/packs/:id`（仅导入包）→ 移除 `Pack` 行（不卸载已安装资源）
- 以上路径为参考，实现时统一挂到 `src/app/api/packs/`（含动态段）

## 6. UI：扩展页"技能包市场"标签页

- 在 `/extensions` 页新增 `TabsList` 标签「技能包市场」（Skills/Prompts/MCP 之后）
- 内容：卡片网格
  - 每张卡：图标、名称、描述、`Badge`（版本 / 官方 / 导入 / 已安装）
  - 按钮：未安装 → 「安装」；已安装 → 「已安装 + 卸载」
  - 右上「导入技能包」按钮 → Dialog（粘贴 JSON 或上传 `.json` 文件）→ 校验提示 → 成功后刷新市场并可选自动安装
- 复用现有 `Card`/`Badge`/`Button`/`Dialog`/`Tabs`，沿用雾紫主题

## 7. 国际化（遵守 AGENTS.md 强制规则）

- 所有 UI 文案走 `useTranslation()`，同步 `zh.json` + `en.json`（新增 `packs.*` key 分组）
- **内置官方包**的 `name`/`description` 在 UI 中通过 i18n key `packs.<id>.name / packs.<id>.description` 渲染；清单中保留英文兜底文案
- **导入的三方包**直接显示清单里的 `name`/`description`
- 包内 `skill.content` 为 LLM 指令，统一用英文（注入 prompt 用）

## 8. 安全

- filesystem：官方 server 的 allowed dirs 由 args 控制，默认 `storage/`
- office：`outputPath` 路径校验（resolve 后在允许根目录内），防止任意写盘
- MCP `env`/`headers` 沿用现有 `lib/crypto` 加密存储
- 导入清单做 zod 校验 + `id` 格式白名单，防注入/覆盖内置 id

## 9. 引擎零改动清单

- `src/engine/`、`src/types/workflow.ts`（节点类型）、`src/components/canvas`、`src/components/panels` **不改**
- 仅复用 `mcp-manager.ts` 现有 stdio 拉起逻辑（office/filesystem 均 stdio）
- `ExtensionPicker` 与 `McpEditor` 直接管理安装出的 MCP server（用户可编辑 filesystem 的 args）

## 10. 验证

- `npm run typecheck` / `npm run lint` / `npm run build` 通过
- office server 单测（vitest）：markdown→docx/xlsx/pptx/pdf 各生成一个文件并断言存在/可解析
- 浏览器手测：扩展页安装 filesystem + office 包 → LLM 节点绑定 → 执行一次生成 docx/xlsx 落盘到 storage/

## 11. 不做的事（YAGNI）

- 不做 URL registry / 三方在线市场
- 不做包依赖解析与自动升级
- 不做原生"文件读取/文档生成"节点
- 不做 PDF 的 Chromium 高保真渲染（v1 用 pdfmake）
