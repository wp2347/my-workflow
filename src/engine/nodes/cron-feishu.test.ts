import { describe, it, expect, beforeEach, vi } from "vitest"
import { executeWorkflow } from "@/engine/executor"
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow"

// 定时推送链路（cron_trigger → feishu send）集成测试：
// cron-worker 会把 workflow.notifyChatId 注入 input.chatId，feishu send 节点据此推送。
// 此处用真实 executor + mock fetch 验证「cron 触发 → 发往 input.chatId」的咽喉点。

const { prisma } = vi.hoisted(() => ({
  prisma: { workflow: { findUnique: vi.fn().mockResolvedValue({ config: {} }) } },
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

function buildNode(id: string, type: string, config: Record<string, unknown>): WorkflowNode {
  return { id, type: type as WorkflowNode["type"], position: { x: 0, y: 0 }, data: { type: type as WorkflowNode["type"], label: id, config } }
}
function edge(id: string, source: string, target: string): WorkflowEdge {
  return { id, source, target }
}

describe("定时推送链路：cron_trigger → feishu send", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prisma.workflow.findUnique.mockResolvedValue({ config: {} })
  })

  it("cron 触发后，send 节点发往 input.chatId（定时资讯推送到群）", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, tenant_access_token: "tok-cron", expire: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0 }))))

    const cron = buildNode("cron-1", "cron_trigger", { name: "每日早报", cronExpr: "0 8 * * *", timezone: "Asia/Shanghai" })
    const proxy = buildNode("code-1", "code", { code: "return '今日热点：AI 工作流平台发布新版本'", timeoutMs: 500 })
    const send = buildNode("feishu-1", "feishu", {
      mode: "send", appId: "app", appSecret: "secret",
      webhookUrl: "", message: "{{ $node.code-1.result }}", msgType: "text",
    })

    // 模拟 cron-worker 的调用：input 注入 chatId（来自 workflow.notifyChatId）
    const result = await executeWorkflow(
      [cron, proxy, send],
      [edge("e1", "cron-1", "code-1"), edge("e2", "code-1", "feishu-1")],
      { chatId: "oc_group_999", fromSchedule: true },
      "wf", "ex",
    )

    expect(result.status).toBe("completed")
    const sendLog = result.logs.find((l) => l.nodeId === "feishu-1")
    expect(sendLog?.status).toBe("completed")
    const out = sendLog?.output as Record<string, unknown>
    expect(out.receiveId).toBe("oc_group_999")
    expect(out.receiveIdType).toBe("chat_id")

    // 断言实际发送的消息内容（非 reply，走 messages 发送端点）
    const fetchMock = vi.mocked(fetch)
    const sendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("receive_id_type=chat_id"))
    expect(sendCall).toBeTruthy()
    const [, init] = sendCall!
    const body = JSON.parse(String((init as RequestInit).body))
    expect(JSON.parse(body.content).text).toContain("今日热点")
  })

  it("cron 节点作为触发源会输出 triggerType=cron 与 message 字段", async () => {
    prisma.workflow.findUnique.mockResolvedValue({ config: {} })
    const cron = buildNode("cron-1", "cron_trigger", { name: "任务", cronExpr: "0 9 * * *" })
    const result = await executeWorkflow(
      [cron],
      [],
      { message: "hello", chatId: "oc_x", fromSchedule: true },
      "wf", "ex",
    )
    expect(result.status).toBe("completed")
    const log = result.logs.find((l) => l.nodeId === "cron-1")
    const out = log?.output as Record<string, unknown>
    expect(out.triggerType).toBe("cron")
    expect(out.message).toBe("hello")
  })
})