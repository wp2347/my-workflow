import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const BROWSE_ROOT = process.env.FS_BROWSE_ROOT || (process.platform === "win32" ? "C:\\" : "/")
const isWin = process.platform === "win32"

interface FsEntry {
  name: string
  path: string
  size: number
  isDir: boolean
}

function withinRoot(p: string): boolean {
  if (!process.env.FS_BROWSE_ROOT) return true
  const rel = path.relative(BROWSE_ROOT, p)
  return !rel.startsWith("..") && !path.isAbsolute(rel)
}

async function listDir(dir: string): Promise<FsEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out: FsEntry[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      out.push({ name: entry.name, path: full, size: 0, isDir: true })
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(full)
        out.push({ name: entry.name, path: full, size: stat.size, isDir: false })
      } catch {
        // ignore unreadable files
      }
    }
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
  return out
}

async function listDrives(): Promise<FsEntry[]> {
  if (!isWin) return []
  const drives: FsEntry[] = []
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c)
    const p = `${letter}:\\`
    try {
      await fs.access(p)
      drives.push({ name: `${letter}:`, path: p, size: 0, isDir: true })
    } catch {
      // drive does not exist
    }
  }
  return drives
}

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("path") || ""

    // 顶层：Windows 显示盘符，POSIX 从根目录开始
    if (!raw) {
      if (isWin) {
        const drives = await listDrives()
        return NextResponse.json({ path: null, parent: null, drives, entries: [] })
      }
      const entries = await listDir("/")
      return NextResponse.json({ path: "/", parent: null, drives: [], entries })
    }

    const resolved = path.resolve(raw)
    if (!withinRoot(resolved)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 })
    }
    const parent = isWin && resolved === path.dirname(resolved) ? null : path.dirname(resolved)
    const entries = await listDir(resolved)
    return NextResponse.json({ path: resolved, parent, drives: [], entries })
  } catch (error) {
    console.error("Failed to list filesystem:", error)
    return NextResponse.json({ error: "Failed to list directory" }, { status: 500 })
  }
}
