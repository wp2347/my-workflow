import { prisma } from "@/lib/prisma"
import { generateEmbedding } from "@/lib/embedding"

/** 知识库检索单条结果 */
export interface KnowledgeSearchResult {
  content: string
  score: number
  documentName: string
}

/**
 * 知识库向量检索（pgvector），文本检索兜底。
 * 直接函数调用，供 API 路由与引擎节点共用，避免 HTTP 自调用。
 */
export async function searchKnowledge(
  query: string,
  topK = 5,
): Promise<KnowledgeSearchResult[]> {
  if (!query.trim()) return []

  // 优先向量检索；embedding 或 SQL 失败时回退 PostgreSQL 全文检索
  try {
    const embedding = await generateEmbedding(query)
    return await vectorSearch(embedding, topK)
  } catch {
    try {
      return await textSearch(query, topK)
    } catch (error) {
      console.warn("[rag] Both vector and text search failed:", error)
      return []
    }
  }
}

async function vectorSearch(embedding: number[], topK: number): Promise<KnowledgeSearchResult[]> {
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
  return rows.map(r => ({ content: r.content, score: Number(r.score), documentName: r.document_name }))
}

async function textSearch(query: string, topK: number): Promise<KnowledgeSearchResult[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    content: string; score: number; document_name: string
  }>>(
    `SELECT dc.content, ts_rank(to_tsvector('simple', dc.content), plainto_tsquery('simple', $1)) AS score, d.name AS document_name
     FROM document_chunks dc JOIN documents d ON dc.document_id = d.id
     WHERE to_tsvector('simple', dc.content) @@ plainto_tsquery('simple', $1)
     ORDER BY score DESC LIMIT $2`,
    query, topK,
  )
  return rows.map(r => ({ content: r.content, score: Number(r.score), documentName: r.document_name }))
}
