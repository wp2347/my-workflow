import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { executeWorkflow } from "@/engine/executor"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workflowId, input } = body

    if (!workflowId) {
      return NextResponse.json({ error: "workflowId is required" }, { status: 400 })
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        nodes: true,
        edges: true,
      },
    })

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }

    const execution = await prisma.execution.create({
      data: {
        workflowId: workflow.id,
        status: "running",
        input: input || {},
        startedAt: new Date(),
      },
    })

    const nodes = workflow.nodes.map((n) => ({
      id: n.id,
      type: n.type as "input" | "llm" | "output",
      position: { x: n.positionX, y: n.positionY },
      data: n.data as {
        type: "input" | "llm" | "output"
        label: string
        config: Record<string, unknown>
      },
    }))

    const edges = workflow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
    }))

    const result = await executeWorkflow(
      nodes,
      edges,
      input || {},
      workflow.id,
      execution.id,
    )

    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: result.status,
        output: result.output ? (result.output as Record<string, unknown>) as unknown as Prisma.InputJsonValue : undefined,
        logs: result.logs as unknown as Prisma.InputJsonValue,
        error: result.error || undefined,
        finishedAt: new Date(),
        durationMs: result.durationMs || null,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Workflow execution failed:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Workflow execution failed",
      },
      { status: 500 },
    )
  }
}
