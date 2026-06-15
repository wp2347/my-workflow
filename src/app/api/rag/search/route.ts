import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/embedding"

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 5 } = await req.json()
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 })

    // Try vector search first, fallback to text search
    let results: Array<{ content: string; score: number; documentName: string }> = []

    try {
      const embedding = await generateEmbedding(query)
      const vectorStr = `[${embedding.join(",")}]`

      const rows = await prisma.$queryRawUnsafe<Array<{
        content: string; score: number; document_name: string
      }>>(
        `SELECT dc.content, dc.embedding <=> $1::vector AS score, d.name AS document_name
         FROM document_chunks dc JOIN documents d ON dc.document_id = d.id
         WHERE dc.embedding IS NOT NULL
         ORDER BY score LIMIT $2`,
        vectorStr, topK,
      )
      results = rows.map(r => ({ content: r.content, score: Number(r.score), documentName: r.document_name }))
    } catch {
      // Fallback: text search
      const rows = await prisma.$queryRawUnsafe<Array<{
        content: string; score: number; document_name: string
      }>>(
        `SELECT dc.content, ts_rank(to_tsvector('simple', dc.content), plainto_tsquery('simple', $1)) AS score, d.name AS document_name
         FROM document_chunks dc JOIN documents d ON dc.document_id = d.id
         WHERE to_tsvector('simple', dc.content) @@ plainto_tsquery('simple', $1)
         ORDER BY score DESC LIMIT $2`,
        query, topK,
      )
      results = rows.map(r => ({ content: r.content, score: Number(r.score), documentName: r.document_name }))
    }

    return NextResponse.json({ results, count: results.length })
  } catch (error) {
    console.error("[RAG] Search error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
