import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { executeMusicNode } from "@/engine/nodes/music"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

let tmpDir: string
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-"))
  process.env.MUSIC_STORAGE_DIR = tmpDir
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  delete process.env.MUSIC_STORAGE_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "music-1",
    type: "music",
    position: { x: 0, y: 0 },
    data: { type: "music", label: "music", config },
  }
}
function makeCtx(input: Record<string, unknown> = {}): ExecutionContext {
  return {
    workflowId: "wf", executionId: "exec-1", input,
    nodeResults: new Map(), logs: [],
  }
}

describe("executeMusicNode", () => {
  it("同步 API：替换占位符并落盘音频", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: { audio_url: "https://cdn.example.com/x.mp3" } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "audio/mpeg" }),
        arrayBuffer: async () => new ArrayBuffer(8),
      } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      bodyTemplate: '{"prompt":"{{ $input.prompt }}"}',
      auth: "none", authToken: "",
      pollingEnabled: false,
      audioUrlField: "data.audio_url", metadataField: "data.metadata",
    })
    const res = await executeMusicNode(node, makeCtx({ prompt: "jazz" })) as Record<string, unknown>
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/generate")
    const opts = fetchMock.mock.calls[0][1] as RequestInit
    expect(opts.body).toBe('{"prompt":"jazz"}')
    expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.example.com/x.mp3")
    expect(res.audioUrl).toContain("/api/music/file?executionId=exec-1&nodeId=music-1")
    expect(res.fileName).toMatch(/^exec-1_music-1\.mp3$/)
    const files = await fs.readdir(tmpDir)
    expect(files).toContain("exec-1_music-1.mp3")
    expect(typeof res.raw).toBe("string")
  })

  it("异步轮询：按 taskId 轮询直到 audio_url 出现", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true, text: async () => JSON.stringify({ data: { task_id: "t-99" } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, text: async () => JSON.stringify({ data: { audio_url: "https://cdn/x.wav", metadata: { title: "T" } } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, headers: new Headers({ "content-type": "audio/wav" }),
        arrayBuffer: async () => new ArrayBuffer(4),
      } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "none", authToken: "",
      pollingEnabled: true,
      taskIdField: "data.task_id",
      pollUrlTemplate: "https://api.example.com/tasks/{{taskId}}",
      pollIntervalMs: 0, pollMaxAttempts: 5,
      pollStatusField: "", pollSuccessValue: "",
      audioUrlField: "data.audio_url", metadataField: "data.metadata",
    })
    const res = await executeMusicNode(node, makeCtx()) as Record<string, unknown>
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect((fetchMock.mock.calls[1][0] as string)).toBe("https://api.example.com/tasks/t-99")
    expect(res.fileName).toMatch(/\.wav$/)
    expect((res.metadata as Record<string, unknown>).title).toBe("T")
  })

  it("轮询超时抛错", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ data: { task_id: "t" } }) } as unknown as Response)
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify({ data: {} }) } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "none", authToken: "",
      pollingEnabled: true, taskIdField: "data.task_id",
      pollUrlTemplate: "https://api.example.com/tasks/{{taskId}}",
      pollIntervalMs: 0, pollMaxAttempts: 2,
      pollStatusField: "", pollSuccessValue: "",
      audioUrlField: "data.audio_url", metadataField: "",
    })
    await expect(executeMusicNode(node, makeCtx())).rejects.toThrow(/polling timed out/i)
  })

  it("bearer 认证注入 Authorization 头", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: { audio_url: "https://cdn.example.com/y.mp3" } }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true, headers: new Headers({ "content-type": "audio/mpeg" }),
        arrayBuffer: async () => new ArrayBuffer(4),
      } as unknown as Response)
    const node = makeNode({
      apiUrl: "https://api.example.com/generate", method: "POST", headers: {},
      bodyTemplate: "{}", auth: "bearer", authToken: "secret",
      pollingEnabled: false, audioUrlField: "data.audio_url", metadataField: "",
    })
    await executeMusicNode(node, makeCtx())
    const opts = fetchMock.mock.calls[0][1] as RequestInit
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer secret")
  })
})