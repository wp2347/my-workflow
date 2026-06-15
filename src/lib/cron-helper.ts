import { CronExpressionParser } from "cron-parser"

export function getNextRunTime(schedule: string | null | undefined): string {
  if (!schedule) return "未设置"
  try {
    // HH:MM format
    if (/^\d{2}:\d{2}$/.test(schedule)) {
      const [h, m] = schedule.split(":").map(Number)
      const next = new Date()
      next.setHours(h, m, 0, 0)
      if (next <= new Date()) next.setDate(next.getDate() + 1)
      return next.toLocaleString("zh-CN", { hour12: false })
    }
    // Cron expression
    if (schedule.includes(" ")) {
      const interval = CronExpressionParser.parse(schedule)
      return interval.next().toDate().toLocaleString("zh-CN", { hour12: false })
    }
    return schedule
  } catch {
    return schedule
  }
}
