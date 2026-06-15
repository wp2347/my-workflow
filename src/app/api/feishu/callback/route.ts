import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

async function getValidTokens(): Promise<Set<string>> {
  const tokens = new Set<string>()
  if (process.env.FEISHU_VERIFICATION_TOKEN) {
    tokens.add(process.env.FEISHU_VERIFICATION_TOKEN)
  }
  try {
    const { prisma } = await import("@/lib/prisma")
    const workflows = await prisma.workflow.findMany({
      where: { nodes: { some: { type: "feishu" } } },
      include: { nodes: { where: { type: "feishu" } } },
    })
    for (const wf of workflows) {
      for (const n of wf.nodes) {
        const config = (n.data as Record<string, unknown>)?.config as Record<string, unknown> | undefined
        const token = config?.verificationToken as string | undefined
        if (token) tokens.add(token)
      }
    }
  } catch {}
  return tokens
}

export async function POST(req: NextRequest) {
  const rawText = await req.text()
  console.log("[Feishu-RAW]", rawText.substring(0, 800))

  let body: Record<string, unknown>
  try { body = JSON.parse(rawText) } catch {
    console.error("[Feishu] JSON parse error")
    return NextResponse.json({ code: 1, msg: "invalid json" }, { status: 400 })
  }

  try {
    console.log("[Feishu] type:", body.type, "event_type:", (body.header as Record<string, unknown>)?.event_type)

    if (body.type === "url_verification") {
      console.log("[Feishu] → URL verification OK")
      return NextResponse.json({ challenge: body.challenge || body.token || "" })
    }

    // Check against all configured tokens (node config + .env)
    const header = body.header as Record<string, unknown> | undefined
    const validTokens = await getValidTokens()
    if (validTokens.size > 0) {
      const incomingToken = (header?.token as string) || ""
      if (!validTokens.has(incomingToken)) {
        console.log("[Feishu] → Token mismatch, got:", incomingToken, "valid:", [...validTokens])
        return NextResponse.json({ code: 1, msg: "Invalid token" }, { status: 401 })
      }
    }

    const eventType = (header?.event_type as string) || ""

    if (eventType === "im.message.receive_v1") {
      const event = body.event as Record<string, unknown> | undefined
      const msg = event?.message as Record<string, unknown> | undefined
      const sender = event?.sender as Record<string, unknown> | undefined
      const senderId = sender?.sender_id as Record<string, unknown> | undefined

      const content = (msg?.content as string) || ""
      let messageText = content
      try { messageText = JSON.parse(content)?.text || content } catch {}
      // Remove bot @mention prefix (e.g. "@_user_1 " or "@bot_name ")
      messageText = messageText.replace(/@_user_\d+\s*/g, "").replace(/@\S+\s*/, "").trim()

      const chatId = (msg?.chat_id as string) || ""
      const chatType = (msg?.chat_type as string) || ""
      const messageId = (msg?.message_id as string) || ""
      const openId = (senderId?.open_id as string) || ""
      // Try to get sender name from mentions or sender info
      const mentions = (msg?.mentions as Array<Record<string, unknown>>) || []
      const senderNameFromMention = mentions.find(
        (m) => (m.id as Record<string, unknown>)?.open_id === openId
      )?.name as string
      const senderName = senderNameFromMention || (senderId?.name as string) || ""

      console.log("[Feishu] Message:", messageText, "chat:", chatId, "msgId:", messageId)
      runFeishuWorkflows(messageText, chatId, chatType, messageId, openId, senderName).catch((e) => console.error("[Feishu] Run error:", e))
    } else {
      console.log("[Feishu] Unhandled event:", eventType)
    }

    return NextResponse.json({ code: 0, msg: "success" })
  } catch (error) {
    console.error("[Feishu] Error:", error)
    return NextResponse.json({ code: 1, msg: "error" }, { status: 500 })
  }
}

async function runFeishuWorkflows(message: string, chatId: string, chatType: string, messageId: string, openId: string, senderName: string) {
  try {
    const { prisma } = await import("@/lib/prisma")
    const { executeWorkflow } = await import("@/engine/executor")

    const workflows = await prisma.workflow.findMany({
      where: { enabled: true, nodes: { some: { type: "feishu" } } },
      include: { nodes: true, edges: true },
    })
    console.log(`[Feishu] Found ${workflows.length} feishu workflows`)

    for (const wf of workflows) {
      const hasReceive = wf.nodes.some((n) => {
        if (n.type !== "feishu") return false
        const config = ((n.data as Record<string, unknown>)?.config) as Record<string, unknown> | undefined
        return config?.mode === "receive"
      })
      if (!hasReceive) continue

      console.log(`[Feishu] Running: ${wf.name}`)

      const nodes = wf.nodes.map((n) => ({
        id: n.id,
        type: n.type as "input" | "llm" | "output" | "feishu",
        position: { x: n.positionX, y: n.positionY },
        data: n.data as { type: "input" | "llm" | "output" | "feishu"; label: string; config: Record<string, unknown> },
      }))

      const edges = wf.edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle || undefined, targetHandle: e.targetHandle || undefined,
      }))

      const execId = `feishu-${Date.now()}`

      try {
        await prisma.execution.create({
          data: { id: execId, workflowId: wf.id, status: "running", input: { message, chatId, chatType, messageId, openId, senderName } as Record<string, unknown> as unknown as Prisma.InputJsonValue, startedAt: new Date() },
        })

        const result = await executeWorkflow(nodes, edges, { message, chatId, chatType, messageId, openId, senderName }, wf.id, execId)

        await prisma.execution.update({
          where: { id: execId },
          data: {
            status: result.status,
            output: (result.output as Record<string, unknown>) as unknown as Prisma.InputJsonValue || undefined,
            logs: result.logs as unknown as Prisma.InputJsonValue,
            error: result.error || undefined,
            finishedAt: new Date(),
            durationMs: result.durationMs || null,
          },
        })

        console.log(`[Feishu] Result: ${result.status}`)
        for (const log of result.logs) {
          if (log.error) console.log(`[Feishu]   ${log.nodeType}: ${log.error}`)
        }
      } catch (err) {
        console.error(`[Feishu] Workflow failed:`, err)
      }
    }
  } catch (err) {
    console.error("[Feishu] runFeishuWorkflows error:", err)
  }
}
