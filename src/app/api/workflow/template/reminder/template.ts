import type { Template } from "../types"

const I18N = {
  zh: {
    name: "定时提醒",
    description: "按设定时间定时向飞书发送提醒消息",
    labelCron: "定时触发",
    labelFeishu: "飞书提醒",
  },
  en: {
    name: "Scheduled Reminder",
    description: "Send a Feishu reminder message on a schedule",
    labelCron: "Schedule",
    labelFeishu: "Feishu Reminder",
  },
}

export function buildReminderTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "cron-1", type: "cron_trigger", position: { x: 160, y: 220 },
        data: { type: "cron_trigger", label: i.labelCron, config: { name: "定时提醒", cronExpr: "0 9 * * 1-5", timezone: "Asia/Shanghai" } } },
      { id: "feishu-1", type: "feishu", position: { x: 460, y: 220 },
        data: { type: "feishu", label: i.labelFeishu, config: {
          mode: "send",
          webhookUrl: "",
          appId: "",
          appSecret: "",
          message: "早上好！记得喝水，保持专注，今天也要元气满满哦 ☀️",
          msgType: "text",
        } } },
    ],
    edges: [
      { id: "e1", source: "cron-1", target: "feishu-1" },
    ],
  }
}
