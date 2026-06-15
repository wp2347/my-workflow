import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        nodes: true,
        edges: true,
      },
    })

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }

    return NextResponse.json(workflow)
  } catch (error) {
    console.error("Failed to fetch workflow:", error)
    return NextResponse.json({ error: "Failed to fetch workflow" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, nodes, edges, description, enabled, schedule, notifyChatId, webhookId, webhookSecret } = body

    const existing = await prisma.workflow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }

    // Partial update: only toggle enabled/schedule
    if (nodes === undefined && edges === undefined && (enabled !== undefined || schedule !== undefined || notifyChatId !== undefined || webhookId !== undefined || webhookSecret !== undefined)) {
      const updateData: Record<string, unknown> = {}
      if (enabled !== undefined) updateData.enabled = enabled
      if (schedule !== undefined) updateData.schedule = schedule
      if (notifyChatId !== undefined) updateData.notifyChatId = notifyChatId
      if (webhookId !== undefined) updateData.webhookId = webhookId
      if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret
      const workflow = await prisma.workflow.update({
        where: { id },
        data: updateData,
        include: { nodes: true, edges: true },
      })
      return NextResponse.json(workflow)
    }

    await prisma.workflowEdge.deleteMany({ where: { workflowId: id } })
    await prisma.workflowNode.deleteMany({ where: { workflowId: id } })

    const workflow = await prisma.workflow.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        enabled: enabled !== undefined ? enabled : existing.enabled,
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

    return NextResponse.json(workflow)
  } catch (error) {
    console.error("Failed to update workflow:", error)
    return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const existing = await prisma.workflow.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
    }

    await prisma.workflow.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete workflow:", error)
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 })
  }
}
