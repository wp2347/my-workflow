import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createZip } from "@/lib/extensions/zip"
import { readFile } from "fs/promises"
import { resolve } from "path"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const skill = await prisma.skill.findUnique({ where: { id } })
    if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const skillMd = `---
name: ${skill.name}
description: ${skill.description}
---
${skill.content}`

    const files = [{ name: "SKILL.md", content: skillMd }]

    const attachments = (skill.attachments as Array<{ fileName: string }>) || []
    const skillDir = resolve(process.cwd(), "storage", "skills", id)
    for (const att of attachments) {
      try {
        const content = await readFile(resolve(skillDir, att.fileName), "utf-8")
        files.push({ name: att.fileName, content })
      } catch {}
    }

    const zipBuffer = await createZip(files)
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="skill-${skill.name}.zip"`,
      },
    })
  } catch (error) {
    console.error("Failed to export skill:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
