import { describe, it, expect } from "vitest"
import { buildMusicTemplate } from "@/app/api/workflow/template/music/route"

describe("buildMusicTemplate", () => {
  it("zh 返回中文 label 与 3 节点 2 边", () => {
    const tpl = buildMusicTemplate("zh")
    expect(tpl.name).toBe("音乐生成模板")
    expect(tpl.nodes).toHaveLength(3)
    expect(tpl.edges).toHaveLength(2)
    const labels = tpl.nodes.map((n) => n.data.label)
    expect(labels).toEqual(["提示词", "音乐生成", "导出"])
    expect(tpl.nodes[1].data.type).toBe("music")
    expect((tpl.nodes[1].data.config as Record<string, unknown>).audioUrlField).toBe("data.audio_url")
  })

  it("en 返回英文 label", () => {
    const tpl = buildMusicTemplate("en")
    expect(tpl.nodes.map((n) => n.data.label)).toEqual(["Prompt", "Music Generation", "Export"])
  })

  it("默认(未知 lang) 回退 zh", () => {
    expect(buildMusicTemplate("fr").nodes.map((n) => n.data.label)).toEqual(["提示词", "音乐生成", "导出"])
  })
})
