import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

function musicStorageDir(): string {
  return process.env.MUSIC_STORAGE_DIR || path.join(process.cwd(), "storage", "music")
}

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
  if (!executionId || !nodeId) {
    return NextResponse.json(
      { error: "executionId and nodeId are required" },
      { status: 400 },
    )
  }
  const found = await resolveFile(executionId, nodeId)
  if (!found) return NextResponse.json({ error: "File not found" }, { status: 404 })
  const buf = await fs.readFile(found.filePath)
  const fileName = path.basename(found.filePath)
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": `audio/${found.ext}`,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buf.length),
    },
  })
}

export async function DELETE(req: NextRequest) {
  const executionId = req.nextUrl.searchParams.get("executionId")
  const nodeId = req.nextUrl.searchParams.get("nodeId")
  if (!executionId || !nodeId) {
    return NextResponse.json(
      { error: "executionId and nodeId are required" },
      { status: 400 },
    )
  }
  const found = await resolveFile(executionId, nodeId)
  if (!found) return NextResponse.json({ ok: true, alreadyAbsent: true })
  await fs.unlink(found.filePath)
  return NextResponse.json({ ok: true })
}