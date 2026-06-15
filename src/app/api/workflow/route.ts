import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

    return NextResponse.json(workflow, { status: 201 })
  } catch (error) {
    console.error("Failed to create workflow:", error)
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 })
  }
}
