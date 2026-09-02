import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { loadSkills } from "./skill-loader"
import { uninstallPack } from "@/lib/packs/service"

const TEST_PACK_ID = "test-pack-skill-loader"
const TEST_SKILL_NAME = "test-pack-skill"

beforeAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

afterAll(async () => {
  await uninstallPack(TEST_PACK_ID)
})

describe("loadSkills with packId binding", () => {
  it("resolves {packId} to installed skills with that packId", async () => {
    await prisma.skill.create({
      data: {
        name: TEST_SKILL_NAME,
        description: "test",
        content: "You are a test skill.",
        packId: TEST_PACK_ID,
      },
    })

    const payload = await loadSkills([{ packId: TEST_PACK_ID }], {} as never)
    expect(payload.systemContext.length).toBe(1)
    expect(payload.systemContext[0]).toContain("test skill")
  })

  it("keeps plain skill ids and skips unknown packIds", async () => {
    const payload = await loadSkills(["nonexistent-id", { packId: "no-such-pack" }], {} as never)
    expect(payload.systemContext.length).toBe(0)
  })
})
