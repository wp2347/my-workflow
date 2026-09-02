import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateMcpInput } from "@/lib/extensions/validation"
import { encrypt } from "@/lib/crypto"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const headersStr = (server.headers as string) || "{}"
    const envStr = (server.env as string) || "{}"
    return NextResponse.json({
      ...server,
      headers: undefined,
      env: undefined,
      hasAuth: headersStr !== "{}" || envStr !== "{}",
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const validation = validateMcpInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      name: body.name,
      description: body.description || null,
      transport: body.transport,
      url: body.url || null,
      command: body.command || null,
      args: body.args || [],
      tags: body.tags || [],
    }
    if (body.headers !== undefined) {
      updateData.headers = body.headers ? encrypt(JSON.stringify(body.headers)) : "{}"
    }
    if (body.env !== undefined) {
      updateData.env = body.env ? encrypt(JSON.stringify(body.env)) : "{}"
    }

    const server = await prisma.mcpServer.update({ where: { id }, data: updateData as never })
    return NextResponse.json({ id: server.id, name: server.name })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.mcpServer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
