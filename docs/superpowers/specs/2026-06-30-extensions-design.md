# 扩展包系统设计文档

> **版本:** v1.0  
> **日期:** 2026-06-30  
> **状态:** 设计完成,待实现

## 1. 概述

### 1.1 目标

为 AI 工作流平台增加**扩展包**功能,用户可以上传、下载、新建三类扩展,并绑定到 LLM 节点(及其他适用节点),增强工作流的能力:

| 扩展类型 | 本质 | 绑定到 LLM 节点的作用 |
|---------|------|----------------------|
| **Skills(技能包)** | 结构化 markdown 能力定义(name/description/内容/附件),遵循 Anthropic Agent Skills 规范 | 塑造模型"如何思考/做事"的行为方式,注入 system prompt |
| **Prompts(提示词模块)** | 可复用 prompt 模板,带变量占位符,兼容所有主流 AI 模型 | 提供具体任务的 prompt 骨架,注入 system/user prompt |
| **MCP(Model Context Protocol 服务端)** | 标准 MCP 服务器(http/sse/stdio),暴露 tools/resources/prompts | 给模型提供可调用的外部工具和数据源 |

### 1.2 核心特性

- **三类扩展独立管理:** Skills、Prompts、MCP 各有独立数据表、API、编辑器
- **上传/下载/新建:** 在线编辑器新建 + 上传导入(.md/.zip) + 下载导出(.zip) + MCP 远程 URL 注册
- **双层绑定:** 工作流级(默认)+ 节点级(覆盖),替换语义
- **Skills 智能加载:** ≤3 个全量注入;>3 个用 tool-calling 按需加载
- **MCP 全传输支持:** http/sse(无状态连接)+ stdio(进程池管理)
- **安全:** 上传路径穿越校验、大小限制、敏感信息加密、stdio 沙箱提示
- **i18n 全覆盖:** 所有 UI 文字国际化(zh/en)

### 1.3 技术依据

- **Anthropic Agent Skills 规范:** SKILL.md + frontmatter(name/description)+ progressive disclosure(元数据先加载,内容按需加载)
- **MCP 官方规范:** tools(model-controlled)/ resources(application-driven)/ prompts(user-controlled)
- **AI SDK 官方 MCP 客户端:** `@ai-sdk/mcp@^2.0.3`,支持 http/sse/stdio
- **MCP 底层协议:** `@modelcontextprotocol/sdk@^1.29.0`

---

## 2. 数据模型

### 2.1 Skill(技能包)

```prisma
model Skill {
  id           String   @id @default(cuid())
  name         String                                // 显示名(≤64字符,Anthropic 规范)
  description  String   @db.Text                     // 第三人称,"做什么+何时用"(≤1024字符)
  category     String?                               // 分类标签
  content      String   @db.Text                     // SKILL.md 主体(markdown,建议≤500行)
  attachments  Json     @default("[]")               // [{name, fileName, type:"reference"|"script", mimeType, size}]
  tags         String[] @default([])
  version      String   @default("1.0.0")            // 显示用,暂无版本历史
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@map("skills")
}
```

**附件存储:** 文件存到 `storage/skills/{id}/`(项目根目录,不对外暴露),DB 只存元数据。  
**无向量索引:** 采用元数据注入 + 模型选择机制,不做向量检索。  
**description 写作规范(Anthropic 官方):**
- 第三人称("Processes PDF files" 而非 "I can process PDFs")
- 包含"做什么 + 何时用"
- ≤1024 字符

### 2.2 Prompt(提示词模块)

```prisma
model Prompt {
  id           String   @id @default(cuid())
  name         String
  description  String?
  category     String?
  content      String   @db.Text                     // prompt 模板,含 {变量} 占位符
  variables    Json     @default("[]")               // [{name, description, required, defaultValue}]
  role         String   @default("system")           // "system" | "user" — 注入位置
  tags         String[] @default([])
  version      String   @default("1.0.0")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@map("prompts")
}
```

**role 字段:**
- `role="system"`:渲染后追加到 LLM 节点 systemPrompt
- `role="user"`:渲染后前置到 user input

