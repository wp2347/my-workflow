# My Workflow 发展路线设计（Roadmap）

日期：2026-08-27
状态：已与用户确认

## 1. 背景与现状

My Workflow 是类 Dify/Coze 的可视化 AI 工作流平台（Next.js 16 + React 19 + React Flow + Prisma/PostgreSQL/pgvector + BullMQ/Redis）。

已实现能力：

- 画布编辑器：13 种节点（input / llm / output / feishu / http / condition / merge / cron_trigger / music / knowledge_search / code / delay / loop）
- 执行引擎：DAG 拓扑排序，节点级日志，扩展绑定（ExtensionBindings：Skills / Prompts / MCP）
- 技能包市场（packs：filesystem、office），`{packId}` 自动绑定
- Office MCP Server：纯 JS 实现 docx/xlsx/pptx/pdf 转换
- 输入能力：本地文件选择器、硬盘目录浏览、storage 文件列表 API
- 集成：飞书机器人（收发 + 回调）、Cron 定时（BullMQ Worker）、Webhook 触发
- 基础设施：凭据管理、RAG 数据模型、模板库（11 套）、zh/en i18n
- 控制流：loop（硬上限 1000）/ delay / code（worker 超时强杀）

## 2. 目标与决策记录

本阶段目标优先级（用户确认）：

1. 补齐核心能力（Agent、RAG、代码执行）—— ✅ 完成（Phase 1-4）
2. 夯实工程质量（拆分大文件、补测试、更新文档）—— ✅ 完成（Phase 5）
3. 面向实际使用场景（文件批处理报告链路优先；定时资讯、飞书助手后续完善）—— ⏳ 进行中
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

## 3-7. Phase 1-5（已完成，见 git log）

Phase 1 LLM Agent 化 / Phase 2 RAG / Phase 3 文件批处理 / Phase 4 控制流 / Phase 5 工程收尾 均已实现并合入 `feature/music-templates` 分支（PR #1）。详见 README「发展路线」勾选清单。

## 8. Phase 6 —— 场景深化（进行中）

用户总结：「功能完善的、能结合 AI 的工作流项目」。在核心能力齐备后，本阶段聚焦两条真实链路的端到端打磨：

### 8.1 飞书对话助手链路

**目标**：飞书群里 @机器人 → 触发工作流 → Agent 检索/推理 → 回复到群里。

- 现状：Feishu 节点支持 send/receive 两种模式，`/api/feishu/callback` 已存在；但 **receive 模式的「收到消息 → 自动执行工作流 → 回发」闭环未验证/未模板化**。
- 计划：
  - 探明 callback 当前行为（解析消息 → 是否已映射到 workflow run）
  - 补全 receive 模式闭环：消息体 → workflow 输入 → 执行 → 用 send 回发
  - 新建模板「飞书对话助手」
  - 质量捆绑：feishu 执行器/回调的测试

### 8.2 定时资讯汇总推送链路

**目标**：每天固定时间抓取资讯/数据 → LLM 汇总 → 飞书推送摘要。

- 现状：cron_trigger + http + llm + feishu(send) 节点俱备，无端到端模板。
- 计划：
  - 新建模板「定时资讯汇总推送」
  - 验证 Cron 触发 → 执行 → 推送闭环

## 9. 非目标（仍明确不做）

- 多用户/鉴权体系、生产化一键部署
- 工作流版本管理
- WebSocket 流式输出改造