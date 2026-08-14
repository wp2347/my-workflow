import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/prisma"

const BROWSE_ROOT = process.env.FS_BROWSE_ROOT || (process.platform === "win32" ? "C:\\" : "/")

function withinRoot(p: string): boolean {
  if (!process.env.FS_BROWSE_ROOT) return true
  const rel = path.relative(BROWSE_ROOT, p)
  return !rel.startsWith("..") && !path.isAbsolute(rel)
}

/**
 * 将选中的本地文件夹加入已安装 filesystem MCP server 的允许目录，
 * 使 LLM 能通过 filesystem MCP 读取该目录。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const dir = typeof body.path === "string" ? path.resolve(body.path) : ""
    if (!dir) {
      return NextResponse.json({ error: "path is required" }, { status: 400 })
    }
    if (!withinRoot(dir)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const stat = await fs.stat(dir)
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 })
    }

    const server = await prisma.mcpServer.findFirst({
      where: { OR: [{ name: "filesystem" }, { packId: "filesystem" }] },
    })

    if (server) {
      const args = (server.args as string[]) || []
      if (!args.includes(dir)) {
        await prisma.mcpServer.update({
          where: { id: server.id },
          data: { args: [...args, dir] },
        })
      }
      return NextResponse.json({ path: dir, allowed: true })
    }

    return NextResponse.json({ path: dir, allowed: false, warning: "filesystem MCP not installed; install the filesystem pack to let the LLM read this folder" })
  } catch (error) {
    console.error("Failed to allow directory:", error)
    return NextResponse.json({ error: "Failed to allow directory" }, { status: 500 })
  }
}
