import { describe, it, expect } from "vitest"
import { getByPath } from "@/lib/json-path"

describe("getByPath", () => {
  it("按点路径取值", () => {
    expect(getByPath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1)
  })
  it("数组索引 [n]", () => {
    expect(getByPath({ list: [{ x: 9 }] }, "list[0].x")).toBe(9)
  })
  it("路径不存在返回 undefined", () => {
    expect(getByPath({ a: 1 }, "b.c")).toBeUndefined()
  })
  it("null 中途返回 undefined", () => {
    expect(getByPath({ a: null }, "a.b")).toBeUndefined()
  })
})