import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { installPack, uninstallPack, getInstalledPackIds, isPackInstalled } from "./service"
import { validatePackManifest } from "./schema"

const TEST_PACK_ID = "test-pack"

const manifest = validatePackManifest({
  id: TEST_PACK_ID,
  name: "Test Pack",
  description: "for tests",
  version: "1.0.0",
  mcps: [
    { name: "test-mcp", transport: "stdio", command: "npx", args: ["-y", "some-server"], tools: "all" },
  ],
  skills: [
    { name: "test-skill", description: "d", content: "c" },
  ],
}).data!

beforeAll(async () => {
  await uninstallPack(TEST_PACK_ID)
  await prisma.pack.deleteMany({ where: { id: TEST_PACK_ID } })
})

afterAll(async () => {
  await uninstallPack(TEST_PACK_ID)
  await prisma.pack.deleteMany({ where: { id: TEST_PACK_ID } })
})

describe("installPack", () => {
  it("creates mcp server and skill rows with packId", async () => {
    await installPack(manifest)
    const mcps = await prisma.mcpServer.findMany({ where: { packId: TEST_PACK_ID } })
    const skills = await prisma.skill.findMany({ where: { packId: TEST_PACK_ID } })
    expect(mcps.length).toBe(1)
    expect(skills.length).toBe(1)
    expect(mcps[0].command).toBe("npx")
    expect(await isPackInstalled(TEST_PACK_ID)).toBe(true)
    expect((await getInstalledPackIds()).includes(TEST_PACK_ID)).toBe(true)
  })

  it("throws when already installed", async () => {
    await expect(installPack(manifest)).rejects.toThrow(/already installed/i)
  })

  it("uninstall removes all rows", async () => {
    await uninstallPack(TEST_PACK_ID)
    const mcps = await prisma.mcpServer.findMany({ where: { packId: TEST_PACK_ID } })
    expect(mcps.length).toBe(0)
    expect(await isPackInstalled(TEST_PACK_ID)).toBe(false)
  })
})