**变量替换:** 复用现有 `@/lib/expression.ts`,支持 `{{$input.xxx}}`/`{{$node.xxx.field}}`/`{{变量名}}`。  
**无 modelCompat 字段:** 变量替换是平台层逻辑,与模型无关,任何 provider 都兼容。

### 2.3 McpServer(MCP 服务端)

```prisma
model McpServer {
  id                String   @id @default(cuid())
  name              String
  description       String?
  transport         String                                // "http" | "sse" | "stdio"
  // http/sse 连接配置
  url               String?
  headers           Json     @default("{}")               // 加密存储(含鉴权 token)
  // stdio 连接配置
  command           String?
  args              Json     @default("[]")
  env               Json     @default("{}")               // 加密存储(含 API key)
  // 运行时能力缓存
  capabilitiesCache Json     @default("{\"tools\":[],\"resources\":[],\"prompts\":[]}")
  status            String   @default("untested")         // untested|checking|online|offline|error
  lastCheckedAt     DateTime?
  tags              String[] @default([])
  version           String   @default("1.0.0")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@map("mcp_servers")
}
```

**敏感信息加密:** `headers` 和 `env` 用现有 `@/lib/crypto` 的 `encrypt`/`decrypt` 加密存储,GET 返回脱敏标记。  
**stdio 部署提示:** stdio transport 仅适合自托管部署(需持久进程),云端/serverless 环境建议用 http/sse。  
**capabilitiesCache 结构:**
```json
{
  "tools": [{ "name": "get_weather", "description": "...", "inputSchema": {...} }],
  "resources": [{ "uri": "file:///data/config.json", "name": "...", "mimeType": "..." }],
  "prompts": [{ "name": "code_review", "description": "...", "arguments": [...] }]
}
```

### 2.4 绑定关系(复用现有 JSON 字段,不新建表)

```typescript
interface ExtensionBindings {
  skills: string[]                    // Skill ID 数组
  prompts: string[]                   // Prompt ID 数组
  mcp: McpBinding[]                   // MCP 绑定(含工具/资源选择)
}

interface McpBinding {
  serverId: string
  tools?: string[] | "all"            // 默认 "all"
  resources?: string[]                // 默认 []
  prompts?: string[]                  // 默认 []
}
```

- **工作流级:** 存 `Workflow.config.extensions`(作为该工作流内所有 LLM 节点的默认)
- **节点级:** 存 `WorkflowNode.data.config.extensions`(覆盖工作流级)
- **合并规则(替换语义):** 节点级某字段非空数组 → 完全覆盖工作流级;为空 → 回退工作流级
- **悬空引用:** 扩展被删除后,JSON 里的 ID 变悬空。执行时遇到不存在的 ID → `console.warn` + 跳过,不阻断工作流。

### 2.5 ExecutionContext 类型变更

`src/types/workflow.ts` 的 `ExecutionContext` 新增字段:

```typescript
export interface ExecutionContext {
  // ...现有字段
  workflowExtensions?: ExtensionBindings   // 工作流级扩展绑定(执行入口加载)
}
```

`executor.ts` 的 `executeWorkflow` 在构建 context 时,从 Workflow.config 提取 extensions 存入。

### 2.6 新增依赖

```json
{
  "@ai-sdk/mcp": "^2.0.3",
  "@modelcontextprotocol/sdk": "^1.29.0",
  "jszip": "^3.10.1"
}
```

---

## 3. 架构与模块划分

### 3.1 目录结构(新增部分)

