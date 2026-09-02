import { describe, it, expect, vi, beforeEach } from "vitest"

const { generateEmbedding } = vi.hoisted(() => ({ generateEmbedding: vi.fn() }))
const { prisma } = vi.hoisted(() => ({
  prisma: { $queryRawUnsafe: vi.fn() },
}))

vi.mock("@/lib/embedding", () => ({ generateEmbedding }))
vi.mock("@/lib/prisma", () => ({ prisma }))

import { searchKnowledge, type KnowledgeSearchResult } from "@/lib/rag"

describe("searchKnowledge", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("向量检索成功：返回规范化结果，query 为空时直接返回空数组", async () => {
    // 空 query 短路
    expect(await searchKnowledge("", 3)).toEqual([])
    expect(generateEmbedding).not.toHaveBeenCalled()

    generateEmbedding.mockResolvedValue([0.1, 0.2])
    prisma.$queryRawUnsafe.mockResolvedValue([
      { content: "片段A", score: 0.25, document_name: "doc1" },
      { content: "片段B", score: "0.5", document_name: "doc2" }, // pgvector 返回 decimal 字符串
    ])

    const results = await searchKnowledge("什么是工作流", 2)
    expect(results).toEqual<KnowledgeSearchResult[]>([
      { content: "片段A", score: 0.25, documentName: "doc1" },
      { content: "片段B", score: 0.5, documentName: "doc2" },
    ])
    // SQL 参数第一位应为向量字符串
    const sqlArgs = prisma.$queryRawUnsafe.mock.calls[0] as unknown[]
    expect(sqlArgs[1]).toBe("[0.1,0.2]")
    expect(sqlArgs[2]).toBe(2)
  })

  it("向量检索抛错时回退文本检索", async () => {
    generateEmbedding.mockResolvedValue([1])
    prisma.$queryRawUnsafe
      .mockRejectedValueOnce(new Error("vector search failed"))
      .mockResolvedValueOnce([
        { content: "文本匹配", score: 0.8, document_name: "doc3" },
      ])

    const results = await searchKnowledge("关键词", 5)
    expect(results).toEqual([{ content: "文本匹配", score: 0.8, documentName: "doc3" }])
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2)
  })

  it("向量+文本都失败时返回空数组而不抛错", async () => {
    generateEmbedding.mockResolvedValue([1])
    prisma.$queryRawUnsafe.mockRejectedValue(new Error("db down"))

    const results = await searchKnowledge("anything", 5)
    expect(results).toEqual([])
  })
})
