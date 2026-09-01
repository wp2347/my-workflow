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

  it("local 模式：源文件缺失抛出 ENOENT", async () => {
    await expect(
      executeOutputNode(makeNode({ format: "text", template: "", exportMode: "local", exportPath: tmpDir, remoteUrl: "" }), makeCtxWithMusic())
    ).rejects.toThrow(/ENOENT|no such file/i)
  })

  it("remote 模式：服务端返回 !ok 抛出含状态码错误", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 502 } as unknown as Response)
    await expect(
      executeOutputNode(makeNode({ format: "text", template: "", exportMode: "remote", exportPath: "", remoteUrl: "https://upload.example.com" }), makeCtxWithMusic())
    ).rejects.toThrow(/Remote upload failed: 502/)
  })

  it("remote 模式：remoteUrl 为空抛出错误", async () => {
    await fs.writeFile(path.join(tmpDir, "src.mp3"), Buffer.from([1, 2, 3]))
    await expect(
      executeOutputNode(makeNode({ format: "text", template: "", exportMode: "remote", exportPath: "", remoteUrl: "" }), makeCtxWithMusic())
    ).rejects.toThrow(/remoteUrl is empty/i)
  })

  // ===== 文本输出本地导出（Phase 3：报告链路）=====

  function makeCtxWithText(format: string): ExecutionContext {
    const ctx: ExecutionContext = { workflowId: "wf", executionId: "e2", input: {}, nodeResults: new Map(), logs: [] }
    const raw = format === "json" ? '{"a":1}' : "# 报告\n\n正文内容"
    ctx.nodeResults.set("llm-1", { raw })
    return ctx
  }

  it("local 模式无 music：文本输出写入导出目录，返回 fileName/localPath", async () => {
    const res = await executeOutputNode(
      makeNode({ format: "markdown", template: "", exportMode: "local", exportPath: "", remoteUrl: "" }),
      makeCtxWithText("markdown"),
    ) as Record<string, unknown>

    expect(res.localPath).toBeTruthy()
    expect(res.fileName).toMatch(/^output-\d{8}-\d{6}\.md$/)
    const written = await fs.readFile(res.localPath as string, "utf-8")
    expect(written).toContain("# 报告")
  })

  it("local 模式文本导出的扩展名随 format 变化（json/txt）", async () => {
    const res = await executeOutputNode(
      makeNode({ format: "json", template: "", exportMode: "local", exportPath: "", remoteUrl: "" }),
      makeCtxWithText("json"),
    ) as Record<string, unknown>
    expect((res.fileName as string).endsWith(".json")).toBe(true)
  })

  it("local 模式文本导出：连续两次执行文件均可读", async () => {
    const node = makeNode({ format: "text", template: "", exportMode: "local", exportPath: "", remoteUrl: "" })
    const r1 = await executeOutputNode(node, makeCtxWithText("text")) as Record<string, unknown>
    const r2 = await executeOutputNode(node, makeCtxWithText("text")) as Record<string, unknown>
    expect(r1.localPath).toBeTruthy()
    expect(r2.localPath).toBeTruthy()
    expect(await fs.readFile(r2.localPath as string, "utf-8")).toContain("正文内容")
  })

  it("路径校验：exportPath 相对路径含 .. 逃逸基础目录时拒绝", async () => {
    await expect(
      executeOutputNode(
        makeNode({ format: "text", template: "", exportMode: "local", exportPath: "../../etc", remoteUrl: "" }),
        makeCtxWithText("text"),
      )
    ).rejects.toThrow(/exportPath/i)
  })

  it("路径校验：合法的 exportPath 子目录自动创建并写入", async () => {
    const res = await executeOutputNode(
      makeNode({ format: "text", template: "", exportMode: "local", exportPath: path.join(tmpDir, "reports", "2026"), remoteUrl: "" }),
      makeCtxWithText("text"),
    ) as Record<string, unknown>
    const written = await fs.readFile(res.localPath as string, "utf-8")
    expect(written).toContain("# 报告")
  })

  it("下载命名：fileName 以 output-<时间戳> 规则生成", async () => {
    const res = await executeOutputNode(
      makeNode({ format: "markdown", template: "", exportMode: "download", exportPath: "", remoteUrl: "" }),
      makeCtxWithText("markdown"),
    ) as Record<string, unknown>
    expect(res.fileName).toMatch(/^output-\d{14}\.md$/)
  })
})
describe("executeOutputNode 上游 office 产物捕获", () => {
  function makeCtxWithOfficeTool(): ExecutionContext {
    const ctx: ExecutionContext = {
      workflowId: "wf", executionId: "exec-office", input: {},
      nodeResults: new Map(), logs: [],
    }
    ctx.nodeResults.set("llm-1", {
      text: "已生成报告 storage/export/报告.docx",
      raw: "已生成报告 storage/export/报告.docx",
      toolCalls: [
        { name: "create_docx", args: { outputPath: "storage/export/报告.docx", markdown: "# 报告" }, summary: "" },
      ],
    })
    return ctx
  }

  it("download 模式下仍捕获上游 office 生成的文件并暴露 filePath/fileName", async () => {
    const res = await executeOutputNode(
      makeNode({ format: "text", template: "", exportMode: "download", remoteUrl: "" }),
      makeCtxWithOfficeTool(),
    ) as Record<string, unknown>
    expect(res.filePath).toBe("export/报告.docx")
    expect(res.fileName).toBe("报告.docx")
  })

  it("无 office 工具调用时 download 模式不设置 filePath", async () => {
    const ctx: ExecutionContext = {
      workflowId: "wf", executionId: "e", input: {},
      nodeResults: new Map([["llm-1", { text: "hi", raw: "hi" }]]), logs: [],
    }
    const res = await executeOutputNode(
      makeNode({ format: "text", template: "", exportMode: "download", remoteUrl: "" }),
      ctx,
    ) as Record<string, unknown>
    expect(res.filePath).toBeUndefined()
  })

  it("越界的 outputPath 被忽略（不暴露 filePath）", async () => {
    const ctx: ExecutionContext = {
      workflowId: "wf", executionId: "e", input: {},
      nodeResults: new Map(), logs: [],
    }
    ctx.nodeResults.set("llm-1", {
      raw: "x",
      toolCalls: [{ name: "create_docx", args: { outputPath: "/etc/passwd" }, summary: "" }],
    })
    const res = await executeOutputNode(
      makeNode({ format: "text", template: "", exportMode: "download", remoteUrl: "" }),
      ctx,
    ) as Record<string, unknown>
    expect(res.filePath).toBeUndefined()
  })
})

