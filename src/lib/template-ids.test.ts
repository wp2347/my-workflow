import { describe, it, expect } from "vitest"
import { rewriteTemplateIds } from "@/lib/template-ids"

describe("rewriteTemplateIds", () => {
  const idMap = new Map<string, string>([
    ["llm-1", "t_abc_llm-1"],
    ["input-1", "t_abc_input-1"],
  ])

  it("重写 {{ nodeId.field }} 简写语法", () => {
    expect(rewriteTemplateIds("{{ llm-1.text }}", idMap)).toBe("{{ t_abc_llm-1.text }}")
  })

  it("重写 {{ $node.nodeId.field }} 正式语法（当前 bug 的核心）", () => {
    expect(rewriteTemplateIds("{{ $node.llm-1.text }}", idMap)).toBe("{{ $node.t_abc_llm-1.text }}")
  })

  it("重写 {{ $node[\"nodeId\"].field }} 引号语法", () => {
    expect(rewriteTemplateIds('{{ $node["llm-1"].text }}', idMap)).toBe('{{ $node["t_abc_llm-1"].text }}')
  })

  it("无引用片段原样保留", () => {
    expect(rewriteTemplateIds("hello {{ $input.message }}", idMap)).toBe("hello {{ $input.message }}")
  })

  it("递归重写嵌套对象与数组中的字符串", () => {
    const input = {
      config: { template: "{{ $node.llm-1.text }}" },
      list: ["{{ input-1.message }}", "plain"],
    }
    const out = rewriteTemplateIds(input, idMap) as Record<string, unknown>
    expect(out.config).toEqual({ template: "{{ $node.t_abc_llm-1.text }}" })
    expect(out.list).toEqual(["{{ t_abc_input-1.message }}", "plain"])
  })

  it("重写时不误伤含相同前缀的其他 ID（llm-1 不影响 llm-10）", () => {
    const out = rewriteTemplateIds("{{ llm-10.text }} {{ llm-1.text }}", idMap)
    expect(out).toBe("{{ llm-10.text }} {{ t_abc_llm-1.text }}")
  })
})