import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBuiltinPacks } from "@/lib/packs/builtin"
import { getInstalledPackIds } from "@/lib/packs/service"
import { validatePackManifest } from "@/lib/packs/schema"

export async function GET() {
  try {
    const builtin = getBuiltinPacks()
    const imported = await prisma.pack.findMany({ orderBy: { createdAt: "desc" } })
    const installed = new Set(await getInstalledPackIds())

    const items = [
      ...builtin.map((p) => ({ ...p, source: "builtin" as const })),
      ...imported.map((row) => {
        const m = validatePackManifest(row.manifest)
        return {
          ...(m.valid && m.data ? m.data : {}),
          id: row.id,
          name: row.name,
          description: row.description,
          category: row.category,
          icon: row.icon,
          version: row.version,
          source: row.source as "imported",
        }
      }),
    ]

    return NextResponse.json(
      items.map((p) => ({ ...p, installed: installed.has(p.id) })),
    )
  } catch (error) {
    console.error("Failed to list packs:", error)
    return NextResponse.json({ error: "Failed to list packs" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = validatePackManifest(body)
    if (!result.valid || !result.data) {
      return NextResponse.json({ error: result.error || "invalid manifest" }, { status: 400 })
    }
    const builtinIds = new Set(getBuiltinPacks().map((p) => p.id))
    if (builtinIds.has(result.data.id)) {
      return NextResponse.json({ error: "id conflicts with a builtin pack" }, { status: 400 })
    }
    const pack = await prisma.pack.upsert({
      where: { id: result.data.id },
      update: {
        name: result.data.name,
        description: result.data.description,
        category: result.data.category || null,
        icon: result.data.icon || null,
        version: result.data.version,
        manifest: result.data as object,
      },
      create: {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        category: result.data.category || null,
        icon: result.data.icon || null,
        version: result.data.version,
        source: "imported",
        manifest: result.data as object,
      },
    })
    return NextResponse.json({ id: pack.id }, { status: 201 })
  } catch (error) {
    console.error("Failed to import pack:", error)
    return NextResponse.json({ error: "Failed to import pack" }, { status: 500 })
  }
}
