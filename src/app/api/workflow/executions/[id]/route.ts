import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const execution = await prisma.execution.findUnique({
      where: { id },
      include: { workflow: { select: { name: true } } },
    })

    if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflow.name,
      status: execution.status,
      input: execution.input,
      output: execution.output,
      logs: execution.logs,
      error: execution.error,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      durationMs: execution.durationMs,
      createdAt: execution.createdAt,
    })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
