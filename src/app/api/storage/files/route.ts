import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), "storage")

async function walk(dir: string, base: string): Promise<Array<{ path: string; size: number }>> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results: Array<{ path: string; size: number }> = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      results.push(...(await walk(full, base)))
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(full)
        results.push({ path: path.relative(base, full), size: stat.size })
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
    files.sort((a, b) => a.path.localeCompare(b.path))
    return NextResponse.json({ root: path.relative(process.cwd(), STORAGE_ROOT) || "storage", files })
  } catch {
    return NextResponse.json({ root: "storage", files: [] })
  }
}
