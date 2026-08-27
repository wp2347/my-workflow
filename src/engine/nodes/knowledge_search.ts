import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { searchKnowledge } from "@/lib/rag"

/**
 * 知识库检索节点执行器。
 * 查询来源优先级：queryTemplate > 上游节点 raw 输出。
 * 检索失败不中断工作流，降级为 error + 空结果（与 llm 节点 RAG 行为一致）。
 */
export const executeKnowledgeSearchNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}
  const queryTemplate = (config.queryTemplate as string) || ""
  const topKRaw = (config.topK as number) ?? 3
  const topK = Math.min(Math.max(Math.round(topKRaw) || 3, 1), 20)

  // 拼接上游 raw 输出作为默认查询
  const upstream: string[] = []
  for (const [, output] of context.nodeResults) {
    if (typeof output === "object" && output !== null) {
      const raw = (output as Record<string, unknown>).raw
      if (typeof raw === "string") upstream.push(raw)
    } else if (typeof output === "string") {
      upstream.push(output)
    }
  }
  const query = queryTemplate.trim() || upstream.join("\n\n").trim()

  if (!query) {
    return {
      results: [],
      raw: "",
      error: "No query source: configure queryTemplate or connect an upstream node",
    }
  }

  try {
    const results = await searchKnowledge(query, topK)
    const raw = results
      .map((r, i) => `[${i + 1}] ${r.documentName}\n${r.content}`)
      .join("\n\n")
    return { results, raw, count: results.length }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[knowledge_search] Search failed: ${msg}`)
    return { results: [], raw: "", error: msg }
  }
}
