/**
 * Next.js Instrumentation Hook — 服务端启动入口。
 * 在 Node.js 运行时注册时执行，用于启动：
 *   1. 轮询调度器（处理旧版 HH:MM 定时格式）
 *   2. BullMQ Cron 系统（处理 cron 表达式定时任务）
 *
 * Next.js 16 默认启用 instrumentation 支持，无需 experimental 配置。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler-init")
    startScheduler()
    const { initCronSystem } = await import("@/lib/cron-init")
    initCronSystem()
  }
}
