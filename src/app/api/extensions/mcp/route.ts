import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateMcpInput } from "@/lib/extensions/validation"
import { encrypt } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""

    const servers = await prisma.mcpServer.findMany({
      where: q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ] } : {},
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, transport: true,
        url: true, command: true, args: true, status: true, lastCheckedAt: true,
        tags: true, version: true, createdAt: true, updatedAt: true,
      },
    })

    const result = await Promise.all(servers.map(async (s) => {
      const full = await prisma.mcpServer.findUnique({ where: { id: s.id }, select: { headers: true, env: true } })
      const headersStr = (full?.headers as string) || "{}"
      const envStr = (full?.env as string) || "{}"
      return {
        ...s,
        hasAuth: headersStr !== "{}" || envStr !== "{}",
      }
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Failed to list MCP servers:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validateMcpInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const server = await prisma.mcpServer.create({
      data: {
        name: body.name,
        description: body.description || null,
        transport: body.transport,
        url: body.url || null,
        headers: body.headers ? encrypt(JSON.stringify(body.headers)) : "{}",
        command: body.command || null,
        args: body.args || [],
        env: body.env ? encrypt(JSON.stringify(body.env)) : "{}",
        tags: body.tags || [],
      },
    })
    return NextResponse.json({ id: server.id, name: server.name, transport: server.transport }, { status: 201 })
  } catch (error) {
    console.error("Failed to create MCP server:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
