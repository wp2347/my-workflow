import type { Template } from "../types"

const I18N = {
  zh: {
    name: "每日早报推送",
    description: "定时抓取热点资讯，AI 生成摘要后推送飞书",
    labelCron: "定时触发",
    labelHttp: "获取资讯",
    labelLLM: "AI 摘要",
    labelFeishu: "飞书推送",
  },
  en: {
    name: "Daily News Brief",
    description: "Fetch trending news on schedule, summarize with AI, push to Feishu",
    labelCron: "Schedule",
    labelHttp: "Fetch News",
    labelLLM: "AI Summary",
    labelFeishu: "Feishu Push",
  },
}

export function buildDailyBriefTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "cron-1", type: "cron_trigger", position: { x: 100, y: 220 },
        data: { type: "cron_trigger", label: i.labelCron, config: { name: "每日早报", cronExpr: "0 8 * * *", timezone: "Asia/Shanghai" } } },
      { id: "http-1", type: "http", position: { x: 340, y: 220 },
        data: { type: "http", label: i.labelHttp, config: {
          method: "GET",
          url: "https://api.vvhan.com/api/hotlist/all",
          headers: {},
          auth: "none",
          body: "",
        } } },
      { id: "llm-1", type: "llm", position: { x: 580, y: 220 },
        data: { type: "llm", label: i.labelLLM, config: {
          provider: "deepseek",
          model: "deepseek-chat",
          systemPrompt: "你是资深编辑。根据用户提供的热点资讯列表，精选 5 条最重要的新闻，用中文生成简洁的每日早报摘要，每条包含标题和一句话简介，用 markdown 列表格式输出。",
          temperature: 0.4,
        } } },
      { id: "feishu-1", type: "feishu", position: { x: 820, y: 220 },
        data: { type: "feishu", label: i.labelFeishu, config: { mode: "send", webhookUrl: "", appId: "", appSecret: "", message: "", msgType: "text" } } },
    ],
    edges: [
      { id: "e1", source: "cron-1", target: "http-1" },
      { id: "e2", source: "http-1", target: "llm-1" },
      { id: "e3", source: "llm-1", target: "feishu-1" },
    ],
  }
}