```
src/
├── app/api/extensions/
│   ├── skills/
│   │   ├── route.ts                  # GET 列表 / POST 新建
│   │   ├── upload/route.ts           # POST 上传导入(.md/.zip)
│   │   └── [id]/
│   │       ├── route.ts              # GET / PUT / DELETE 单个
│   │       └── export/route.ts       # GET 导出 .zip
│   ├── prompts/
│   │   ├── route.ts
│   │   ├── upload/route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── export/route.ts
│   └── mcp/
│       ├── route.ts
│       └── [id]/
│           ├── route.ts              # GET / PUT / DELETE
│           └── test/route.ts         # POST 测试连接
│
├── components/extensions/
│   ├── ExtensionLibrary.tsx          # 扩展包管理主页面(三个 Tab)
│   ├── SkillsTab.tsx                 # Skills 列表
│   ├── PromptsTab.tsx                # Prompts 列表
│   ├── McpTab.tsx                    # MCP 列表
│   ├── SkillEditor.tsx               # Skill markdown 编辑器 + 附件管理
│   ├── PromptEditor.tsx              # Prompt 模板编辑器 + 变量定义 + 预览
│   ├── McpEditor.tsx                 # MCP 连接配置 + 能力预览
│   └── ExtensionPicker.tsx           # 节点配置面板里的扩展选择器
│
├── engine/extensions/
│   ├── skill-loader.ts               # Skills 加载策略
│   ├── prompt-renderer.ts            # Prompt 变量替换
│   └── mcp-manager.ts                # MCP 连接管理器
│
├── lib/extensions/
│   ├── zip.ts                        # zip 打包/解压(含路径穿越校验)
│   └── validation.ts                 # 扩展包字段校验
│
└── stores/
    └── extensions.ts                 # Zustand store

storage/                              # 附件存储(不对外暴露)
├── skills/{id}/
└── prompts/{id}/
```

### 3.2 核心模块职责

| 模块 | 职责 |
|------|------|
| **skill-loader.ts** | 执行时加载绑定的 skills:≤3 个全量注入 SKILL.md 到 system prompt;>3 个注入 name+description 摘要 + 注册 `load_skill` tool(模型按需调用);reference 附件读取文本注入;script 附件注册为可调用 tool |
| **prompt-renderer.ts** | 执行时渲染 prompt 模板:用 `@/lib/expression.ts` 解析 `{{变量}}`,变量值来源优先级:节点配置 > 工作流输入 > 上游节点输出 > defaultValue;按 role 分组注入 system/user |
| **mcp-manager.ts** | MCP 连接管理器:http/sse 每次执行新建连接;stdio 进程池(首次 spawn,引用计数,空闲 5 分钟 kill,崩溃重启 ≤3 次);按节点绑定选择 tools/resources/prompts |
| **zip.ts** | JSZip 打包导出 + 解压导入;解压时校验路径不含 `..` 和绝对路径;附件总大小 ≤10MB |
| **ExtensionPicker.tsx** | 在 NodeConfigPanel 的 LLM 节点配置区新增"扩展包"折叠区,三个子选择器(Skills/Prompts/MCP),支持多选 + MCP 工具粒度选择 |

---

## 4. API 设计

### 4.1 路由总览

```
/api/extensions/skills
├── GET                    列表(?q=&category=)
├── POST                   新建(JSON body)
├── upload
│   └── POST               上传导入(.md/.zip,multipart)
└── [id]
    ├── GET                详情
    ├── PUT                更新
    ├── DELETE             删除(+清理附件目录)
    └── export
        └── GET            导出 .zip

/api/extensions/prompts
├── GET / POST / upload
└── [id] / GET / PUT / DELETE / export

/api/extensions/mcp
├── GET / POST
└── [id]
    ├── GET / PUT / DELETE
    └── test
        └── POST           测试连接 + 刷新缓存
```

### 4.2 安全规范

| 项 | 规则 |
|----|------|
| 输入校验 | 关键字段必填校验(name/description/transport);transport 枚举值校验;Skill description ≤1024 字符 |
| 文件上传 | 白名单:`.md` / `.zip`;大小 ≤10MB;zip 解压路径穿越校验(拒绝含 `..` 和绝对路径的条目) |
| 敏感信息 | MCP 的 `headers`/`env` 用 `@/lib/crypto` encrypt 加密存储;GET 返回 `hasAuth: boolean` 脱敏标记 |
| 删除 | Skill/Prompt 删除时同步清理 `storage/{type}/{id}/` 附件目录 |
| 错误处理 | 统一 `{ error: string }` 格式,HTTP 状态码 400/404/500 |

