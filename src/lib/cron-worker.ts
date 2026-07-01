import { Queue, Worker, type Job } from "bullmq"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { executeWorkflow } from "@/engine/executor"
import { CronExpressionParser } from "cron-parser"
import type { NodeType } from "@/types/workflow"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"
const QUEUE_NAME = "workflow-queue"

let queue: Queue | null = null
let worker: Worker | null = null

export function getQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: { url: REDIS_URL } })
  return queue
}

/**
 * Register a cron job: adds a repeatable job to BullMQ
 */
export async function registerCronJob(
  jobId: string,
  workflowId: string,
  cronExpr: string,
  timezone: string,
  input: Record<string, unknown>,
) {
  const q = getQueue()
  await q.add(jobId, { workflowId, input, cronJobId: jobId }, {
    repeat: { pattern: cronExpr, tz: timezone },
    jobId,
  })

  // Update next run
  const interval = CronExpressionParser.parse(cronExpr, { currentDate: new Date(), tz: timezone || "Asia/Shanghai" })
  const nextRunAt = interval.next().toDate()
  await prisma.workflowCronJob.update({
    where: { id: jobId },
    data: { nextRunAt },
  })
}

/**
 * Remove a cron job from BullMQ
 */
export async function removeCronJob(jobId: string) {
  const q = getQueue()
  await q.removeRepeatableByKey(`${QUEUE_NAME}:${jobId}:repeat`)
}

/**
 * Start the worker to process cron-triggered jobs
 */
export function startCronWorker() {
  if (worker) return worker

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { workflowId, input, cronJobId } = job.data
      console.log(`[CronWorker] Processing: ${job.id} for workflow ${workflowId}`)

      try {
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          include: { nodes: true, edges: true },
        })

        if (!workflow || !workflow.enabled) {
          console.log(`[CronWorker] Workflow ${workflowId} not found or disabled`)
          return
        }

        const nodes = workflow.nodes.map((n) => ({
          id: n.id,
          type: n.type as unknown as NodeType,
          position: { x: n.positionX, y: n.positionY },
          data: n.data as unknown as { type: NodeType; label: string; config: Record<string, unknown> },
        }))

        const edges = workflow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))

        const execId = `cron-${job.id}-${Date.now()}`
        const result = await executeWorkflow(
          nodes, edges,
          { ...input, chatId: workflow.notifyChatId || "", fromSchedule: true },
          workflow.id, execId,
        )

        await prisma.execution.create({
          data: {
            id: execId, workflowId: workflow.id, status: result.status,
            input: input as unknown as Prisma.InputJsonValue,
            output: result.output as unknown as Prisma.InputJsonValue || undefined,
            logs: result.logs as unknown as [], error: result.error || null,
            startedAt: new Date(), finishedAt: new Date(), durationMs: result.durationMs || null,
          },
        })

        // Update lastRunAt (use cronJobId from job data, not BullMQ's job.id)
        if (cronJobId) {
          await prisma.workflowCronJob.update({
            where: { id: cronJobId },
            data: { lastRunAt: new Date() },
          }).catch(() => {})
        }

        console.log(`[CronWorker] ${workflow.name}: ${result.status}`)
      } catch (err) {
        console.error(`[CronWorker] Error:`, err)
        throw err
      }
    },
    { connection: { url: REDIS_URL }, concurrency: 3 },
  )

  console.log("[CronWorker] Started")
  return worker
}
