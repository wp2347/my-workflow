import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { extractZip, validateZipPaths, MAX_UPLOAD_SIZE } from "@/lib/extensions/zip"
import { validatePromptInput } from "@/lib/extensions/validation"

const ALLOWED_EXTENSIONS = [".md", ".zip"]

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ""
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Only .md and .zip allowed" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "File exceeds 10MB" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (ext === ".md") {
      const content = buffer.toString("utf-8")
      const name = file.name.replace(/\.md$/i, "")
      const validation = validatePromptInput({ name, content, role: "system" })
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
      const prompt = await prisma.prompt.create({
        data: { name, description: `Imported from ${file.name}`, content, variables: [], role: "system" },
      })
      return NextResponse.json({ id: prompt.id, name: prompt.name }, { status: 201 })
    }

    // zip: find PROMPT.md or first .md
    const files = await extractZip(buffer)
    if (!validateZipPaths(files.map((f) => f.name))) {
      return NextResponse.json({ error: "Unsafe paths in zip" }, { status: 400 })
    }
    const promptFile = files.find((f) => f.name.toLowerCase() === "prompt.md")
      || files.find((f) => f.name.toLowerCase().endsWith(".md"))
    if (!promptFile) {
      return NextResponse.json({ error: "No .md file in zip" }, { status: 400 })
    }

    const name = promptFile.name.split("/").pop()?.replace(/\.md$/i, "") || "Imported Prompt"
    const validation = validatePromptInput({ name, content: promptFile.content, role: "system" })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const prompt = await prisma.prompt.create({
      data: { name, description: `Imported from ${file.name}`, content: promptFile.content, variables: [], role: "system" },
    })
    return NextResponse.json({ id: prompt.id, name: prompt.name }, { status: 201 })
  } catch (error) {
    console.error("Failed to upload prompt:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
