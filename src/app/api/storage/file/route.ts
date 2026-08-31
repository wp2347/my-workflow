import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { resolveStoragePath } from "@/lib/storage-path"

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("path") || ""
    const abs = resolveStoragePath(raw)
    if (!abs) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }
    const stat = await fs.stat(abs)
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 })
    }
    const buf = await fs.readFile(abs)
    const fileName = path.basename(abs)
    const ext = path.extname(fileName).slice(1).toLowerCase()
    const mimeMap: Record<string, string> = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      pdf: "application/pdf",
      md: "text/markdown",
      txt: "text/plain",
      json: "application/json",
      csv: "text/csv",
    }
    const mime = mimeMap[ext] || "application/octet-stream"
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (error) {
    console.error("Failed to download storage file:", error)
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("path") || ""
    const abs = resolveStoragePath(raw)
    if (!abs) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }
    const stat = await fs.stat(abs)
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 })
    }
    await fs.unlink(abs)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete storage file:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 404 })
  }
}
