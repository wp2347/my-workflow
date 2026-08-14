import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/crypto"
import type { PackManifest } from "./schema"

export async function isPackInstalled(packId: string): Promise<boolean> {
  const [m, s, p] = await Promise.all([
    prisma.mcpServer.count({ where: { packId } }),
    prisma.skill.count({ where: { packId } }),
    prisma.prompt.count({ where: { packId } }),
  ])
  return m > 0 || s > 0 || p > 0
}

export async function getInstalledPackIds(): Promise<string[]> {
  const [mcps, skills, prompts] = await Promise.all([
    prisma.mcpServer.findMany({ where: { packId: { not: null } }, select: { packId: true } }),
    prisma.skill.findMany({ where: { packId: { not: null } }, select: { packId: true } }),
    prisma.prompt.findMany({ where: { packId: { not: null } }, select: { packId: true } }),
  ])
  const ids = new Set<string>()
  for (const row of [...mcps, ...skills, ...prompts]) {
    if (row.packId) ids.add(row.packId)
  }
  return [...ids]
}

export async function installPack(manifest: PackManifest, _source: "builtin" | "imported"): Promise<void> {
  const { id, mcps, skills, prompts } = manifest
  if (await isPackInstalled(id)) {
    throw new Error(`Pack ${id} is already installed`)
  }
  await prisma.$transaction(async (tx) => {
    for (const m of mcps) {
      await tx.mcpServer.create({
        data: {
          name: m.name,
          description: manifest.description,
          transport: m.transport,
          url: m.url || null,
          headers: m.headers ? encrypt(JSON.stringify(m.headers)) : "{}",
          command: m.command || null,
          args: m.args || [],
          env: m.env ? encrypt(JSON.stringify(m.env)) : "{}",
          tags: ["pack"],
          packId: id,
        },
      })
    }
    for (const s of skills) {
      await tx.skill.create({
        data: {
          name: s.name,
          description: s.description,
          category: s.category || manifest.category || null,
          content: s.content,
          attachments: [],
          tags: s.tags || [],
          packId: id,
        },
      })
    }
    for (const p of prompts) {
      await tx.prompt.create({
        data: {
          name: p.name,
          description: p.description,
          category: p.category || manifest.category || null,
          content: p.content,
          variables: p.variables || [],
          role: p.role || "system",
          tags: p.tags || [],
          packId: id,
        },
      })
    }
  })
}

export async function uninstallPack(packId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mcpServer.deleteMany({ where: { packId } }),
    prisma.skill.deleteMany({ where: { packId } }),
    prisma.prompt.deleteMany({ where: { packId } }),
  ])
}
