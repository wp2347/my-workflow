# My Workflow 发展路线设计（Roadmap）

日期：2026-08-27
状态：已与用户确认

## 1. 背景与现状

My Workflow 是类 Dify/Coze 的可视化 AI 工作流平台（Next.js 16 + React 19 + React Flow + Prisma/PostgreSQL/pgvector + BullMQ/Redis）。

已实现能力：

- 画布编辑器：9 种节点（input / llm / output / feishu / http / condition / merge / cron_trigger / music）
- 执行引擎：DAG 拓扑排序，节点级日志，扩展绑定（ExtensionBindings：Skills / Prompts / MCP）
- 技能包市场（packs：filesystem、office），`{packId}` 自动绑定
- Office MCP Server：纯 JS 实现 docx/xlsx/pptx/pdf 转换
- 输入能力：本地文件选择器、硬盘目录浏览、storage 文件列表 API
- 集成：飞书机器人（收发 + 回调）、Cron 定时（BullMQ Worker）、Webhook 触发
- 基础设施：凭据管理、RAG 数据模型（DocumentChunk.embedding 已就位）、模板库、zh/en i18n

已知薄弱点：

1. README 过时（停留在 Phase 1 三节点阶段）
2. `NodeConfigPanel.tsx` 805 行，9 种节点配置集中在一个文件
3. LLM 节点具备工具调用雏形但 maxSteps 硬编码、过程不可观测；内置天气演示工具与正式能力混杂
4. RAG 仅有数据模型，检索走 HTTP 自调用（`fetch` 自己的 `/api/rag/search`），无独立检索节点
5. 缺少控制流节点：loop/iteration、delay、code 执行
6. executor.ts 无直接测试

## 2. 目标与决策记录

本阶段目标优先级（用户确认）：

1. 补齐核心能力（Agent、RAG、代码执行）
2. 夯实工程质量（拆分大文件、补测试、更新文档）
3. 面向实际使用场景（文件批处理报告链路优先；定时资讯、飞书助手后续完善）
4. 对外发布化（多用户/鉴权/一键部署）—— **暂缓**

关键决策：

| 决策点 | 结论 |
|--------|------|
| Agent 能力形态 | **增强现有 LLM 节点**，不新增节点类型 |
| 首要场景 | 文件批量处理 → 报告导出链路；其余场景后续都要完善 |
| 路线组织 | **方案 C 混合纵切**：功能按序推进，每个 Phase 强制捆绑对应模块的质量任务 |
| 长期愿景 | 功能完善的 AI 工作流平台 |

## 3. Phase 1 —— LLM 节点 Agent 化增强（首个实施阶段）

### 3.1 功能改动（`src/engine/nodes/llm.ts`）

| 项目 | 现状 | 改为 |
|------|------|------|
| 迭代上限 | 硬编码 3~5 步 | 配置项 `maxSteps`（1~20，默认 8），面板滑块调节 |
| 工具调用日志 | 结果混在 text 里，fallback 拼接粗糙 | 每轮工具调用（名称/参数/结果摘要/耗时）记入 `ExecutionLog.steps`，历史页可展开查看 |
| 内置天气演示工具 | 与正式能力混在一起 | 移入「内置工具」分组，UI 上明确标注为示例 |
| 输出结构 | `{text, raw, model, usage}` | 增加 `toolCalls: [{name, args, summary}]` |

类型同步：`ExecutionLog` 新增可选 `steps` 字段（`src/types/workflow.ts`）；`LLMNodeConfig` 新增 `maxSteps`。

### 3.2 UI 改动

- LLM 节点配置从 `NodeConfigPanel.tsx` 拆出为独立组件（如 `panels/configs/LlmConfig.tsx`），本次仅拆 LLM 部分，其余节点由后续 Phase 各自带走
- 调试/历史面板展示工具调用步骤明细

### 3.3 测试

- `llm.test.ts` 补多步工具调用测试（mock 模型验证 maxSteps 行为、steps 记录正确性）

### 3.4 验收标准

- 跑通「filesystem MCP 列目录 → 读文件 → 总结」Agent 工作流，历史页可见每轮工具调用明细
- 新增文案同步 `zh.json` / `en.json`
- `npm run typecheck / lint / test` 全绿

## 4. Phase 2 —— RAG 知识库落地

- 知识库页面完善：文档上传（txt/md/pdf 文本抽取）→ 分块 → embedding 入库
- LLM 节点 `knowledgeId` 检索改为直接函数调用，移除对自身 `/api/rag/search` 的 HTTP 自调用
- 新增独立**知识库检索节点**（检索结果作为变量传给下游）
- 质量捆绑：`chunker.ts` / `embedding.ts` 补测试
- 前置确认：embedding 模型供应商配置（OpenAI 或兼容接口；注意 schema 为 `vector(1536)`，若换模型需同步维度）

## 5. Phase 3 —— 文件批处理场景链路

- 打通主链路：`input(file/dir)` → Agent(LLM+filesystem) → office 导出 docx/xlsx/pptx
- 模板库新增 2~3 个端到端模板（如「文件夹批量摘要报告」「表格数据洞察 pptx」）
- 输出节点导出体验打磨（本地保存路径校验、下载命名规则）

## 6. Phase 4 —— 控制流与更多节点

- loop/iteration 节点：遍历数组逐项执行下游子流程
- delay 节点
- code 节点：JS 受限沙箱（受限执行环境 + 超时控制）
- 场景扩展模板：定时资讯汇总→飞书推送、飞书对话助手链路
- 按 AGENTS.md 节点接入清单执行（8 处注册点 + zh/en 文案）

## 7. Phase 5 —— 工程收尾

- README 全面重写：真实架构（扩展系统/packs/MCP/Office/i18n/飞书/Cron）、启动命令与 package.json 实际脚本对齐
- NodeConfigPanel 完成剩余节点拆分；executor.ts 集成测试补齐
- 执行历史增强：按状态筛选、失败重跑按钮

## 8. 非目标（本期明确不做）

- 多用户/鉴权体系、生产化一键部署
- 工作流版本管理（README 中旧规划项，暂缓）
- WebSocket 流式输出改造（现有执行模式满足场景需要）
