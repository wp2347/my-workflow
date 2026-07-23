import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { executeOutputNode } from "@/engine/nodes/output"
import type { WorkflowNode, ExecutionContext } from "@/types/workflow"

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "export-test-"))
  process.env.EXPORT_STORAGE_DIR = tmpDir
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true } as unknown as Response))
})
afterEach(async () => {
  vi.unstubAllGlobals()
  delete process.env.EXPORT_STORAGE_DIR
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function makeNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "output-1", type: "output", position: { x: 0, y: 0 },
    data: { type: "output", label: "out", config },
  }
}
function makeCtxWithMusic(): ExecutionContext {
  const ctx: ExecutionContext = {
    workflowId: "wf", executionId: "exec-1", input: {},
    nodeResults: new Map(), logs: [],
  }
  ctx.nodeResults.set("music-1", {
    audioUrl: "/api/music/file?executionId=exec-1&nodeId=music-1",
    localPath: path.join(tmpDir, "src.mp3"),
    fileName: "exec-1_music-1.mp3",
    metadata: { title: "Song" },
    raw: '{"audioUrl":"/x","metadata":{}}',
  })
  return ctx
}

describe("executeOutputNode", () => {
  it("download 模式：透传 audio 字段，保留原 output/raw/format", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    const res = await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "download", exportPath: "", remoteUrl: "" }), makeCtxWithMusic()) as Record<string, unknown>
    expect(res.output).toBeDefined()
    expect(res.raw).toBeDefined()
    expect(res.format).toBe("text")
    expect(res.audioUrl).toContain("/api/music/file")
    expect(res.fileName).toBe("exec-1_music-1.mp3")
    expect((res.metadata as Record<string, unknown>).title).toBe("Song")
  })

  it("local 模式：复制到 exportPath", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    const res = await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "local", exportPath: tmpDir, remoteUrl: "" }), makeCtxWithMusic()) as Record<string, unknown>
    const copied = await fs.readdir(tmpDir)
    expect(copied).toContain("exec-1_music-1.mp3")
    expect(res.fileName).toBe("exec-1_music-1.mp3")
  })

  it("remote 模式：POST 文件到 remoteUrl", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    const fetchMock = vi.mocked(fetch)
    await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "remote", exportPath: "", remoteUrl: "https://upload.example.com" }), makeCtxWithMusic())
    expect(fetchMock).toHaveBeenCalled()
    const [, opts] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
    expect(opts.method).toBe("POST")
    expect((opts.body as FormData).get("file")).not.toBeNull()
  })

  it("无上游 music：返回原结构，不追加 audio 字段", async () => {
    const ctx: ExecutionContext = { workflowId: "wf", executionId: "e", input: {}, nodeResults: new Map(), logs: [] }
    ctx.nodeResults.set("llm-1", { raw: "hello" })
    const res = await executeOutputNode(makeNode({ format: "text", template: "", exportMode: "download", exportPath: "", remoteUrl: "" }), ctx) as Record<string, unknown>
    expect(res.audioUrl).toBeUndefined()
    expect(res.output).toBeDefined()
  })
})