import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), "storage")

interface StorageEntry {
  path: string
  size: number
  isDir: boolean
}

async function walk(dir: string, base: string): Promise<StorageEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results: StorageEntry[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    const rel = path.relative(base, full)
    if (entry.isDirectory()) {
      results.push({ path: rel, size: 0, isDir: true })
      results.push(...(await walk(full, base)))
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(full)
        results.push({ path: rel, size: stat.size, isDir: false })
      } catch {
        // ignore unreadable files
      }
    }
  }
  return results
}

export async function GET() {
  try {
    await fs.access(STORAGE_ROOT)
    const files = await walk(STORAGE_ROOT, STORAGE_ROOT)
    files.sort((a, b) => (a.isDir === b.isDir ? a.path.localeCompare(b.path) : a.isDir ? -1 : 1))
    return NextResponse.json({ root: path.relative(process.cwd(), STORAGE_ROOT) || "storage", files })
  } catch {
    return NextResponse.json({ root: "storage", files: [] })
  }
}
