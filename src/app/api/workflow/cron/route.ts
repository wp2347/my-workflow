import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CronExpressionParser } from "cron-parser"
import { syncCronJob } from "@/lib/cron-init"

// GET /api/workflow/cron?workflowId=xxx
export async function GET(req: NextRequest) {
  try {
    const workflowId = req.nextUrl.searchParams.get("workflowId")
    if (!workflowId) {
      const all = await prisma.workflowCronJob.findMany({
        where: { enabled: true },
        include: { workflow: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json(all)
    }

    const jobs = await prisma.workflowCronJob.findMany({
      where: { workflowId },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(jobs)
  } catch (error) {
    console.error("[Cron] GET error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

// POST /api/workflow/cron — create or update
export async function POST(req: NextRequest) {
  try {
    const { id, workflowId, name, cronExpr, timezone, enabled, input } = await req.json()

    if (!workflowId || !cronExpr) {
      return NextResponse.json({ error: "workflowId and cronExpr required" }, { status: 400 })
    }

    // Validate cron expression
    try {
      CronExpressionParser.parse(cronExpr)
    } catch {
      return NextResponse.json({ error: "Invalid cron expression" }, { status: 400 })
    }

    // Calculate next run time
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: new Date(), tz: timezone || "Asia/Shanghai" })
    const nextRunAt = interval.next().toDate()

    let job
    if (id) {
      // Update existing
      job = await prisma.workflowCronJob.update({
        where: { id },
        data: {
          name: name || "Cron Job",
          cronExpr,
          timezone: timezone || "Asia/Shanghai",
          enabled: enabled ?? true,
          input: input || {},
          nextRunAt,
        },
      })
    } else {
      // Check duplicate
      const existing = await prisma.workflowCronJob.findFirst({
        where: { workflowId, name: name || "Cron Job" },
      })
      if (existing) {
        job = await prisma.workflowCronJob.update({
          where: { id: existing.id },
          data: { cronExpr, timezone: timezone || "Asia/Shanghai", enabled: enabled ?? true, input: input || {}, nextRunAt },
        })
      } else {
        job = await prisma.workflowCronJob.create({
          data: {
            workflowId,
            name: name || "Cron Job",
            cronExpr,
            timezone: timezone || "Asia/Shanghai",
            enabled: enabled ?? true,
            input: input || {},
            nextRunAt,
          },
        })
      }
    }

    // Sync with BullMQ
    if (job.enabled) {
      syncCronJob(id ? "update" : "create", {
        id: job.id, workflowId: job.workflowId, cronExpr: job.cronExpr,
        timezone: job.timezone, enabled: job.enabled,
        input: (job.input as Record<string, unknown>) || {},
      }).catch(console.error)
    }

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error("[Cron] POST error:", error)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

// DELETE /api/workflow/cron?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const job = await prisma.workflowCronJob.findUnique({ where: { id } })
    await prisma.workflowCronJob.delete({ where: { id } })

    if (job) {
      syncCronJob("delete", {
        id: job.id, workflowId: job.workflowId, cronExpr: job.cronExpr,
        timezone: job.timezone, enabled: false,
        input: (job.input as Record<string, unknown>) || {},
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Cron] DELETE error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
