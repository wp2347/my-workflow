import { NextRequest, NextResponse } from "next/server"
import { uninstallPack } from "@/lib/packs/service"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await uninstallPack(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to uninstall pack:", error)
    return NextResponse.json({ error: "Failed to uninstall pack" }, { status: 500 })
  }
}
