import type { Template } from "../types"

const I18N = {
  zh: {
    name: "数据生成 Excel 报表",
    description: "把输入数据整理成表格，AI 生成 Excel 报表",
    labelInput: "数据描述",
    labelLLM: "AI 整理",
    labelOutput: "输出结果",
    prompt: "你是数据分析助手。请完成：\n1. 根据用户对数据的描述，把数据整理成 JSON 数组（每项是一个对象，键为列名）。\n2. 调用 office 的 create_xlsx 工具：rows 传该 JSON 数组，outputPath 传 storage/export/报表-<日期>.xlsx。\n3. 用一句话告知生成的文件路径和行列数。",
  },
  en: {
    name: "Data to Excel Report",
    description: "Turn described data into a spreadsheet and generate an Excel file with AI",
    labelInput: "Data Description",
    labelLLM: "AI Organizer",
    labelOutput: "Output",
    prompt: "You are a data analyst assistant. Do the following:\n1. Turn the user's described data into a JSON array (each item an object whose keys are column names).\n2. Call the office create_xlsx tool: rows = that JSON array, outputPath = storage/export/report-<date>.xlsx.\n3. Reply with one sentence stating the file path and row/column counts.",
  },
}

export function buildDataToXlsxTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "text", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.3,
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
