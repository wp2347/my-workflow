import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

function musicStorageDir(): string {
  return process.env.MUSIC_STORAGE_DIR || path.join(process.cwd(), "storage", "music")
}

function mimeForExt(ext: string): string {
  switch (ext) {
    case "mp3":
      return "audio/mpeg"
    case "m4a":
      return "audio/mp4"
    case "aac":
      return "audio/aac"
    case "wav":
      return "audio/wav"
    case "ogg":
      return "audio/ogg"
    case "flac":
      return "audio/flac"
    default:
      return "audio/mpeg"
  }
}

const idRegex = /^[A-Za-z0-9_-]+$/

async function resolveFile(
  executionId: string,
  nodeId: string,
): Promise<{ filePath: string; ext: string } | null> {
  const dir = musicStorageDir()
  const base = `${executionId}_${nodeId}`
  for (const ext of ["mp3", "wav", "ogg", "m4a", "flac", "aac"]) {
    const p = path.join(dir, `${base}.${ext}`)
    try {
      await fs.access(p)
      return { filePath: p, ext }
    } catch {}
  }
  return null
}

export async function GET(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get("executionId")
  const nodeId = req.nextUrl.searchParams.get("nodeId")
  if (
    !executionId ||
    !nodeId ||
    !idRegex.test(executionId) ||
    !idRegex.test(nodeId)
  ) {
    return NextResponse.json(
      {
        error:
          "executionId and nodeId are required and must be alphanumeric/underscore/hyphen only",
      },
      { status: 400 },
    )
  }
  const found = await resolveFile(executionId, nodeId)
  if (!found) return NextResponse.json({ error: "File not found" }, { status: 404 })
  try {
    const buf = await fs.readFile(found.filePath)
    const fileName = path.basename(found.filePath)
    const total = buf.length

    // 支持 Range 请求（音频流式播放 / seek 必需）
    const range = req.headers.get("range")
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      if (match) {
        let start = match[1] ? parseInt(match[1], 10) : 0
        let end = match[2] ? parseInt(match[2], 10) : total - 1
        if (isNaN(start)) start = 0
        if (isNaN(end) || end >= total) end = total - 1
        if (start > end || start >= total) {
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${total}` },
          })
        }
        const chunk = buf.subarray(start, end + 1)
        return new NextResponse(new Uint8Array(chunk), {
          status: 206,
          headers: {
            "Content-Type": mimeForExt(found.ext),
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Content-Length": String(chunk.length),
          },
        })
      }
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mimeForExt(found.ext),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(total),
      },
    })
  } catch (error) {
    console.error("music file GET failed:", error)
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get("executionId")
  const nodeId = req.nextUrl.searchParams.get("nodeId")
  if (
    !executionId ||
    !nodeId ||
    !idRegex.test(executionId) ||
    !idRegex.test(nodeId)
  ) {
    return NextResponse.json(
      {
        error:
          "executionId and nodeId are required and must be alphanumeric/underscore/hyphen only",
      },
      { status: 400 },
    )
  }
  const found = await resolveFile(executionId, nodeId)
  if (!found) return NextResponse.json({ ok: true, alreadyAbsent: true })
  try {
    await fs.unlink(found.filePath)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("music file DELETE failed:", error)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