describe("executeOutputNode 模板表达式解析", () => {
  it("template 支持 {{ $node.llm-1.text }} 语法解析出 LLM 文本", async () => {
    const ctx: ExecutionContext = {
      workflowId: "wf", executionId: "e", input: {},
      nodeResults: new Map(), logs: [],
    }
    ctx.nodeResults.set("llm-1", { text: "这是 LLM 生成的报告正文", raw: "这是 LLM 生成的报告正文" })
    const res = await executeOutputNode(
      makeNode({ format: "text", template: "{{ $node.llm-1.text }}", exportMode: "download", remoteUrl: "" }),
      ctx,
    ) as Record<string, unknown>
    expect(res.output).toBe("这是 LLM 生成的报告正文")
    expect(res.raw).toBe("这是 LLM 生成的报告正文")
  })

  it("template 支持 {{ llm-1.text }} 简写语法", async () => {
    const ctx: ExecutionContext = {
      workflowId: "wf", executionId: "e", input: {},
      nodeResults: new Map(), logs: [],
    }
    ctx.nodeResults.set("llm-1", { text: "简写正文", raw: "简写正文" })
    const res = await executeOutputNode(
      makeNode({ format: "text", template: "{{ llm-1.text }}", exportMode: "download", remoteUrl: "" }),
      ctx,
    ) as Record<string, unknown>
    expect(res.output).toBe("简写正文")
  })
})
