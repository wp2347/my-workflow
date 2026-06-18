/**
 * Standalone cron worker starter.
 * Run with: npx tsx src/lib/cron-worker-start.ts
 */
import "dotenv/config"
import { prisma } from "./prisma"
import { registerCronJob, startCronWorker } from "./cron-worker"

async function main() {
  console.log("[Worker] Starting cron worker...")

  // Load existing cron jobs and register with BullMQ
  const jobs = await prisma.workflowCronJob.findMany({
    where: { enabled: true },
    include: { workflow: { select: { name: true, enabled: true } } },
  })

  console.log(`[Worker] Found ${jobs.length} cron jobs`)

  for (const job of jobs) {
    if (!job.workflow.enabled) continue
    try {
      await registerCronJob(job.id, job.workflowId, job.cronExpr, job.timezone, job.input as Record<string, unknown>)
      console.log(`[Worker] Registered: ${job.name} (${job.cronExpr})`)
    } catch (err) {
      console.error(`[Worker] Failed to register ${job.name}:`, err)
    }
  }

  startCronWorker()
  console.log("[Worker] Ready, waiting for jobs...")
}

main().catch(console.error)
