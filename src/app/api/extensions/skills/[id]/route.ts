import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSkillInput } from "@/lib/extensions/validation"
import { rm } from "fs/promises"
import { resolve } from "path"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const skill = await prisma.skill.findUnique({ where: { id } })
    if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(skill)
  } catch (error) {
    console.error("Failed to get skill:", error)
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
    const validation = validateSkillInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const skill = await prisma.skill.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category || null,
        content: body.content,
        attachments: body.attachments || [],
        tags: body.tags || [],
      },
    })
    return NextResponse.json(skill)
  } catch (error) {
    console.error("Failed to update skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.skill.delete({ where: { id } })
    const dir = resolve(process.cwd(), "storage", "skills", id)
    try { await rm(dir, { recursive: true, force: true }) } catch {}
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
