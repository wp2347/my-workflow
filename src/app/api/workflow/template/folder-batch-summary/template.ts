import type { Template } from "../types"

const I18N = {
  zh: {
    name: "文件夹批量摘要报告",
    description: "遍历本地文件夹中的所有文档，逐个摘要后汇总生成 Word 报告",
    labelInput: "文件夹路径",
    labelLLM: "AI 批量摘要",
    labelOutput: "输出结果",
    prompt: `你是文档批量分析助手。请严格按以下步骤执行：
1. 用户输入包含一个本地文件夹路径。调用 filesystem 的 list_directory 工具列出该文件夹下的全部文件（如工具支持递归/子目录，也一并覆盖）。
2. 对其中每个文档文件依次调用 read_file 读取内容，并为每个文件写一段 2-4 句话的中文摘要。
3. 全部文件处理完后，汇总撰写一份报告（Markdown 格式），结构为：
   # 文件夹内容摘要报告
   ## 概览
   （共 N 个文件，一句话总体结论）
   ## 各文件摘要
   ### <文件名>
   <摘要>
4. 调用 office 的 create_docx 工具：markdown 传完整报告，outputPath 传 storage/export/批量摘要-<当天日期>.docx。
5. 用一句话回复生成的报告路径与处理的文件数量。`,
  },
  en: {
    name: "Folder Batch Summary Report",
    description: "Walk every document in a local folder, summarize each, and compile a Word report",
    labelInput: "Folder Path",
    labelLLM: "AI Batch Summarizer",
    labelOutput: "Output",
    prompt: `You are a document batch analysis assistant. Follow these steps strictly:
1. The user input contains a local folder path. Call the filesystem list_directory tool to list all files in that folder (cover subdirectories if the tool supports recursion).
2. For each document file, call read_file to load its content and write a 2-4 sentence summary per file.
3. After processing all files, compile a report (Markdown) structured as:
   # Folder Summary Report
   ## Overview
   (N files processed, one-sentence conclusion)
   ## Per-file Summaries
   ### <filename>
   <summary>
4. Call the office create_docx tool: markdown = full report, outputPath = storage/export/batch-summary-<date>.docx.
5. Reply with one sentence stating the report path and number of files processed.`,
  },
}

export function buildFolderBatchSummaryTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 220 },
        data: { type: "input", label: i.labelInput, config: { name: "message", type: "file", required: true } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.3,
          maxSteps: 12,
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