### 4.3 统一响应格式

```
列表:    [ { id, name, description, category, tags, updatedAt, ... } ]
详情:    { ...全部字段 }
新建:    { id, name, ... } + status 201
更新:    { id, ...更新后字段 }
删除:    { success: true }
导出:    binary zip (Content-Disposition: attachment)
上传:    { id, name, attachments: [...] } + status 201
MCP测试: { status: "online"|"error", capabilities: { tools, resources, prompts } }
```

### 4.4 关键路由逻辑

**POST `/api/extensions/skills/upload`**(上传导入)
1. 校验文件类型(.md/.zip)+ 大小 ≤10MB
2. `.md`:读取内容 → 如有 frontmatter 解析 name/description → 入库
3. `.zip`:JSZip 解压 → 路径穿越校验 → 找 SKILL.md 解析 frontmatter → 其余文件存 `storage/skills/{id}/` → 记入 attachments

**POST `/api/extensions/mcp`**(新建)
1. 校验 transport ∈ ["http","sse","stdio"]
2. http/sse → url 必填;stdio → command 必填
3. headers/env encrypt 加密后存储

**POST `/api/extensions/mcp/[id]/test`**(测试连接)
1. 按 transport 创建 MCP client(http/sse/stdio)
2. 并行调用 `tools/list` + `resources/list` + `prompts/list`
3. 更新 capabilitiesCache + status + lastCheckedAt
4. stdio:测试完即 kill 子进程
5. 失败 → status="error",返回错误信息

---

## 5. 执行引擎详细设计

### 5.1 执行流程改动(`src/engine/nodes/llm.ts`)

在现有 `executeLLMNode` 中,构建 `genOptions` 前插入扩展加载阶段:

> **注意:** `executeLLMNode` 签名为 `(node, context)`,无 `workflowConfig` 参数。工作流级 extensions 存在 `Workflow.config.extensions` 里。需在 `executor.ts` 的 `executeWorkflow` 入口加载工作流 config 时提取 extensions 存入 `ExecutionContext`(新增 `workflowExtensions` 字段),避免执行时额外 DB 查询。

```typescript
// ===== 扩展加载阶段(新增) =====
const extensions = mergeExtensions(context.workflowExtensions, nodeConfig)
const skillPayload = await loadSkills(extensions.skills, context)
const promptPayload = renderPrompts(extensions.prompts, context)
const mcpPayload = await loadMcpExtensions(extensions.mcp, context)

// 注入 system prompt
finalSystem = [
  finalSystem,
  ...skillPayload.systemContext,
  ...mcpPayload.resourceContext,
  ...promptPayload.systemPrompts,
].filter(Boolean).join("\n\n")

// 注入 user input
userInput = [
  ...promptPayload.userPrompts,
  userInput,
].filter(Boolean).join("\n\n")

// 注册 tools
if (mcpPayload.tools || skillPayload.scriptTools) {
  genOptions.tools = { ...mcpPayload.tools, ...skillPayload.scriptTools }
  genOptions.maxSteps = 3
}
```

### 5.2 skill-loader.ts

```typescript
interface SkillPayload {
  systemContext: string[]              // 注入 system prompt 的文本
  scriptTools: Record<string, Tool>    // script 附件注册为 tools
}
```

**加载策略:**
- skillIds 为空 → 返回空 payload
- 悬空 ID → `console.warn` + 跳过
- **≤3 个 skill:** 全量注入 content 到 systemContext;reference 附件读取文本追加
- **>3 个 skill:** 注入所有 name+description 摘要 + 注册 `load_skill` tool:
  - `load_skill({ skill_name: string })` → 返回该 skill 的 content 全文
  - 设 `maxSteps: 3`,模型在生成过程中按需调用,AI SDK 自动处理 tool call 循环
  - 所有主流模型(OpenAI/Claude/Gemini/DeepSeek 等)都支持 tool calling
- **script 附件:** 注册为可调用 tool

### 5.3 prompt-renderer.ts

```typescript
interface PromptPayload {
  systemPrompts: string[]   // role="system" 的渲染结果
  userPrompts: string[]     // role="user" 的渲染结果
}
```

