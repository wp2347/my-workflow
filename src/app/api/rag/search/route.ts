import { NextRequest, NextResponse } from "next/server"
import { searchKnowledge } from "@/lib/rag"

export async function POST(req: NextRequest) {
  try {
    const { query, topK = 5 } = await req.json()
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 })

    const results = await searchKnowledge(String(query), Number(topK) || 5)
    return NextResponse.json({ results, count: results.length })
  } catch (error) {
    console.error("[RAG] Search error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
