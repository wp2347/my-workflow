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
| 节点配置组件规则 | 即日起**所有新增/改动的节点配置一律使用独立配置组件**（`panels/configs/XxxConfig.tsx`），禁止再向 NodeConfigPanel.tsx 追加内容 |
| 长期愿景 | 功能完善的 AI 工作流平台 |

每个 Phase 完成前必须通过质量门禁：`npm run typecheck` / `lint` / `test` 全绿；新增 UI 文案同步 `zh.json` / `en.json`。

## 3. Phase 1 —— LLM 节点 Agent 化增强（首个实施阶段）

### 3.1 功能改动（`src/engine/nodes/llm.ts`）

| 项目 | 现状 | 改为 |
|------|------|------|
| 迭代上限 | 硬编码 3~5 步 | 配置项 `maxSteps`（1~20，默认 8），面板滑块调节 |
| 工具调用日志 | 结果混在 text 里，fallback 拼接粗糙 | 每轮工具调用（名称/参数/结果摘要/耗时）记入 `ExecutionLog.steps`，历史页可展开查看 |
| 内置天气演示工具 | 与正式能力混在一起 | 移入「内置工具」分组，UI 上明确标注为示例 |
| 输出结构 | `{text, raw, model, usage}` | 增加 `toolCalls: [{name, args, summary}]` |

类型同步（`src/types/workflow.ts`）：
- `ExecutionLog` 新增可选 `steps?: ToolCallStep[]`，其中 `ToolCallStep = { toolName: string; argsSummary: string; resultSummary: string; durationMs: number }`（摘要超 500 字符截断，避免日志膨胀）
- `LLMNodeConfig` 新增 `maxSteps: number`

### 3.2 UI 改动

- LLM 节点配置从 `NodeConfigPanel.tsx` 拆出为独立组件 `panels/configs/LlmConfig.tsx`
- 工具调用步骤明细展示于两处：执行历史详情页（展开节点日志可见）+ 编辑器聊天调试面板

### 3.3 测试

- `llm.test.ts` 补多步工具调用测试（mock 模型验证：maxSteps 截停行为、steps 记录完整、摘要截断、无工具时不产生 steps）

### 3.4 已知限制（明确记录、本期不解决）

- 对话记忆 `conversationMemory` 为进程内 Map：dev server 重启即丢失；与 cron worker 分属不同进程不共享。列为已知限制，未来如需持久化再引入存储方案
- 内置天气工具依赖公网 wttr.in，离线环境不可用（标注为示例后可接受）

### 3.5 验收标准

- 跑通「filesystem MCP 列目录 → 读文件 → 总结」Agent 工作流，历史页与聊天调试面板均可见每轮工具调用明细
- 质量门禁全绿（见第 2 节质量门禁定义）

## 4. Phase 2 —— RAG 知识库落地

- 知识库页面完善：文档上传（txt/md/pdf 文本抽取）→ 分块 → embedding 入库
- LLM 节点 `knowledgeId` 检索改为直接函数调用，移除对自身 `/api/rag/search` 的 HTTP 自调用
- 新增独立**知识库检索节点**（检索结果作为变量传给下游），配置使用独立组件（见第 2 节规则）
- 质量捆绑：`chunker.ts` / `embedding.ts` 补测试

前置决策点：

- **embedding 模型**：默认 OpenAI text-embedding-3-small（1536 维，与现有 schema 匹配）；若用户选择其他维度模型，需同步修改 schema 向量维度并重建已有向量数据（需 db push + 重新入库）
- **向量索引**：数据量 <1 万条时用 pgvector 精确扫描即可；超过后评估建 HNSW 索引（本期不建）

验收标准：上传一篇 txt 文档完成入库并可被检索节点召回；LLM 节点绑 knowledgeId 后回答能引用文档内容；质量门禁全绿。

## 5. Phase 3 —— 文件批处理场景链路

- 打通主链路：`input(file/dir)` → Agent(LLM+filesystem) → office 导出 docx/xlsx/pptx
- 模板库新增 2~3 个端到端模板（如「文件夹批量摘要报告」「表格数据洞察 pptx」）
- 输出节点导出体验打磨（本地保存路径校验、下载命名规则）

验收标准：从模板一键创建工作流，选中本地文件夹跑通完整链路并产出可打开的 office 文件；质量门禁全绿。

## 6. Phase 4 —— 控制流与更多节点

- loop/iteration 节点：遍历数组逐项执行下游子流程。**必须定义**：数组来源（上游输出取值路径表达式）、最大迭代上限（硬编码上限如 1000，防止死循环/资源失控）、逐项结果如何聚合传给下游
- delay 节点：延时范围限制（如最大 5 分钟）
- code 节点：JS 执行。**风险声明**：基于 `new Function` 的隔离不是真沙箱，仅做轻量保护（超时控制 + 禁止 require/process 访问的静态检查）。若未来需要强隔离再迁移 worker_threads 或 isolated-vm，本期不引入新依赖
- 场景扩展模板：定时资讯汇总→飞书推送、飞书对话助手链路
- 按 AGENTS.md 节点接入清单执行（8 处注册点 + zh/en 文案）；三种新节点的配置表单均直接建在 `panels/configs/` 下独立文件

验收标准：三个新节点各有模板或示例工作流可跑通；loop 在超过迭代上限时正确报错而非挂死；质量门禁全绿。

## 7. Phase 5 —— 工程收尾

- README 全面重写：真实架构（扩展系统/packs/MCP/Office/i18n/飞书/Cron）、启动命令与 package.json 实际脚本对齐
- NodeConfigPanel 存量节点全部迁出为独立配置组件后移除该大文件；executor.ts 集成测试补齐
- 执行历史增强：按状态筛选、失败重跑按钮

验收标准：NodeConfigPanel.tsx 拆分完毕删除；README 描述与实际代码结构一致（抽查节点列表、目录树、脚本说明均准确）；质量门禁全绿。

## 8. 非目标（本期明确不做）

- 多用户/鉴权体系、生产化一键部署
- 工作流版本管理（README 中旧规划项，暂缓）
- WebSocket 流式输出改造（现有执行模式满足场景需要）
