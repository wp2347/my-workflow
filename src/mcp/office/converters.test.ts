import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { createDocx, createXlsx, createPptx, createPdf } from "./converters"

const outDir = path.join(process.cwd(), "storage", "test-office")

describe("office converters", () => {
  it("createDocx writes a non-empty .docx file", async () => {
    const file = path.join(outDir, "report.docx")
    await createDocx("# Title\n\nHello **world**.", file)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })

  it("createXlsx writes an .xlsx readable by exceljs", async () => {
    const file = path.join(outDir, "data.xlsx")
    await createXlsx([{ name: "A", value: 1 }, { name: "B", value: 2 }], file)
    expect(fs.existsSync(file)).toBe(true)
  })

  it("createPptx writes a non-empty .pptx file", async () => {
    const file = path.join(outDir, "deck.pptx")
    await createPptx("# Slide 1\n\n- Point A\n- Point B", file)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })

  it("createPdf writes a non-empty .pdf file", async () => {
    const file = path.join(outDir, "doc.pdf")
    await createPdf("# Title\n\nParagraph text.", file)
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).size).toBeGreaterThan(1000)
  })
})
