import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncCronJob } from "@/lib/cron-init"

export async function GET() {
  try {
    const workflows = await prisma.workflow.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        enabled: true,
        schedule: true,
        createdAt: true,
        updatedAt: true,
        config: true,
      },
    })

    return NextResponse.json(workflows)
  } catch (error) {
    console.error("Failed to fetch workflows:", error)
    return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, nodes, edges, description, notifyChatId } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description: description || null,
        notifyChatId: notifyChatId || null,
        nodes: {
          create: (nodes || []).map((n: {
            id: string
            type: string
            positionX: number
            positionY: number
            data: Record<string, unknown>
          }) => ({
            id: n.id,
            type: n.type,
            positionX: n.positionX || 0,
            positionY: n.positionY || 0,
            data: n.data || {},
          })),
        },
        edges: {
          create: (edges || []).map((e: {
            id: string
            source: string
            target: string
            sourceHandle?: string | null
            targetHandle?: string | null
          }) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || null,
            targetHandle: e.targetHandle || null,
          })),
        },
      },
      include: {
        nodes: true,
        edges: true,
      },
    })

    // Auto-register cron jobs from cron_trigger nodes
    const cronNodes = (nodes || []).filter((n: { type: string }) => n.type === "cron_trigger")
    for (const cn of cronNodes) {
      const cfg = cn.data?.config || {}
      if (cfg.cronExpr) {
        await prisma.workflowCronJob.upsert({
          where: { workflowId_name: { workflowId: workflow.id, name: cfg.name || "Cron Job" } },
          create: {
            workflowId: workflow.id,
            name: cfg.name || "Cron Job",
            cronExpr: cfg.cronExpr,
            timezone: cfg.timezone || "Asia/Shanghai",
            enabled: true,
            input: cfg.input || {},
          },
          update: {
            cronExpr: cfg.cronExpr,
            timezone: cfg.timezone || "Asia/Shanghai",
            enabled: true,
          },
        })
        // Sync with BullMQ
        const job = await prisma.workflowCronJob.findFirst({
          where: { workflowId: workflow.id, name: cfg.name || "Cron Job" },
        })
        if (job) {
          syncCronJob("create", {
            id: job.id, workflowId: job.workflowId, cronExpr: job.cronExpr,
            timezone: job.timezone, enabled: job.enabled,
            input: (job.input as Record<string, unknown>) || {},
          }).catch(console.error)
        }
      }
    }

    return NextResponse.json(workflow, { status: 201 })
  } catch (error) {
    console.error("Failed to create workflow:", error)
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 })
  }
}
