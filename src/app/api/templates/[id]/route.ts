import { NextRequest, NextResponse } from "next/server"
import { getTemplate } from "@/lib/templates"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const tpl = getTemplate(id)
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  const lang = req.nextUrl.searchParams.get("lang") || "zh"
  const built = tpl.build(lang)
  return NextResponse.json({ id: tpl.id, ...built })
}
