import fs from "fs"
import path from "path"
import { marked, type Tokens } from "marked"
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx"
import ExcelJS from "exceljs"
import pptxgen from "pptxgenjs"
import pdfmake from "pdfmake/build/pdfmake"
import * as pdfFonts from "pdfmake/build/vfs_fonts"
import { resolveAllowedPath } from "./path"

;(pdfmake as unknown as { vfs: unknown }).vfs = pdfFonts.vfs

const lexer = new marked.Lexer()

interface RunDef {
  text: string
  bold?: boolean
  italics?: boolean
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function lexInline(text: string): Tokens.Generic[] {
  return lexer.inlineTokens(text) as Tokens.Generic[]
}

function inlineRuns(tokens: Tokens.Generic[]): RunDef[] {
  const runs: RunDef[] = []
  const walk = (nodes: Tokens.Generic[]): void => {
    for (const tok of nodes) {
      if (tok.type === "strong") {
        walk((tok as Tokens.Strong).tokens as Tokens.Generic[])
      } else if (tok.type === "em") {
        for (const r of inlineRuns((tok as Tokens.Em).tokens as Tokens.Generic[])) {
          runs.push({ ...r, italics: true })
        }
      } else if (tok.type === "codespan") {
        const t = (tok as Tokens.Codespan).text
        if (t) runs.push({ text: t, bold: true })
      } else if (tok.type === "link") {
        walk((tok as Tokens.Link).tokens as Tokens.Generic[])
      } else if (tok.type === "text") {
        const t = (tok as Tokens.Text).text
        if (t) runs.push({ text: t })
      }
    }
  }
  walk(tokens)
  return runs
}

function headingLevel(level: number) {
  return [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level - 1] || HeadingLevel.HEADING_3
}

export async function createDocx(markdown: string, outputPath: string): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const tokens = marked.lexer(markdown)
  const children: Array<Paragraph | Table> = []
  for (const token of tokens) {
    if (token.type === "heading") {
      const h = token as Tokens.Heading
      children.push(new Paragraph({ heading: headingLevel(h.depth), children: inlineRuns(h.tokens as Tokens.Generic[]).map((r) => new TextRun(r)) }))
    } else if (token.type === "paragraph") {
      const p = token as Tokens.Paragraph
      children.push(new Paragraph({ children: inlineRuns(p.tokens as Tokens.Generic[]).map((r) => new TextRun(r)) }))
    } else if (token.type === "list") {
      const list = token as Tokens.List
      for (const item of list.items) {
        const textTokens = (item.tokens as Tokens.Generic[]).filter((t) => t.type !== "list")
        children.push(new Paragraph({ children: inlineRuns(textTokens).map((r) => new TextRun(r)), bullet: { level: 0 } }))
      }
    } else if (token.type === "table") {
      const table = token as Tokens.Table
      const header = new TableRow({
        children: table.header.map((c) => new TableCell({ children: [new Paragraph({ children: inlineRuns(lexInline(c.text)).map((r) => new TextRun(r)) })] })),
      })
      const rows = table.rows.map((r) =>
        new TableRow({
          children: r.map((c) => new TableCell({ children: [new Paragraph({ children: inlineRuns(lexInline(c.text)).map((rr) => new TextRun(rr)) })] })),
        }),
      )
      children.push(new Paragraph({ text: "" }))
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }))
    } else if (token.type === "hr") {
      children.push(new Paragraph({ border: { bottom: { style: "single", size: 6, color: "CCCCCC" } }, text: "" }))
    }
  }
  const doc = new Document({ sections: [{ properties: {}, children }] })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(file, buffer)
  return file
}

export async function createXlsx(rows: Array<Record<string, unknown>>, outputPath: string, sheetName = "Sheet1"): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  if (rows.length === 0) {
    await workbook.xlsx.writeFile(file)
    return file
  }
  const headers = Object.keys(rows[0])
  sheet.addRow(headers)
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ""))
  }
  sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(h.length + 4, 12) }))
  await workbook.xlsx.writeFile(file)
  return file
}

export async function createPptx(outline: string, outputPath: string): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const pptx = new pptxgen()
  let slide = pptx.addSlide()
  for (const line of outline.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith("# ")) {
      const title = trimmed.slice(2).trim()
      slide = pptx.addSlide()
      slide.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 28, bold: true })
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      slide.addText(trimmed.slice(2).trim(), { x: 0.8, y: 1.2, w: 8.4, h: 0.4, fontSize: 18, bullet: true })
    } else {
      slide.addText(trimmed, { x: 0.8, y: 1.2, w: 8.4, h: 0.4, fontSize: 18 })
    }
  }
  await pptx.writeFile({ fileName: file })
  return file
}

export async function createPdf(content: string, outputPath: string): Promise<string> {
  const file = resolveAllowedPath(outputPath)
  ensureDir(file)
  const tokens = marked.lexer(content)
  const ddContent: unknown[] = []
  for (const token of tokens) {
    if (token.type === "heading") {
      const h = token as Tokens.Heading
      const fontSize = Math.max(24 - h.depth * 3, 12)
      ddContent.push({ text: h.text, fontSize, bold: true, margin: [0, 10, 0, 4] })
    } else if (token.type === "paragraph") {
      ddContent.push({ text: (token as Tokens.Paragraph).text, margin: [0, 2, 0, 2] })
    } else if (token.type === "list") {
      for (const item of (token as Tokens.List).items) {
        const text = item.tokens.filter((t) => t.type === "text").map((t) => (t as Tokens.Text).text).join("")
        ddContent.push({ text: `• ${text}`, margin: [10, 1, 0, 1] })
      }
    } else if (token.type === "table") {
      const table = token as Tokens.Table
      const header = table.header.map((c) => ({ text: c.text, bold: true }))
      const bodyRows = table.rows.map((r) => r.map((c) => ({ text: c.text })))
      ddContent.push({ table: { headerRows: 1, widths: table.header.map(() => "*"), body: [header, ...bodyRows] }, margin: [0, 6, 0, 6] })
    }
  }
  const docDefinition = {
    content: ddContent,
    defaultStyle: { font: "Roboto", fontSize: 11 },
  }
  const pdfDoc = pdfmake.createPdf(docDefinition as never)
  const buffer: Buffer = await pdfDoc.getBuffer()
  fs.writeFileSync(file, buffer)
  return file
}
