import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { executeWorkflow } from "@/engine/executor"
import crypto from "crypto"
import type { NodeType } from "@/types/workflow"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  try {
    const { webhookId } = await params

    const workflow = await prisma.workflow.findUnique({
      where: { webhookId },
      include: { nodes: true, edges: true },
    })

    if (!workflow || !workflow.enabled) {
      return NextResponse.json({ error: "Not found or disabled" }, { status: 404 })
    }

    let body: Record<string, unknown>
    if (workflow.webhookSecret) {
      const signature = req.headers.get("x-webhook-signature")
      if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 })
      const rawBody = await req.text()
      const expected = crypto.createHmac("sha256", workflow.webhookSecret).update(rawBody).digest("hex")
      if (signature !== expected) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      body = JSON.parse(rawBody)
    } else {
      body = await req.json()
    }

    return await triggerWorkflow(workflow, body)
  } catch (error) {
    console.error("[Webhook] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params
  const workflow = await prisma.workflow.findUnique({
    where: { webhookId },
    select: { id: true, name: true },
  })
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ workflowId: workflow.id, name: workflow.name, status: "active" })
}

async function triggerWorkflow(
  wf: { id: string; name: string; notifyChatId?: string | null; nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> },
  body: Record<string, unknown>,
) {
  const input = { ...body }
  if (!input.chatId && wf.notifyChatId) {
    input.chatId = wf.notifyChatId
  }

  const nodes = wf.nodes.map((n) => ({
    id: n.id as string,
    type: n.type as string as NodeType,
    position: { x: (n.positionX as number) || 0, y: (n.positionY as number) || 0 },
    data: n.data as unknown as { type: NodeType; label: string; config: Record<string, unknown> },
  }))

  const edges = wf.edges.map((e) => ({
    id: e.id as string,
    source: e.source as string,
    target: e.target as string,
    sourceHandle: (e.sourceHandle as string) || undefined,
    targetHandle: (e.targetHandle as string) || undefined,
  }))

  const execId = `webhook-${Date.now()}`
  const result = await executeWorkflow(nodes, edges, input, wf.id, execId)

  await prisma.execution.create({
    data: {
      id: execId,
      workflowId: wf.id,
      status: result.status,
      logs: result.logs as unknown as Prisma.InputJsonValue,
      input: input as unknown as Prisma.InputJsonValue,
      output: result.output ? (result.output as Record<string, unknown>) as unknown as Prisma.InputJsonValue : Prisma.DbNull,
      error: result.error || null,
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: result.durationMs || null,
    },
  })

  console.log(`[Webhook] ${wf.name} → ${result.status}`)
  return NextResponse.json({ executionId: execId, status: result.status, output: result.output })
}
