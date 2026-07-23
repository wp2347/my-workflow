# 音乐生成工作流设计

> 日期：2026-07-23
> 状态：已定稿，待用户审阅

## 目标

用户输入提示词（含风格描述），工作流自动调用用户配置的音乐生成 API 生成符合该风格的音频，用户可在输出节点设置导出地址。提供预置 3 节点工作流模板（input → music → output），并在执行历史详情页支持「预览 / 下载 / 清空」操作。

## 范围

- 新增 `music` 节点类型：封装通用的音乐生成 API 调用（用户自填 URL/Body/认证），支持异步轮询。
- 增强 `output` 节点：新增导出模式配置（download / local / remote）。
- 执行历史详情页新增 `AudioResultCard` 组件：音频播放器预览 + 元信息展示 + 触发下载 + 清空服务端临时文件。
- 提供预置模板 API 与「新建工作流」页入口，一键初始化音乐生成工作流。

非目标（本次不做）：
- 不集成特定音乐服务商（Suno/Udio 等），节点保持通用。
- 不做 LLM → music 的两段式生成；提示词直接由 input 节点传入 music 节点。
- 不实现 File System Access API（用户已选「触发下载」方案）。
- 不改造现有执行历史列表页与分页。

## 架构

### 数据流

```
input(text: prompt)  ──►  music(API 调用 + 可选轮询 + 服务端落盘)  ──►  output(导出模式处理)
   │                          │                                          │
   │                          ▼                                          ▼
   └─ 用户填写提示词       返回 { audioUrl, localPath, metadata, raw }   按 exportMode: download(返回信息供前端下载) / local(复制到 exportPath) / remote(POST 到 remoteUrl)
```

### 节点结果约定（关键）

为保证不破坏 `findFinalOutput` 与现有 output 节点消费者，所有扩展字段均为**可选追加**，原字段保留：

- music 节点返回：`{ audioUrl: string, localPath: string, metadata: Record<string, unknown>, raw: string }`
  - `audioUrl`：服务端流式播放 URL（`/api/music/file?executionId=...&nodeId=...`）
  - `localPath`：服务端绝对路径（`storage/music/<executionId>_<nodeId>.<ext>`）
  - `metadata`：从 API 响应提取的元信息（标题/时长/风格等，原样透传）
  - `raw`：JSON.stringify(audioUrl + metadata)，供 output 模板占位符替换与现有 `obj.raw` 消费逻辑使用
- output 节点返回（扩展）：`{ output, raw, format, audioUrl?, fileName?, metadata? }`
  - 原三项保留不变
  - 当上游存在 music 节点结果时，追加 `audioUrl/fileName/metadata`

## 组件设计

### 1. music 节点

**类型定义** (`src/types/workflow.ts`)

```ts
export interface MusicNodeConfig {
  apiUrl: string                  // 音乐生成 API 地址
  method: "POST" | "GET"
  headers: Record<string, string>
  bodyTemplate: string            // 支持 {{prompt}}、{{style}}、{{duration}} 占位符
  auth: "none" | "bearer" | "api_key"
  authToken: string
  // 异步轮询
  pollingEnabled: boolean
  taskIdField: string             // 从首次响应提取 task_id 的路径，如 "data.task_id"
  pollUrlTemplate: string         // 如 https://api.xxx.com/tasks/{{taskId}}
  pollIntervalMs: number          // 默认 3000
  pollMaxAttempts: number         // 默认 60
  // 结果提取
  audioUrlField: string           // 从轮询完成响应提取音频 URL 的路径，如 "data.audio_url"
  metadataField: string           // 可选，提取元信息对象路径，如 "data.metadata"
}
```

**执行器** (`src/engine/nodes/music.ts`)

1. 从 `context.input` 读取 `prompt`/`style`/`duration`，替换 `bodyTemplate` 占位符。
2. 按 `auth` 注入认证头，调用 `apiUrl`。
3. 若 `pollingEnabled`：
   - 从首次响应按 `taskIdField`（支持 `a.b.c` 点路径）提取 `taskId`。
   - 用 `pollUrlTemplate.replace("{{taskId}}", taskId)` 构造轮询 URL，按 `pollIntervalMs` 间隔 GET，直到响应中 `audioUrlField` 有值或达到 `pollMaxAttempts`（超时抛错）。
4. 从最终响应按 `audioUrlField` 取得远程音频 URL，按 `metadataField`（可选）取 metadata。
5. fetch 远程音频，根据响应 `Content-Type`（`audio/mpeg`→`.mp3`、`audio/wav`→`.wav`、`audio/ogg`→`.ogg`）或 URL 后缀动态推断扩展名；无明确信息时默认 `.mp3`。
6. 写入服务端 `storage/music/<executionId>_<nodeId>.<ext>`（目录不存在则递归创建）。
7. 返回 `{ audioUrl: "/api/music/file?executionId=...&nodeId=...", localPath, metadata, raw: JSON.stringify({ audioUrl, metadata }) }`。

