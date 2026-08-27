import { describe, it, expect } from "vitest"
import { TEMPLATES, listTemplates, getTemplate } from "@/lib/templates"

describe("templates registry", () => {
  it("listTemplates 返回模板元信息列表（含 music）", () => {
    const list = listTemplates()
    expect(list.length).toBeGreaterThan(0)
    const music = list.find((t) => t.id === "music")
    expect(music).toBeDefined()
    expect(music?.icon).toBe("Music")
    expect(music?.category).toBe("music")
  })

  it("getTemplate 命中已有模板", () => {
    const tpl = getTemplate("music")
    expect(tpl).toBeDefined()
    expect(tpl?.id).toBe("music")
  })

  it("getTemplate 未知 id 返回 undefined", () => {
    expect(getTemplate("nonexistent")).toBeUndefined()
  })

  it("music 模板 build 返回 3 节点 2 边", () => {
    const tpl = getTemplate("music")
    const built = tpl!.build("zh")
    expect(built.nodes).toHaveLength(3)
    expect(built.edges).toHaveLength(2)
    expect(built.nodes[1].data.type).toBe("music")
  })

  // ===== Phase 3 场景模板 =====

  it("folder-batch-summary 模板：Agent 绑定 filesystem+office 且 maxSteps 提高", () => {
    const built = getTemplate("folder-batch-summary")!.build("zh")
    expect(built.nodes).toHaveLength(3)
    expect(built.nodes[1].data.type).toBe("llm")
    const cfg = built.nodes[1].data.config as Record<string, unknown>
    const ext = cfg.extensions as { skills: Array<{ packId: string }>; mcp: Array<{ packId: string }> }
    expect(ext.skills.map((s) => s.packId)).toEqual(expect.arrayContaining(["filesystem", "office"]))
    expect(ext.mcp.map((s) => s.packId)).toEqual(expect.arrayContaining(["filesystem", "office"]))
    expect(cfg.maxSteps).toBe(12)
    // 输出节点配置本地导出
    const outCfg = built.nodes[2].data.config as Record<string, unknown>
    expect(outCfg.exportMode).toBe("local")
    expect(outCfg.exportPath).toBe("storage/export/")
  })

  it("xlsx-data-insight 模板：提示词含 pptx 工具指引", () => {
    for (const lang of ["zh", "en"]) {
      const built = getTemplate("xlsx-data-insight")!.build(lang)
      const cfg = built.nodes[1].data.config as Record<string, unknown>
      expect(String(cfg.systemPrompt)).toContain("create_pptx")
      expect(built.edges).toHaveLength(2)
    }
  })

  it("两个新模板已出现在列表元信息中且分类为 file", () => {
    const list = listTemplates()
    expect(list.find((t) => t.id === "folder-batch-summary")?.category).toBe("file")
    expect(list.find((t) => t.id === "xlsx-data-insight")?.category).toBe("file")
  })
})
