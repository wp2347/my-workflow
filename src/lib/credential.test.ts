import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveCredentialValue } from "@/lib/credential"

const { prismaMock, decryptMock } = vi.hoisted(() => {
  return {
    prismaMock: { credential: { findUnique: vi.fn() } },
    decryptMock: vi.fn(),
  }
})
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

vi.mock("@/lib/crypto", () => ({
  decrypt: decryptMock,
}))

describe("resolveCredentialValue", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("credentialId 为空返回 null（不查询数据库）", async () => {
    const res = await resolveCredentialValue("")
    expect(res).toBeNull()
    expect(prismaMock.credential.findUnique).not.toHaveBeenCalled()
  })

  it("credentialId 为 undefined 返回 null", async () => {
    const res = await resolveCredentialValue(undefined)
    expect(res).toBeNull()
  })

  it("凭证不存在返回 null", async () => {
    prismaMock.credential.findUnique.mockResolvedValue(null)
    const res = await resolveCredentialValue("missing-id")
    expect(res).toBeNull()
    expect(prismaMock.credential.findUnique).toHaveBeenCalledWith({ where: { id: "missing-id" } })
  })

  it("凭证存在时解密并返回值", async () => {
    decryptMock.mockReturnValue("sk-real-key")
    prismaMock.credential.findUnique.mockResolvedValue({ id: "c1", value: "encrypted-blob" })
    const res = await resolveCredentialValue("c1")
    expect(res).toBe("sk-real-key")
    expect(decryptMock).toHaveBeenCalledWith("encrypted-blob")
  })
})
