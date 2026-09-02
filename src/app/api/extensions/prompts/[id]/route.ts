import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validatePromptInput } from "@/lib/extensions/validation"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const prompt = await prisma.prompt.findUnique({ where: { id } })
    if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(prompt)
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
    const validation = validatePromptInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category || null,
        content: body.content,
        variables: body.variables || [],
        role: body.role || "system",
        tags: body.tags || [],
      },
    })
    return NextResponse.json(prompt)
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
    await prisma.prompt.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
