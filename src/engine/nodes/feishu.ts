import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"

function getPreviousMessage(context: ExecutionContext): string {
  // Get the LAST node's output (most relevant), not all combined
  const entries = [...context.nodeResults.entries()]
  if (entries.length === 0) return ""
  const lastOutput = entries[entries.length - 1][1]
  if (typeof lastOutput === "object" && lastOutput !== null) {
    const obj = lastOutput as Record<string, unknown>
    return (obj.text as string) || (obj.message as string) || (obj.raw as string) || ""
  }
  return typeof lastOutput === "string" ? lastOutput : ""
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }
  const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  })
  const data = await res.json() as Record<string, unknown>
  if (data.code !== 0) throw new Error(`Feishu auth failed: ${JSON.stringify(data)}`)
  cachedToken = {
    token: data.tenant_access_token as string,
    expiresAt: Date.now() + ((data.expire as number) - 60) * 1000,
  }
  return cachedToken.token
}

async function getUserName(openId: string, appId: string, appSecret: string): Promise<string> {
  if (!openId || !appId || !appSecret) return ""
  try {
    const token = await getTenantAccessToken(appId, appSecret)
    const res = await fetch(
      `https://open.feishu.cn/open-apis/contact/v3/users/${openId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const data = await res.json() as Record<string, unknown>
    if (data.code === 0) {
      const user = data.data as Record<string, unknown> | undefined
      return (user?.name as string) || (user?.nickname as string) || ""
    }
  } catch {}
  return ""
}

function getChatId(context: ExecutionContext): string | null {
  if (context.input?.chatId && String(context.input.chatId).length > 0) {
    return context.input.chatId as string
  }
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.mode === "receive" && obj.chatId && String(obj.chatId).length > 0) {
        return obj.chatId as string
      }
    }
  }
  return null
}

function getOpenId(context: ExecutionContext): string | null {
  if (context.input?.openId && String(context.input.openId).length > 0) {
    return context.input.openId as string
  }
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const obj = output as Record<string, unknown>
      if (obj.mode === "receive" && obj.openId && String(obj.openId).length > 0) {
        return obj.openId as string
      }
    }
  }
  return null
}

// For scheduled workflows, chatId comes from context input directly
function getTargetChatId(context: ExecutionContext): string | null {
  return getChatId(context) || (context.input?.chatId as string) || null
}

export const executeFeishuNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const mode = (config.mode as string) || "send"
  const webhookUrl = (config.webhookUrl as string) || ""
  const message = (config.message as string) || ""
  const msgType = (config.msgType as string) || "text"

  if (mode === "receive") {
    const msg = (context.input?.message as string) || message || getPreviousMessage(context) || ""
    const cid = (context.input?.chatId as string) || ""
    const oid = (context.input?.openId as string) || ""
    return {
      success: true,
      mode: "receive",
      message: msg,
      chatId: cid,
      openId: oid,
      raw: msg,
    }
  }

  // SEND MODE
  let finalMessage = message || getPreviousMessage(context) || ""
  // Resolve expressions in the message template
  finalMessage = resolveExpression(finalMessage, context)
  finalMessage = finalMessage.replace(/@_user_\d+\s*/g, "")
  // Remove user's original message if echoed back by LLM
  const userMsg = (context.input?.message as string) || ""
  if (userMsg && finalMessage.startsWith(userMsg)) {
    finalMessage = finalMessage.slice(userMsg.length).trim()
  }
  finalMessage = finalMessage.trim()

  // If sending via App Bot, format @mention for group chats (non-reply only)
  const chatType = context.input?.chatType as string || ""
  const senderOpenId = context.input?.openId as string || ""
  const messageId = context.input?.messageId as string || ""
  let senderName = ""

  // Only fetch sender name if we need @mention (non-reply group chat)
  if (!messageId && chatType === "group" && senderOpenId) {
    senderName = (context.input?.senderName as string) || ""
    if (!senderName) {
      const aid = (config.appId as string) || process.env.FEISHU_APP_ID || ""
      const asecret = (config.appSecret as string) || process.env.FEISHU_APP_SECRET || ""
      senderName = await getUserName(senderOpenId, aid, asecret)
    }
  }

  const atMention = (!messageId && chatType === "group" && senderOpenId)
    ? `<at user_id="${senderOpenId}">@${senderName || "用户"}</at> `
    : ""

  if (webhookUrl) {
    const body: Record<string, unknown> = { msg_type: msgType, content: {} }
    body.content = msgType === "markdown"
      ? { title: "Workflow", content: [{ tag: "md", content: finalMessage }] }
      : { text: atMention + finalMessage }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const rb = await response.json() as Record<string, unknown>
    if (rb.code !== 0) throw new Error(`Webhook failed: ${JSON.stringify(rb)}`)
    return { success: true, mode: "send", method: "webhook", message: finalMessage, raw: `Sent: ${finalMessage}` }
  }

  // App Bot API - try chat_id first, fallback to open_id
  const appId = (config.appId as string) || process.env.FEISHU_APP_ID || ""
  const appSecret = (config.appSecret as string) || process.env.FEISHU_APP_SECRET || ""
  if (!appId || !appSecret) {
    throw new Error("Set FEISHU_APP_ID and FEISHU_APP_SECRET in .env, or configure a webhook URL")
  }

  const chatId = getTargetChatId(context)
  const openId = getOpenId(context)
  // For scheduled/manual runs, fallback to chatId from context input (set by scheduler)
  const receiveId = chatId || openId || (context.input?.chatId as string)
  const receiveIdType = chatId ? "chat_id" : openId ? "open_id" : "chat_id"

  if (!receiveId) {
    throw new Error("No chat_id or open_id found. Place a Receive node before this Send node.")
  }

  const token = await getTenantAccessToken(appId, appSecret)

  // Use reply API endpoint for threaded reply
  const apiPath = messageId
    ? `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`
    : `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`

  const sendBody: Record<string, unknown> = {
    msg_type: msgType,
    content: JSON.stringify({ text: atMention + finalMessage }),
  }
  // For regular send (no reply), include receive_id
  if (!messageId) {
    sendBody.receive_id = receiveId
  }

  const response = await fetch(apiPath, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(sendBody),
  })
  const rb = await response.json() as Record<string, unknown>
  console.log("[Feishu Send] API response:", JSON.stringify(rb))
  if (rb.code !== 0) throw new Error(`Send failed: ${JSON.stringify(rb)}`)

  return { success: true, mode: "send", method: "app_bot", message: finalMessage, receiveId, receiveIdType, replyMsgId: messageId, raw: `Sent: ${finalMessage}` }
}
