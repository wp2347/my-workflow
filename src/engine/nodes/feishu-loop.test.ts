import { describe, it, expect, beforeEach, vi } from "vitest"
import { executeWorkflow } from "@/engine/executor"
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow"

// 真实 executor + 真实 feishu 节点：验证 receive→send 闭环数据流
// 发送走 App Bot reply API，mock fetch 断言请求体

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

describe("feishu receive → send 闭环", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    prisma.workflow.findUnique.mockResolvedValue({ config: {} })
  })

  it("receive 透传消息供 llm 引用，send 用 reply API 回发到同会话", async () => {
    // 模拟飞书 OAuth token 返回 + reply 发送成功
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, tenant_access_token: "tok-abc", expire: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0 }))))

    const receive = buildNode("feishu-recv", "feishu", { mode: "receive" })
    const llm = buildNode("llm-1", "llm", {
      provider: "openai", model: "gpt-4o-mini",
      // 无 key 会抛错——此处用 code 节点替代 llm 以独立验证 feishu 数据流
    })
    void llm
    // 用 input 节点透传，避免真实 LLM 调用
    const inputN = buildNode("input-1", "input", { name: "message", type: "text", required: true })
    const feishuSend = buildNode("feishu-send", "feishu", {
      mode: "send",
      appId: "app-id", appSecret: "app-secret",
      webhookUrl: "", message: "{{ $node.input-1.message }}", msgType: "text",
    })

    const result = await executeWorkflow(
      [inputN, feishuSend, receive],
      [edge("e1", "input-1", "feishu-send"), edge("e2", "feishu-recv", "feishu-send")],
      { message: "帮我查天气", chatId: "oc_chat_123", messageId: "om_msg_456", chatType: "group" },
      "wf", "ex",
    )

    expect(result.status).toBe("completed")
    const sendLog = result.logs.find((l) => l.nodeId === "feishu-send")
    expect(sendLog?.status).toBe("completed")

    // 断言：使用的应是 reply API（含 messageId）
    const fetchMock = vi.mocked(fetch)
    const replyCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/reply"))
    expect(replyCall).toBeTruthy()

    // reply 请求应携带 Authorization 与回复消息体
    const [, init] = replyCall!
    const opts = init as RequestInit
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer tok-abc")
    const body = JSON.parse(String(opts.body))
    expect(body.msg_type).toBe("text")
    expect(JSON.parse(body.content).text).toContain("帮我查天气")
  })

  it("message 模板留空时自动取上游最新输出（模板默认接法）", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, tenant_access_token: "tok2", expire: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0 }))))

    const inputN = buildNode("input-1", "input", { name: "message", type: "text", required: true })
    // 用 code 节点产出中间文本（LLM 的替身），验证「取最后一个节点输出」
    const proxy = buildNode("code-1", "code", { code: "return '用户问：' + input.message", timeoutMs: 500 })
    const feishuSend = buildNode("feishu-send", "feishu", {
      mode: "send",
      appId: "app-id", appSecret: "app-secret",
      webhookUrl: "", message: "", msgType: "text",
    })

    const result = await executeWorkflow(
      [inputN, proxy, feishuSend],
      [edge("e1", "input-1", "code-1"), edge("e2", "code-1", "feishu-send")],
      { message: "总结一下", chatId: "oc_x", openId: "ou_x", messageId: "", chatType: "p2p" },
      "wf", "ex",
    )
    expect(result.status).toBe("completed")

    const fetchMock = vi.mocked(fetch)
    const sendCall = fetchMock.mock.calls.find(([url]) => !String(url).includes("/reply") && String(url).includes("receive_id_type"))
    expect(sendCall).toBeTruthy()
    const [, init] = sendCall!
    const body = JSON.parse(String((init as RequestInit).body))
    expect(JSON.parse(body.content).text).toContain("用户问：总结一下")
  })

  it("receive 节点在 receive 模式返回 chatId/openId 供 send 定位（open_id 回发）", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0, tenant_access_token: "tok3", expire: 7200 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 0 }))))

    // 仅 receive+send，无上游 message 模板：期望 send 通过 context.input 定位 open_id
    const receive = buildNode("feishu-recv", "feishu", { mode: "receive" })
    const feishuSend = buildNode("feishu-send", "feishu", {
      mode: "send", appId: "a", appSecret: "b",
      webhookUrl: "", message: "收到！", msgType: "text",
    })

    const result = await executeWorkflow(
      [receive, feishuSend],
      [edge("e1", "feishu-recv", "feishu-send")],
      { message: "你好", openId: "ou_user", chatId: "", messageId: "", chatType: "p2p" },
      "wf", "ex",
    )
    expect(result.status).toBe("completed")
    const sendLog = result.logs.find((l) => l.nodeId === "feishu-send")
    const out = sendLog?.output as Record<string, unknown>
    expect(out.receiveIdType).toBe("open_id")
    expect(out.receiveId).toBe("ou_user")
    expect(out.message).toBe("收到！")
  })
})