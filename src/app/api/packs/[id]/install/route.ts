import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBuiltinPack } from "@/lib/packs/builtin"
import { installPack, isPackInstalled } from "@/lib/packs/service"
import { validatePackManifest } from "@/lib/packs/schema"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    let manifest = getBuiltinPack(id)
    if (!manifest) {
      const row = await prisma.pack.findUnique({ where: { id } })
      if (!row) {
        return NextResponse.json({ error: "Pack not found" }, { status: 404 })
      }
      const r = validatePackManifest(row.manifest)
      if (!r.valid || !r.data) {
        return NextResponse.json({ error: "Pack manifest invalid" }, { status: 400 })
      }
      manifest = r.data
    }
    if (await isPackInstalled(id)) {
      return NextResponse.json({ error: "Pack already installed" }, { status: 409 })
    }
    await installPack(manifest, "builtin")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to install pack:", error)
    return NextResponse.json({ error: "Failed to install pack" }, { status: 500 })
  }
}
