import type { WorkflowNode, ExecutionContext, NodeExecutor } from "@/types/workflow"
import { resolveExpression } from "@/lib/expression"

function resolveTemplate(template: string, context: ExecutionContext): string {
  return resolveExpression(template, context)
}

export const executeHttpNode: NodeExecutor = async (node, context) => {
  const config = (node.data.config as Record<string, unknown>) || {}

  const method = (config.method as string) || "GET"
  let url = (config.url as string) || ""
  const body = (config.body as string) || ""
  const headers = (config.headers as Record<string, string>) || {}
  const auth = (config.auth as string) || "none"

  if (!url) throw new Error("HTTP URL is not configured")

  url = resolveTemplate(url, context)
  const resolvedBody = resolveTemplate(body, context)

  const resolvedHeaders: Record<string, string> = { ...headers }

  if (auth === "bearer" && config.authToken) {
    resolvedHeaders["Authorization"] = `Bearer ${resolveTemplate(config.authToken as string, context)}`
  } else if (auth === "basic" && config.authUsername && config.authPassword) {
    const u = resolveTemplate(config.authUsername as string, context)
    const p = resolveTemplate(config.authPassword as string, context)
    resolvedHeaders["Authorization"] = `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`
  } else if (auth === "api_key" && config.authToken) {
    resolvedHeaders["X-API-Key"] = resolveTemplate(config.authToken as string, context)
  }

  const fetchOptions: RequestInit = {
    method,
    headers: resolvedHeaders as Record<string, string>,
  }

  if (method !== "GET" && resolvedBody) {
    fetchOptions.body = resolvedBody
  }

  const response = await fetch(url, fetchOptions)
  const text = await response.text()

  let data: unknown = text
  try { data = JSON.parse(text) } catch {}

  return {
    success: response.ok,
    status: response.status,
    data,
    raw: typeof data === "string" ? data : JSON.stringify(data),
    url,
  }
}
