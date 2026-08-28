import type { Template } from "../types"

const I18N = {
  zh: {
    name: "飞书对话助手",
    description: "飞书群里 @机器人即可获得带工具能力的 AI 助手（可总结文件、生成报告）",
    labelReceive: "接收消息",
    labelLLM: "AI 助手",
    labelSend: "回复消息",
    prompt: `你是部署在飞书群里的 AI 助手。请遵循：
1. 用户消息会作为唯一输入传入。
2. 回答时保持简洁友好，中文为主。若用户要求读取或处理文件，使用 filesystem 的 list_directory / read_file 工具访问 storage/ 目录下的文件。
3. 若用户要求生成报告/表格/演示文稿，用 office 的 create_docx / create_xlsx / create_pptx 工具生成，并在回复中告知文件路径。
4. 直接输出要发送给用户的最终回复内容即可（不要输出工具调用以外的解释性文本，因为该文本会原样发到群里）。`,
  },
  en: {
    name: "Feishu Chat Assistant",
    description: "A tool-capable AI assistant that answers when @mentioned in a Feishu group (summarize files, create reports)",
    labelReceive: "Receive",
    labelLLM: "AI Assistant",
    labelSend: "Reply",
    prompt: `You are an AI assistant deployed in a Feishu group chat. Guidelines:
1. The user message is passed in as the only input.
2. Keep answers concise and friendly. If the user asks to read or process files, use the filesystem list_directory / read_file tools to access files under storage/.
3. If the user asks for a report/table/slides, generate it with the office create_docx / create_xlsx / create_pptx tools and mention the file path in your reply.
4. Output only the final reply text to send to the user (no meta commentary), because it is sent to the group verbatim.`,
  },
}

export function buildFeishuAssistantTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "feishu-receive", type: "feishu", position: { x: 100, y: 80 },
        data: { type: "feishu", label: i.labelReceive, config: { mode: "receive" } } },
      { id: "llm-1", type: "llm", position: { x: 340, y: 80 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek", model: "deepseek-chat", temperature: 0.5,
          maxSteps: 8,
          systemPrompt: i.prompt,
          extensions: {
            skills: [{ packId: "filesystem" }, { packId: "office" }],
            prompts: [],
            mcp: [{ packId: "filesystem" }, { packId: "office" }],
          },
        } } },
      { id: "feishu-send", type: "feishu", position: { x: 580, y: 80 },
        data: { type: "feishu", label: i.labelSend, config: {
          mode: "send", webhookUrl: "",
          appId: "", appSecret: "", message: "{{ $node.llm-1.text }}", msgType: "text",
        } } },
    ],
    edges: [
      { id: "e1", source: "feishu-receive", target: "llm-1" },
      { id: "e2", source: "llm-1", target: "feishu-send" },
    ],
  }
}