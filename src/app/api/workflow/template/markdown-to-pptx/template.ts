import type { Template } from "../types"

const I18N = {
  zh: {
    name: "大纲生成 PPT",
    description: "输入主题，AI 生成 Markdown 大纲并输出 PPT 文件",
    labelInput: "演讲主题",
    labelLLM: "AI 制作",
    labelOutput: "输出结果",
    prompt: "你是演示文稿助手。请完成：\n1. 根据用户的演讲主题，生成一份 Markdown 大纲：每个 # 顶级标题是一页幻灯片，- 列表项是页面要点。\n2. 调用 office 的 create_pptx 工具：outline 传该大纲，outputPath 传 storage/export/演示-<日期>.pptx。\n3. 用一句话告知生成的文件路径和页数。",
  },
  en: {
    name: "Outline to PPT",
    description: "Enter a topic, AI generates a Markdown outline and a PPT file",
    labelInput: "Talk Topic",
    labelLLM: "AI Deck Builder",
    labelOutput: "Output",
    prompt: "You are a presentation assistant. Do the following:\n1. Create a Markdown outline for the user's topic: each # top-level heading is one slide, - list items become slide bullets.\n2. Call the office create_pptx tool: outline = that Markdown, outputPath = storage/export/deck-<date>.pptx.\n3. Reply with one sentence stating the file path and slide count.",
  },
}

export function buildMarkdownToPptxTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "text", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.5,
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "office" }],
            prompts: [],
            mcp: [{ packId: "office" }],
          },
        } } },
      { id: "output-1", type: "output", position: { x: 580, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "{{ $node.llm-1.text }}" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "output-1" },
    ],
  }
}
