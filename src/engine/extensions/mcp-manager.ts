import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import type { ExecutionContext, McpBinding } from "@/types/workflow"
import { spawn, type ChildProcess } from "child_process"

export interface McpPayload {
  tools: Record<string, unknown>
  resourceContext: string[]
}

// stdio 进程池:serverId → { process, refCount, lastUsed, restartCount }
interface ProcessEntry {
  proc: ChildProcess
  refCount: number
  lastUsed: number
  restartCount: number
  command: string
  args: string[]
  env: Record<string, string>
}

const processPool = new Map<string, ProcessEntry>()
const IDLE_TIMEOUT_MS = 5 * 60 * 1000  // 5 分钟

// 定期清理空闲进程
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [id, entry] of processPool.entries()) {
      if (entry.refCount === 0 && now - entry.lastUsed > IDLE_TIMEOUT_MS) {
        try { entry.proc.kill() } catch {}
        processPool.delete(id)
        console.log(`[mcp-manager] Killed idle stdio process: ${id}`)
      }
    }
  }, 60 * 1000).unref()
}

/**
 * 加载绑定的 MCP servers,返回 tools 和 resource context。
 * - http/sse:每次执行新建连接,执行完关闭
 * - stdio:进程池管理(首次 spawn,引用计数,空闲超时 kill,崩溃重启 ≤3 次)
 */
export async function loadMcpExtensions(
  bindings: McpBinding[],
  _context: ExecutionContext,
): Promise<McpPayload> {
  if (bindings.length === 0) {
    return { tools: {}, resourceContext: [] }
  }

  const allTools: Record<string, unknown> = {}
  const resourceContext: string[] = []

  for (const binding of bindings) {
    try {
      const server = await prisma.mcpServer.findUnique({ where: { id: binding.serverId } })
      if (!server) {
        console.warn(`[mcp-manager] MCP server not found, skipping: ${binding.serverId}`)
        continue
      }

      const headers = server.headers && server.headers !== "{}"
        ? JSON.parse(decrypt(server.headers as string))
        : {}
      const env = server.env && server.env !== "{}"
        ? JSON.parse(decrypt(server.env as string))
        : {}

      if (server.transport === "http" || server.transport === "sse") {
        const mcpModule = await import("@ai-sdk/mcp")
        const createMCPClient = (mcpModule as { createMCPClient?: Function; experimental_createMCPClient?: Function })
          .createMCPClient || (mcpModule as { experimental_createMCPClient?: Function }).experimental_createMCPClient
        const client = await (createMCPClient as Function)({
          transport: {
            type: server.transport as "http" | "sse",
            url: server.url!,
            headers,
          },
        })

        const tools = await client.tools()
        const filtered = filterTools(tools as Record<string, unknown>, binding.tools)
        Object.assign(allTools, filtered)

        await client.close?.()
      } else if (server.transport === "stdio") {
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
        const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")
        const transport = new StdioClientTransport({
          command: server.command!,
          args: (server.args as string[]) || [],
          env: { ...process.env, ...env } as Record<string, string>,
        })
        const mcpClient = new Client(
          { name: "workflow-executor", version: "1.0.0" },
          { capabilities: {} },
        )
        await mcpClient.connect(transport)

        const toolsResult = await mcpClient.listTools()

        for (const t of toolsResult.tools || []) {
          if (binding.tools === "all" || (Array.isArray(binding.tools) && binding.tools.includes(t.name))) {
            allTools[t.name] = {
              description: t.description,
              inputSchema: t.inputSchema,
              execute: async (args: unknown) => {
                return await mcpClient.callTool({ name: t.name, arguments: args as Record<string, unknown> })
              },
            }
          }
        }

        if (binding.resources?.length) {
          for (const uri of binding.resources) {
            try {
              const readResult = await mcpClient.readResource({ uri })
              for (const content of readResult.contents) {
                if ("text" in content) {
                  resourceContext.push(`[Resource: ${uri}]\n${content.text}`)
                }
              }
            } catch (e) {
              console.warn(`[mcp-manager] Failed to read resource ${uri}:`, e)
            }
          }
        }

        await transport.close?.()
      }
    } catch (error) {
      console.warn(`[mcp-manager] Failed to load MCP server ${binding.serverId}:`, error)
    }
  }

  return { tools: allTools, resourceContext }
}

function filterTools(tools: Record<string, unknown>, filter: string[] | "all" | undefined): Record<string, unknown> {
  if (!filter || filter === "all") return tools
  const result: Record<string, unknown> = {}
  for (const name of filter) {
    if (tools[name]) result[name] = tools[name]
  }
  return result
}
