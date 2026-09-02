import type { Template } from "../types"

const I18N = {
  zh: {
    name: "表格数据洞察 PPT",
    description: "读取本地表格（xlsx/csv），AI 分析数据洞察并生成 PPT 演示文稿",
    labelInput: "表格文件路径",
    labelLLM: "AI 数据分析师",
    labelOutput: "输出结果",
    prompt: `你是数据分析演示顾问。请严格按以下步骤执行：
1. 用户输入包含一个本地表格文件路径（xlsx/csv）。用 filesystem 的 read_file 读取它；如内容是二进制/乱码，改用 list_directory 确认文件名后重试，或如实告知无法解析。
2. 基于数据完成分析，产出洞察：
   - 数据概览（行数、列、字段含义）
   - 3-5 条关键发现（含具体数字支撑）
   - 1-2 条行动建议
3. 将上述内容整理为 PPT 大纲（Markdown 格式）：封面标题 → 数据概览页 → 关键发现页（每页一个重点）→ 建议页。
4. 调用 office 的 create_pptx 工具：markdown 传大纲内容，outputPath 传 storage/export/数据洞察-<当天日期>.pptx。
5. 用一句话回复生成的文件路径与最重要的发现。`,
  },
  en: {
    name: "Spreadsheet Insights to PPT",
    description: "Read a local spreadsheet (xlsx/csv), let AI analyze insights and generate a slide deck",
    labelInput: "Spreadsheet Path",
    labelLLM: "AI Data Analyst",
    labelOutput: "Output",
    prompt: `You are a data analysis presentation consultant. Follow these steps strictly:
1. The user input contains a local spreadsheet path (xlsx/csv). Read it with the filesystem read_file tool; if the content is binary/garbled, verify with list_directory and retry, or honestly state it cannot be parsed.
2. Analyze the data and produce insights:
   - Data overview (rows, columns, field meanings)
   - 3-5 key findings (supported by concrete numbers)
   - 1-2 actionable recommendations
3. Organize into a slide outline (Markdown): cover title → overview page → key findings pages (one point per page) → recommendations page.
4. Call the office create_pptx tool: markdown = outline content, outputPath = storage/export/data-insights-<date>.pptx.
5. Reply with one sentence stating the file path and the most important finding.`,
  },
}

export function buildXlsxDataInsightTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "file", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.4,
          maxSteps: 10,
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "filesystem" }, { packId: "office" }],
            prompts: [],
            mcp: [{ packId: "filesystem" }, { packId: "office" }],
          },
        } } },
      { id: "output-1", type: "output", position: { x: 580, y: 220 },
        data: { type: "output", label: i.labelOutput, config: { format: "markdown", template: "{{ $node.llm-1.text }}", exportMode: "local", exportPath: "storage/export/" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "output-1" },
    ],
  }
}