**渲染逻辑:**
- 从 DB 查询所有 prompt(content/variables/role)
- 悬空 ID → `console.warn` + 跳过
- 用 `resolveExpression()` 替换 `{{变量}}`:
  - `{{$input.xxx}}` → 工作流输入
  - `{{$node.xxx.field}}` → 上游节点输出
  - `{{变量名}}` → 按 variables 定义查找:节点 config > 工作流 input > defaultValue
- 按 `role` 分组返回

### 5.4 mcp-manager.ts

```typescript
interface McpPayload {
  tools: Record<string, Tool>       // 注册给模型的 tools
  resourceContext: string[]         // resources 读取的内容,注入 system
}
```

**连接管理:**
- **http/sse:** 每次执行用 `@ai-sdk/mcp` 的 MCP client 新建连接(具体 API 名称以 `@ai-sdk/mcp@2.0.3` 实际导出为准,可能为 `createMCPClient` 或 `experimental_createMCPClient`),执行完关闭
- **stdio 进程池:**
  - key = `serverId`,首次使用 spawn 子进程并存入池
  - 引用计数:执行前 +1,执行后 -1
  - 空闲超时(5 分钟无引用)→ kill
  - 崩溃自动重启(≤3 次),超过则报错降级
  - 进程池在 Node 进程生命周期内常驻

**能力选择(按节点绑定):**
- `tools: "all"` → 注册该 server 所有 tools
- `tools: ["name1","name2"]` → 只注册指定 tools
- `resources: ["uri1"]` → 对每个 URI 调用 `resources/read`,内容注入 systemContext
- `prompts:` → 工作流场景无用户交互,MCP prompts 暂不使用(预留)

### 5.5 错误处理策略

| 场景 | 处理 |
|------|------|
| 扩展 ID 不存在 | warn + 跳过,不阻断 |
| Skill 附件读取失败 | warn + 跳过该附件 |
| Prompt 变量未找到 | 用 defaultValue,无默认值则留空字符串 |
| MCP 连接失败(http/sse) | warn + 跳过该 server,不阻断 |
| MCP 连接失败(stdio) | 尝试重启 ≤3 次,仍失败则 warn + 跳过 |
| MCP tool 调用超时 | 30 秒超时,返回错误给模型 |

---

## 6. UI/UX 设计

### 6.1 扩展包管理主页面

**入口:** 侧边栏新增"扩展包"导航项(与"工作流"同级),路由 `/extensions`

**布局:** 卡片网格,三个 Tab(Skills/Prompts/MCP)切换,顶部搜索 + 新建 + 上传按钮,每卡显示 name/description/tags/updatedAt,操作:编辑/导出/删除。

### 6.2 SkillEditor(技能包编辑器)

- name(≤64字符)+ description(≤1024字符,带第三人称写作指引)
- Markdown 编辑器(SKILL.md 主体)
- 附件区:拖拽上传,自动识别 reference/script 类型
- 实时字符计数

### 6.3 PromptEditor(提示词编辑器)

- name/description/category/role(system|user)/tags
- 模板内容编辑器(支持 `{{变量}}` 自动补全提示)
- 变量定义表格(name/description/required/defaultValue)
- 实时预览(用 defaultValue 渲染)

### 6.4 McpEditor(MCP 编辑器)

- transport 切换(HTTP/SSE/stdio),按类型显示对应配置区
- http/sse:url + headers(脱敏输入)
- stdio:command + args + env(脱敏输入)
- [测试连接] 按钮 → 展示 capabilitiesCache(tools/resources/prompts)
- 状态指示器(在线/离线/错误/未测试)

### 6.5 ExtensionPicker(节点配置面板中的扩展选择器)

在 `NodeConfigPanel` 的 LLM 节点配置区,现有"函数调用"开关下方新增"扩展包"折叠区:
- 三个子选择器(Skills/Prompts/MCP),点击弹出选择弹窗(列表 + 搜索 + 多选)
- MCP 选择后可展开配置 tools/resources 子选择
- 显示已选扩展名,点击 × 移除
- 工作流级默认扩展灰显提示("继承工作流默认: xxx")