**节点 UI** (`src/components/nodes/MusicNode.tsx`)：仿 `HttpNode.tsx`，展示节点类型图标 + 标题 + apiUrl 摘要。

**配置面板** (`NodeConfigPanel.tsx` 新增 music 分支)：API URL / Method / Headers(JSON textarea) / Body 模板（含占位符提示 `{{prompt}}` `{{style}}` `{{duration}}`）/ 认证（复用 HTTP 节点三种模式）/ 折叠区「异步轮询」(pollingEnabled 开关 + taskIdField + pollUrlTemplate 含提示 `https://api.xxx.com/tasks/{{taskId}}` + pollIntervalMs + pollMaxAttempts) / 折叠区「结果提取」(audioUrlField + metadataField)。

### 2. output 节点增强

**类型扩展** (`OutputNodeConfig`)

```ts
export interface OutputNodeConfig {
  format: "text" | "json" | "markdown"
  template?: string
  exportMode: "download" | "local" | "remote"   // 新增，默认 "download"
  exportPath: string                            // 新增，local 模式导出目录，默认 "storage/exports/"
  remoteUrl: string                             // 新增，remote 模式上传目标 URL
}
```

**执行器增强** (`src/engine/nodes/output.ts`)

- 现有文本汇聚逻辑保留。
- 遍历 `context.nodeResults` 找上游 music 节点结果（含 `audioUrl` 字段的对象）。
- 按 `exportMode`：
  - `download`（默认）：不额外处理，仅把 `audioUrl/fileName/metadata` 透传到返回值，前端历史详情页据此触发下载。
  - `local`：复制 `localPath` 到 `exportPath/<executionId>.<ext>`（目录不存在则创建）。
  - `remote`：读取 `localPath` 文件，POST 到 `remoteUrl`（multipart/form-data，字段名 `file`）。
- 返回 `{ output, raw, format, audioUrl?, fileName?, metadata? }`（仅当存在上游 music 结果时追加后三项）。

**配置面板增强** (`NodeConfigPanel.tsx` output 分支)：现有 format/template 下方新增「导出设置」折叠区：exportMode 单选(下载到本地/保存到服务器目录/上传到远程 URL) + 条件字段（local 显示 exportPath 输入；remote 显示 remoteUrl 输入）。

### 3. AudioResultCard 组件

**位置**：`src/components/panels/AudioResultCard.tsx`

**Props**：`{ executionId: string, nodeId: string, audioUrl: string, fileName: string, metadata: Record<string, unknown> }`

**功能**：
- **预览**：`<audio controls src={audioUrl}>` 播放器 + 元信息卡片（遍历 metadata 键值展示；已知字段标题/时长/风格做友好渲染，其余原样）。
- **下载**：`<a href={audioUrl} download={fileName}>` 触发浏览器下载。
- **清空**：`DELETE /api/music/file?executionId=...&nodeId=...`，成功后 `onCleared` 回调让父组件卸载本卡片。

**挂载点**：`src/app/(dashboard)/history/[id]/page.tsx` 的 log 渲染逻辑。当 `log.nodeType === "music"` 或（`log.nodeType === "output"` 且 `log.output.audioUrl` 存在）时，用 `<AudioResultCard>` 取代当前通用 `<details>` 折叠输出区。其他节点类型保持现有渲染。

### 4. 预置模板

**API** (`src/app/api/workflow/template/music/route.ts`, GET)：返回模板 JSON：

```jsonc
{
  "name": "音乐生成模板",
  "description": "输入提示词自动生成音乐并导出",
  "nodes": [
    { "id": "input-1", "type": "input", "position": { "x": 100, "y": 200 },
      "data": { "type": "input", "label": "提示词", "config": { "name": "prompt", "type": "text", "required": true, "default": "" } } },
    { "id": "music-1", "type": "music", "position": { "x": 400, "y": 200 },
      "data": { "type": "music", "label": "音乐生成", "config": { /* MusicNodeConfig 默认值 */ } } },
    { "id": "output-1", "type": "output", "position": { "x": 700, "y": 200 },
      "data": { "type": "output", "label": "导出", "config": { "format": "text", "template": "", "exportMode": "download", "exportPath": "storage/exports/", "remoteUrl": "" } } }
  ],
  "edges": [
    { "id": "e1", "source": "input-1", "target": "music-1" },
    { "id": "e2", "source": "music-1", "target": "output-1" }
  ]
}
```

