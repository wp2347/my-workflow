import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseFrontmatter } from "@/lib/extensions/frontmatter"
import { extractZip, validateZipPaths, MAX_UPLOAD_SIZE } from "@/lib/extensions/zip"
import { validateSkillInput } from "@/lib/extensions/validation"
import { mkdir, writeFile } from "fs/promises"
import { resolve } from "path"

const ALLOWED_EXTENSIONS = [".md", ".zip"]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .md and .zip files allowed" }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (ext === ".md") {
      const content = buffer.toString("utf-8")
      const { name, description, body } = parseFrontmatter(content)

      const finalName = name || file.name.replace(/\.md$/i, "")
      const finalDesc = description || `Imported from ${file.name}`
      const validation = validateSkillInput({ name: finalName, description: finalDesc, content: body })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      const skill = await prisma.skill.create({
        data: { name: finalName, description: finalDesc, content: body, attachments: [] },
      })
      return NextResponse.json({ id: skill.id, name: skill.name, attachments: [] }, { status: 201 })
    }

    // zip import
    const files = await extractZip(buffer)
    const entryNames = files.map((f) => f.name)
    if (!validateZipPaths(entryNames)) {
      return NextResponse.json({ error: "Zip contains unsafe paths" }, { status: 400 })
    }

    const skillFile = files.find((f) => f.name.toLowerCase() === "skill.md")
    if (!skillFile) {
      return NextResponse.json({ error: "SKILL.md not found in zip" }, { status: 400 })
    }

    const { name, description, body } = parseFrontmatter(skillFile.content)
    const finalName = name || file.name.replace(/\.zip$/i, "")
    const finalDesc = description || `Imported from ${file.name}`

    const validation = validateSkillInput({ name: finalName, description: finalDesc, content: body })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const otherFiles = files.filter((f) => f.name.toLowerCase() !== "skill.md")
    const attachments = otherFiles.map((f) => ({
      name: f.name.split("/").pop() || f.name,
      fileName: f.name,
      type: "reference" as const,
      mimeType: "text/plain",
      size: f.content.length,
    }))

    const skill = await prisma.skill.create({
      data: { name: finalName, description: finalDesc, content: body, attachments },
    })

    const skillDir = resolve(process.cwd(), "storage", "skills", skill.id)
    await mkdir(skillDir, { recursive: true })
    for (const f of otherFiles) {
      const filePath = resolve(skillDir, f.name)
      const fileDir = filePath.substring(0, filePath.lastIndexOf("/"))
      await mkdir(fileDir, { recursive: true })
      await writeFile(filePath, f.content, "utf-8")
    }

    return NextResponse.json({ id: skill.id, name: skill.name, attachments }, { status: 201 })
  } catch (error) {
    console.error("Failed to upload skill:", error)
    return NextResponse.json({ error: "Failed to upload" }, { status: 500 })
  }
}
