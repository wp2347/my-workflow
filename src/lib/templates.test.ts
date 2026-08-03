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
})
