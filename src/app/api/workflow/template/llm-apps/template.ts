import type { Template } from "../types"

const I18N = {
  zh: {
    name: "智能翻译助手",
    description: "输入任意文本，AI 自动翻译成目标语言",
    labelInput: "待翻译文本",
    labelLLM: "AI 翻译",
    labelOutput: "翻译结果",
  },
  en: {
    name: "AI Translation Assistant",
    description: "Input any text and get AI-powered translation",
    labelInput: "Text to Translate",
    labelLLM: "AI Translate",
    labelOutput: "Result",
  },
}

export function buildLlmAppsTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "text", type: "text", required: true, default: "Hello world, how are you?" } } },
      { id: "llm-1", type: "llm", position: { x: 380, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek",
          model: "deepseek-chat",
          systemPrompt: "你是专业翻译。将用户提供的文本翻译成简体中文。只输出翻译结果，不要任何解释或额外内容。",
          temperature: 0.3,
        } } },
      { id: "output-1", type: "output", position: { x: 660, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "", exportMode: "download", exportPath: "storage/exports/", remoteUrl: "" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "output-1" },
    ],
  }
}
