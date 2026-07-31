import { NextRequest, NextResponse } from "next/server"
import { buildMusicTemplate } from "./template"

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") || "zh"
  return NextResponse.json(buildMusicTemplate(lang))
}