---

## 7. i18n 新增 key 分组

所有新增 UI 文字必须同步添加到 `src/i18n/locales/zh.json` 和 `src/i18n/locales/en.json`:

```
extensions.title              → "扩展包" / "Extensions"
extensions.tabs.skills        → "技能包" / "Skills"
extensions.tabs.prompts       → "提示词" / "Prompts"
extensions.tabs.mcp           → "MCP 服务" / "MCP Servers"
extensions.common.create      → "新建" / "Create"
extensions.common.upload      → "上传" / "Upload"
extensions.common.export      → "导出" / "Export"
extensions.common.delete      → "删除" / "Delete"
extensions.common.search      → "搜索" / "Search"
extensions.common.confirmDelete → "确认删除?" / "Confirm delete?"
extensions.skills.*           → Skills 管理界面文案
extensions.prompts.*          → Prompts 管理界面文案
extensions.mcp.*              → MCP 管理界面文案
extensions.picker.*           → 节点配置中的扩展选择器文案
```

---

## 8. 实现检查清单

### 8.1 数据层
- [ ] Prisma schema 新增 Skill / Prompt / McpServer 三张表
- [ ] `prisma migrate dev` 生成迁移
- [ ] 新增依赖 `@ai-sdk/mcp` + `@modelcontextprotocol/sdk`

### 8.2 API 层
- [ ] Skills CRUD + upload + export
- [ ] Prompts CRUD + upload + export
- [ ] MCP CRUD + test
- [ ] 输入校验 + 文件白名单 + 路径穿越校验
- [ ] MCP headers/env 加密存储 + GET 脱敏

### 8.3 引擎层
- [ ] skill-loader.ts(≤3 全量 / >3 tool-calling)
- [ ] prompt-renderer.ts(变量替换 + role 分组)
- [ ] mcp-manager.ts(http/sse 连接 + stdio 进程池)
- [ ] llm.ts 集成扩展加载阶段
- [ ] mergeExtensions 合并逻辑
- [ ] 悬空引用处理

### 8.4 UI 层
- [ ] ExtensionLibrary 主页面 + 三个 Tab
- [ ] SkillEditor + 附件管理
- [ ] PromptEditor + 变量定义 + 预览
- [ ] McpEditor + 测试连接 + 能力预览
- [ ] ExtensionPicker(节点配置面板)
- [ ] 侧边栏新增"扩展包"导航项

### 8.5 i18n
- [ ] zh.json 新增 extensions.* 分组
- [ ] en.json 新增 extensions.* 分组
- [ ] 所有组件使用 `t()` 而非硬编码字符串

### 8.6 部署注意事项
- [ ] stdio MCP 仅自托管可用,文档标注
- [ ] `storage/` 目录需加入 `.gitignore`
- [ ] `storage/` 目录需有写入权限

---

## 9. 边界情况与决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 三类扩展数据表 | 独立三表(非多态单表) | 用户视角:边界清晰,各编辑器量身定制 |
| 绑定存储 | 复用 JSON 字段(非新建绑定表) | 与现有 Workflow.config/Node.data.config 一致,简单 |
| 绑定合并语义 | 替换(非合并) | 简单可预测,节点级非空则完全覆盖 |
| Skills 加载 | ≤3 全量 / >3 tool-calling | 平衡 token 成本与延迟,所有主流模型支持 tool calling |
| Skills 向量检索 | 不做 | Anthropic 官方机制是元数据注入 + 模型选择,非向量检索 |
| Prompt modelCompat | 删除 | 变量替换是平台层逻辑,与模型无关 |
| isPublic 字段 | 删除 | 项目无用户体系,语义不清 |
| MCP prompts | 预留不启用 | 工作流场景无用户交互 |
| 悬空引用 | warn + 跳过 | 简单健壮,不做删除时扫描清理 |
| version 字段 | 仅显示用 | 第一版不做版本历史 |
| 批量操作 | 不做 | YAGNI,与现有风格一致 |
