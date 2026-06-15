import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { chunkText } from "@/lib/chunker"
import { generateEmbedding } from "@/lib/embedding"

export async function GET() {
  const docs = await prisma.document.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, type: true, chunkSize: true, createdAt: true, _count: { select: { chunks: true } } },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const content = formData.get("content") as string | null
  const name = (formData.get("name") as string) || file?.name || "untitled"
  const chunkSize = parseInt(formData.get("chunkSize") as string || "500")

  let text = content || ""
  if (file) text = await file.text()
  if (!text.trim()) return NextResponse.json({ error: "No content" }, { status: 400 })

  const doc = await prisma.document.create({
    data: { name, content: text, type: file?.name?.endsWith(".md") ? "md" : "txt", chunkSize },
  })

  const chunks = chunkText(text, chunkSize)
  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i])
      const vectorStr = `[${embedding.join(",")}]`
      await prisma.$executeRawUnsafe(
        `INSERT INTO document_chunks (id, document_id, content, chunk_index, embedding, created_at) VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
        `chunk-${doc.id}-${i}`, doc.id, chunks[i], i, vectorStr,
      )
    } catch {
      await prisma.$executeRawUnsafe(
        `INSERT INTO document_chunks (id, document_id, content, chunk_index, created_at) VALUES ($1, $2, $3, $4, NOW())`,
        `chunk-${doc.id}-${i}`, doc.id, chunks[i], i,
      )
    }
  }

  return NextResponse.json({ id: doc.id, name: doc.name, chunks: chunks.length }, { status: 201 })
}
