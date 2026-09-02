import type { Template } from "../types"

const I18N = {
  zh: {
    name: "多模型对比",
    description: "同一问题同时发给两个 AI 模型，汇聚展示两种回答",
    labelInput: "问题",
    labelLLM1: "模型 A",
    labelLLM2: "模型 B",
    labelMerge: "汇聚结果",
    labelOutput: "对比输出",
  },
  en: {
    name: "Multi-Model Comparison",
    description: "Send the same question to two AI models and compare answers",
    labelInput: "Question",
    labelLLM1: "Model A",
    labelLLM2: "Model B",
    labelMerge: "Merge",
    labelOutput: "Output",
  },
}

export function buildModelCompareTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "question", type: "text", required: true, default: "介绍人工智能的历史" } } },
      { id: "llm-1", type: "llm", position: { x: 380, y: 140 },
        data: { type: "llm", label: i.labelLLM1, config: {
          provider: "deepseek",
          model: "deepseek-chat",
          systemPrompt: "你是乐于助人的助手，请用中文简洁回答用户问题。",
          temperature: 0.7,
        } } },
      { id: "llm-2", type: "llm", position: { x: 380, y: 340 },
        data: { type: "llm", label: i.labelLLM2, config: {
          provider: "openai",
          model: "gpt-4o-mini",
          systemPrompt: "You are a helpful assistant. Answer the user's question concisely in Chinese.",
          temperature: 0.7,
        } } },
      { id: "merge-1", type: "merge", position: { x: 680, y: 240 },
        data: { type: "merge", label: i.labelMerge, config: { strategy: "concat" } } },
      { id: "output-1", type: "output", position: { x: 940, y: 240 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "", exportMode: "download", exportPath: "storage/exports/", remoteUrl: "" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "input-1", target: "llm-2" },
      { id: "e3", source: "llm-1", target: "merge-1" },
      { id: "e4", source: "llm-2", target: "merge-1" },
      { id: "e5", source: "merge-1", target: "output-1" },
    ],
  }
}
