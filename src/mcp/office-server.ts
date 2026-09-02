#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { createDocx, createXlsx, createPptx, createPdf } from "./office/converters"

const server = new McpServer({ name: "office", version: "1.0.0" })

server.tool(
  "create_docx",
  "Create a Word (.docx) document from Markdown. outputPath must end with .docx and start with storage/.",
  { markdown: z.string(), outputPath: z.string() },
  async ({ markdown, outputPath }) => {
    try {
      const path = await createDocx(markdown, outputPath)
      return { content: [{ type: "text" as const, text: `Created docx at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

server.tool(
  "create_xlsx",
  "Create an Excel (.xlsx) file from an array of JSON objects. Keys become the header row. outputPath must end with .xlsx and start with storage/.",
  { rows: z.array(z.record(z.string(), z.any())), outputPath: z.string() },
  async ({ rows, outputPath }) => {
    try {
      const path = await createXlsx(rows, outputPath)
      return { content: [{ type: "text" as const, text: `Created xlsx at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

server.tool(
  "create_pptx",
  "Create a PowerPoint (.pptx) from a Markdown outline. Each top-level heading is a slide; bullets become list items. outputPath must end with .pptx and start with storage/.",
  { outline: z.string(), outputPath: z.string() },
  async ({ outline, outputPath }) => {
    try {
      const path = await createPptx(outline, outputPath)
      return { content: [{ type: "text" as const, text: `Created pptx at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

server.tool(
  "create_pdf",
  "Create a PDF file from Markdown content. outputPath must end with .pdf and start with storage/.",
  { content: z.string(), outputPath: z.string() },
  async ({ content, outputPath }) => {
    try {
      const path = await createPdf(content, outputPath)
      return { content: [{ type: "text" as const, text: `Created pdf at ${path}` }] }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true }
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("[office-server] failed to start:", err)
  process.exit(1)
})
