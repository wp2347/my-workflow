import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validatePromptInput } from "@/lib/extensions/validation"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const category = searchParams.get("category") || undefined

    const prompts = await prisma.prompt.findMany({
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
        tags: true, version: true, role: true, createdAt: true, updatedAt: true,
      },
    })
    return NextResponse.json(prompts)
  } catch (error) {
    console.error("Failed to list prompts:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = validatePromptInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const prompt = await prisma.prompt.create({
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
    return NextResponse.json(prompt, { status: 201 })
  } catch (error) {
    console.error("Failed to create prompt:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
