import type { Template } from "../types"

const I18N = {
  zh: {
    name: "智能客服分流",
    description: "根据问题关键词智能分流：技术问题转技术客服，其余转通用回复",
    labelInput: "用户问题",
    labelLLM: "意图判断",
    labelCond: "分流判断",
    labelTech: "技术客服",
    labelGeneral: "通用回复",
    labelMerge: "汇聚",
    labelOutput: "回复结果",
  },
  en: {
    name: "Smart Support Routing",
    description: "Route questions by intent: technical issues to tech support, others to general reply",
    labelInput: "User Question",
    labelLLM: "Intent Detect",
    labelCond: "Route",
    labelTech: "Tech Support",
    labelGeneral: "General Reply",
    labelMerge: "Merge",
    labelOutput: "Reply",
  },
}

export function buildSupportRoutingTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "question", type: "text", required: true, default: "我的 API 密钥失效了怎么办？" } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek",
          model: "deepseek-chat",
          systemPrompt: "判断用户问题是否属于技术问题（涉及 API、代码、报错、密钥、接口、服务器等）。只输出 true 或 false。",
          temperature: 0,
        } } },
      { id: "cond-1", type: "condition", position: { x: 580, y: 220 },
        data: { type: "condition", label: i.labelCond, config: {
          left: "{{ llm-1.raw }}",
          operator: "==",
          right: "true",
        } } },
      { id: "llm-tech", type: "llm", position: { x: 800, y: 120 },
        data: { type: "llm", label: i.labelTech, config: {
          provider: "deepseek",
          model: "deepseek-chat",
          systemPrompt: "你是技术客服。用中文给出清晰、可操作的技术问题解决方案。",
          temperature: 0.4,
        } } },
      { id: "llm-general", type: "llm", position: { x: 800, y: 340 },
        data: { type: "llm", label: i.labelGeneral, config: {
          provider: "deepseek",
          model: "deepseek-chat",
          systemPrompt: "你是客服。用中文礼貌、友好地回答用户的一般性问题。",
          temperature: 0.5,
        } } },
      { id: "merge-1", type: "merge", position: { x: 1040, y: 220 },
        data: { type: "merge", label: i.labelMerge, config: { strategy: "last" } } },
      { id: "output-1", type: "output", position: { x: 1280, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "", exportMode: "download", exportPath: "storage/exports/", remoteUrl: "" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "cond-1" },
      { id: "e3", source: "cond-1", target: "llm-tech", sourceHandle: "true" },
      { id: "e4", source: "cond-1", target: "llm-general", sourceHandle: "false" },
      { id: "e5", source: "llm-tech", target: "merge-1" },
      { id: "e6", source: "llm-general", target: "merge-1" },
      { id: "e7", source: "merge-1", target: "output-1" },
    ],
  }
}