**入口**：`src/app/(dashboard)/workflows/page.tsx` 顶部「新建工作流」按钮旁新增「音乐生成模板」按钮。点击 → fetch 模板 API → 用结果调 `useWorkflowStore.setWorkflow` 初始化 → 跳转 `/workflow/new`。复用现有 new 页面的「保存时 POST」逻辑。

### 5. 文件服务 API

`src/app/api/music/file/route.ts`

- **GET** `?executionId=...&nodeId=...`：根据参数定位 `storage/music/<executionId>_<nodeId>.<ext>`（glob 匹配扩展名），以 `Content-Type: audio/<ext>` 流式返回。用于预览播放与下载。
- **DELETE** `?executionId=...&nodeId=...`：删除上述文件，返回 `{ ok: true }`。用于「清空」。

### 6. 节点注册（遵循 AGENTS.md 清单）

1. `src/types/workflow.ts` — `NodeType` 加 `"music"`；新增 `MusicNodeConfig`；`OutputNodeConfig` 加三字段。
2. `src/components/nodes/MusicNode.tsx` — 新建节点 UI。
3. `src/components/canvas/Canvas.tsx` — `nodeTypes` 注册 `music`；`getDefaultConfig` 加 `case "music"` 返回默认 `MusicNodeConfig`。
4. `src/components/canvas/NodePanel.tsx` — `nodeList` 加 music 项；`iconMap` 加 `Music` 图标（来自 lucide-react）。
5. `src/components/panels/NodeConfigPanel.tsx` — music 配置分支 + output 导出设置折叠区。
6. `src/engine/nodes/music.ts` — 新建执行器。
7. `src/engine/executor.ts` — `nodeExecutors` 注册 `music: executeMusicNode`。
8. `src/components/panels/AudioResultCard.tsx` — 新建组件。
9. `src/app/api/workflow/template/music/route.ts` — 新建模板 API。
10. `src/app/api/music/file/route.ts` — 新建文件服务 API。
11. `src/app/(dashboard)/history/[id]/page.tsx` — log 渲染集成 `AudioResultCard`。
12. `src/app/(dashboard)/workflows/page.tsx` — 模板入口按钮。
13. `src/i18n/locales/zh.json` + `en.json` — 所有新增文案。

## i18n 文案清单

按 `music.*` 与 `config.music*` 与 `audioResult.*` 分组，中英文同步：

- `canvas.music` / `canvas.musicDesc`
- `config.musicApiUrl` / `config.musicMethod` / `config.musicHeaders` / `config.musicBody` / `config.musicBodyHint`（提示可用 `{{prompt}}` `{{style}}` `{{duration}}`）/ `config.musicAuth`
- `config.musicPolling` / `config.musicPollingHint` / `config.musicTaskIdField` / `config.musicPollUrl` / `config.musicPollUrlHint`（`https://api.xxx.com/tasks/{{taskId}}`）/ `config.musicPollInterval` / `config.musicPollMaxAttempts`
- `config.musicResultExtract` / `config.musicAudioUrlField` / `config.musicMetadataField`
- `config.exportSettings` / `config.exportMode` / `config.exportDownload` / `config.exportLocal` / `config.exportRemote` / `config.exportPath` / `config.exportPathHint` / `config.remoteUrl`
- `audioResult.preview` / `audioResult.download` / `audioResult.clear` / `audioResult.clearing` / `audioResult.cleared` / `audioResult.noMetadata` / `audioResult.title` / `audioResult.duration` / `audioResult.style`
- `workflows.musicTemplate` / `workflows.musicTemplateDesc`

## 错误处理

- music 节点 API 调用失败：抛错，由 executor 现有重试机制处理（节点配置 `maxRetries/retryDelay` 复用）。
- 轮询超时（达到 `pollMaxAttempts` 仍无 audioUrl）：抛 `Music generation polling timed out`。
- 远程音频下载失败：抛错并提示上游 API 返回的 URL 不可达。
- output 的 remote 上传失败：抛错，由重试机制处理。
- AudioResultCard 清空 API 失败：toast 提示错误，卡片不隐藏。

## 测试要点

- music 执行器：mock fetch 验证占位符替换、轮询循环、扩展名推断、文件落盘。
- output 执行器：mock 上游 music 结果，验证三种 exportMode 分支与返回结构扩展不破坏原字段。
- AudioResultCard：mock DELETE API，验证清空后卸载。
- 模板 API：快照测试返回结构。
- 文件服务 API：tmp 目录验证 GET/DELETE。

## 不确定项

- 远程音频 URL 可能需要鉴权才能下载：当前 music 执行器用无鉴权 fetch 拉取。若用户的音乐 API 返回带签名时效 URL（常见），无需鉴权；若需要，后续可加 `audioDownloadHeaders` 配置。本次不做。
