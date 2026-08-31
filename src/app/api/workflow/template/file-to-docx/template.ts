import type { Template } from "../types"

const I18N = {
  zh: {
    name: "本地文件生成 Word 报告",
    description: "读取 storage 目录下的文件，由 AI 生成 Word 报告",
    labelInput: "报告主题",
    labelLLM: "AI 撰写",
    labelOutput: "输出结果",
    prompt: "你是文档撰写助手。请完成以下任务：\n1. 用户输入中包含一个本地路径（storage/ 目录下的文件或文件夹）。如果是文件夹，先用 filesystem 的 list_directory 查看目录，再用 read_file 读取其中相关文件；如果是文件，直接用 read_file 读取。\n2. 基于读取到的内容，结合用户给出的报告主题，撰写一份结构清晰的 Word 报告（Markdown 格式，含标题层级、列表、表格）。\n3. 调用 office 的 create_docx 工具，参数 markdown 传你撰写的报告内容，outputPath 传 storage/export/报告-<日期>.docx。\n4. 用一句话告知生成的文件路径。",
  },
  en: {
    name: "Local Files to Word Report",
    description: "Read files under storage/ and generate a Word report with AI",
    labelInput: "Report Topic",
    labelLLM: "AI Writer",
    labelOutput: "Output",
    prompt: "You are a document writing assistant. Do the following:\n1. The user input contains a local path under storage/ (a file or a folder). If it is a folder, use the filesystem list_directory tool to inspect it, then read_file the relevant files inside. If it is a file, read it directly with read_file.\n2. Based on the content, write a well-structured Word report (Markdown with headings, lists, tables).\n3. Call the office create_docx tool: markdown = your report content, outputPath = storage/export/report-<date>.docx.\n4. Reply with one sentence stating the generated file path.",
  },
}

export function buildFileToDocxTemplate(lang: string): Template {
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
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "filesystem" }, { packId: "office" }],
            prompts: [],
            mcp: [{ packId: "filesystem" }, { packId: "office" }],
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
