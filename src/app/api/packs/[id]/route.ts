import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBuiltinPack } from "@/lib/packs/builtin"

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (getBuiltinPack(id)) {
      return NextResponse.json({ error: "Cannot delete a builtin pack" }, { status: 400 })
    }
    await prisma.pack.deleteMany({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to delete pack:", error)
    return NextResponse.json({ error: "Failed to delete pack" }, { status: 500 })
  }
}
