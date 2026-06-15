import { checkScheduledWorkflows } from "@/lib/scheduler"

let schedulerStarted = false

export function startScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true

  console.log("[Scheduler] Started, checking every 30 seconds")
  checkScheduledWorkflows()
  setInterval(checkScheduledWorkflows, 30000)
}

// Auto-start in development
if (process.env.NODE_ENV !== "production") {
  startScheduler()
}
