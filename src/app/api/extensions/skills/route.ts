import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSkillInput } from "@/lib/extensions/validation"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const category = searchParams.get("category") || undefined

    const skills = await prisma.skill.findMany({
      where: {
        AND: [
          q ? { OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ] } : {},
          category ? { category } : {},
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, category: true,
        tags: true, version: true, createdAt: true, updatedAt: true,
      },
    })
    return NextResponse.json(skills)
  } catch (error) {
    console.error("Failed to list skills:", error)
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validateSkillInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const skill = await prisma.skill.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category || null,
        content: body.content,
        attachments: body.attachments || [],
        tags: body.tags || [],
      },
    })
    return NextResponse.json(skill, { status: 201 })
  } catch (error) {
    console.error("Failed to create skill:", error)
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 })
  }
}
