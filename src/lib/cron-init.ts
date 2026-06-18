import { prisma } from "@/lib/prisma"
import { registerCronJob, removeCronJob, startCronWorker } from "@/lib/cron-worker"

let started = false

/**
 * On startup: load all enabled cron jobs from DB, register with BullMQ, start worker
 */
export async function initCronSystem() {
  if (started) return
  started = true

  console.log("[CronInit] Loading cron jobs from database...")

  try {
    const jobs = await prisma.workflowCronJob.findMany({
      where: { enabled: true },
      include: { workflow: { select: { name: true, enabled: true } } },
    })

    console.log(`[CronInit] Found ${jobs.length} enabled cron jobs`)

    for (const job of jobs) {
      if (!job.workflow.enabled) {
        console.log(`[CronInit] Skipping ${job.name}: workflow disabled`)
        continue
      }

      try {
        await registerCronJob(job.id, job.workflowId, job.cronExpr, job.timezone, job.input as Record<string, unknown>)
        console.log(`[CronInit] Registered: ${job.name} (${job.cronExpr})`)
      } catch (err) {
        console.error(`[CronInit] Failed to register ${job.name}:`, err)
      }
    }

    // Start worker
    startCronWorker()
  } catch (err) {
    console.error("[CronInit] Failed:", err)
  }
}

// Auto-execute on module load
initCronSystem()

/**
 * Sync: called after CRUD API changes (create/update/delete)
 */
export async function syncCronJob(
  action: "create" | "update" | "delete",
  job: { id: string; workflowId: string; cronExpr: string; timezone: string; enabled: boolean; input: Record<string, unknown> },
) {
  try {
    // Remove old repeatable job
    await removeCronJob(job.id)

    if (action === "delete" || !job.enabled) return

    // Re-register
    await registerCronJob(job.id, job.workflowId, job.cronExpr, job.timezone, job.input)
    console.log(`[CronSync] ${action}: ${job.id}`)
  } catch (err) {
    console.error(`[CronSync] Failed:`, err)
  }
}
