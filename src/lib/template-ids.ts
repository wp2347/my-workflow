import type { WorkflowNode } from "@/types/workflow"

/**
 * 将模板生成的节点 ID 映射应用到节点内所有字符串引用上。
 *
 * 模板里节点间通过表达式互相引用（如输出节点引用 LLM 节点的 text），
 * 表达式支持三种引用语法：
 *   {{ nodeId.field }}          简写
 *   {{ $node.nodeId.field }}    正式
 *   {{ $node["nodeId"].field }} 引号
 *
 * 模板实例化时节点 ID 会被加上前缀（如 llm-1 → t_abc_llm-1），
 * 因此所有引用都必须同步重写，否则输出节点会指向不存在的旧 ID。
 */
export function rewriteTemplateIds(
  value: unknown,
  idMap: Map<string, string>,
): unknown {
  if (typeof value === "string") {
    let out = value
    for (const [oldId, newId] of idMap) {
      // 仅替换独立的节点 ID 引用（以 {{ 或 $node. 前缀开头、后接 . 或 "），避免误伤 llm-10 这类前缀相同的情况
      out = out.replace(new RegExp(`\\{\\{[\\s]*(${escapeReg(oldId)})\\s*\\.`, "g"), `{{ $1`.replace("$1", newId) + ".")
      out = out.replace(`{{ $node.${oldId}.`, `{{ $node.${newId}.`)
      out = out.replace(`{{ $node["${oldId}"].`, `{{ $node["${newId}"].`)
    }
    return out
  }
  if (Array.isArray(value)) return value.map((v) => rewriteTemplateIds(v, idMap))
  if (value && typeof value === "object") {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = rewriteTemplateIds(v, idMap)
    }
    return obj
  }
  return value
}

/** 转义正则特殊字符，避免 ID 中的字符被当作 pattern */
function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** 供 WorkflowNode.data 直接使用的便捷封装 */
export function rewriteNodeData(
  data: WorkflowNode["data"],
  idMap: Map<string, string>,
): WorkflowNode["data"] {
  return rewriteTemplateIds(data, idMap) as WorkflowNode["data"]
}