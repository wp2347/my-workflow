import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")

    const [executions, total] = await Promise.all([
      prisma.execution.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          workflow: { select: { name: true } },
        },
      }),
      prisma.execution.count(),
    ])

    const result = executions.map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      workflowName: e.workflow.name,
      status: e.status,
      input: e.input,
      output: e.output,
      error: e.error,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      durationMs: e.durationMs,
      createdAt: e.createdAt,
    }))

    return NextResponse.json({
      items: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error("Failed to fetch executions:", error)
    return NextResponse.json({ error: "Failed to fetch executions" }, { status: 500 })
  }
}
