import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createZip } from "@/lib/extensions/zip"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const prompt = await prisma.prompt.findUnique({ where: { id } })
    if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const content = `---
name: ${prompt.name}
role: ${prompt.role}
---
${prompt.content}`

    const zipBuffer = await createZip([{ name: "PROMPT.md", content }])
    const safeName = encodeURIComponent(prompt.name)
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="prompt-${safeName}.zip"; filename*=UTF-8''prompt-${safeName}.zip`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
