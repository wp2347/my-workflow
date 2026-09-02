import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { loadMcpExtensions } from "./mcp-manager"
import { uninstallPack } from "@/lib/packs/service"
import { encrypt } from "@/lib/crypto"

const TEST_PACK_ID = "test-pack-mcp"
const TEST_SERVER_NAME = "test-pack-server"

beforeAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

afterAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

describe("loadMcpExtensions with packId binding", () => {
  it("resolves {packId} by querying installed servers with that packId", async () => {
    await prisma.mcpServer.create({
      data: {
        name: TEST_SERVER_NAME,
        transport: "stdio",
        command: "echo",
        args: ["{}"],
        headers: "{}",
        env: encrypt(JSON.stringify({})),
        packId: TEST_PACK_ID,
      },
    })

    const findManySpy = vi.spyOn(prisma.mcpServer, "findMany")
    const payload = await loadMcpExtensions([{ packId: TEST_PACK_ID }], {} as never)
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { packId: { in: [TEST_PACK_ID] } } }),
    )
    findManySpy.mockRestore()

    expect(typeof payload).toBe("object")
    expect(payload.tools).toBeDefined()
  })

  it("skips unknown packIds gracefully", async () => {
    const payload = await loadMcpExtensions([{ packId: "no-such-pack" }], {} as never)
    expect(payload.tools).toEqual({})
    expect(payload.resourceContext).toEqual([])
  })
})
