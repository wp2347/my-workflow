import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const server = await prisma.mcpServer.findUnique({ where: { id } })
    if (!server) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.mcpServer.update({ where: { id }, data: { status: "checking" } })

    try {
      const headers = server.headers && server.headers !== "{}"
        ? JSON.parse(decrypt(server.headers as string))
        : {}
      const env = server.env && server.env !== "{}"
        ? JSON.parse(decrypt(server.env as string))
        : {}

      if (server.transport === "http" || server.transport === "sse") {
        const mcpModule = await import("@ai-sdk/mcp") as {
          createMCPClient?: (opts: { transport: { type: string; url: string; headers: Record<string, string> } }) => Promise<{ tools: () => Promise<Record<string, unknown>>; close?: () => Promise<void> }>
          experimental_createMCPClient?: (opts: { transport: { type: string; url: string; headers: Record<string, string> } }) => Promise<{ tools: () => Promise<Record<string, unknown>>; close?: () => Promise<void> }>
        }
        const createMCPClient = mcpModule.createMCPClient || mcpModule.experimental_createMCPClient
        const client = await createMCPClient!({
          transport: {
            type: server.transport as "http" | "sse",
            url: server.url!,
            headers,
          },
        })

        const tools = await client.tools()
        const capabilities = {
          tools: Object.entries(tools).map(([name, t]) => ({
            name,
            description: (t as { description?: string }).description,
          })),
          resources: [],
          prompts: [],
        }

        await prisma.mcpServer.update({
          where: { id },
          data: {
            status: "online",
            lastCheckedAt: new Date(),
            capabilitiesCache: JSON.stringify(capabilities),
          },
        })

        await client.close?.()
        return NextResponse.json({ status: "online", capabilities })
      } else if (server.transport === "stdio") {
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
        const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")
        const transport = new StdioClientTransport({
          command: server.command!,
          args: (server.args as string[]) || [],
          env: { ...process.env, ...env } as Record<string, string>,
        })
        const mcpClient = new Client({ name: "workflow-test", version: "1.0.0" }, { capabilities: {} })
        await mcpClient.connect(transport)

        const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
          mcpClient.listTools(),
          mcpClient.listResources().catch(() => ({ resources: [] })),
          mcpClient.listPrompts().catch(() => ({ prompts: [] })),
        ])

        const capabilities = {
          tools: toolsResult.tools || [],
          resources: resourcesResult.resources || [],
          prompts: promptsResult.prompts || [],
        }

        await prisma.mcpServer.update({
          where: { id },
          data: {
            status: "online",
            lastCheckedAt: new Date(),
            capabilitiesCache: JSON.stringify(capabilities),
          },
        })

        await transport.close?.()
        return NextResponse.json({ status: "online", capabilities })
      } else {
        return NextResponse.json({ status: "error", error: "Invalid transport" }, { status: 400 })
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      await prisma.mcpServer.update({
        where: { id },
        data: { status: "error", lastCheckedAt: new Date() },
      })
      return NextResponse.json({ status: "error", error: errMsg })
    }
  } catch (error) {
    console.error("Failed to test MCP:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
