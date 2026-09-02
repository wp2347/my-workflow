import fs from "fs"
import path from "path"
import { validatePackManifest, type PackManifest } from "./schema"

export function getBuiltinPacks(): PackManifest[] {
  const dir = path.join(process.cwd(), "src", "packs")
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"))
  const packs: PackManifest[] = []
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8")
    const result = validatePackManifest(JSON.parse(raw))
    if (!result.valid || !result.data) {
      throw new Error(`Invalid builtin pack ${file}: ${result.error}`)
    }
    packs.push(result.data)
  }
  return packs
}

export function getBuiltinPack(id: string): PackManifest | undefined {
  return getBuiltinPacks().find((p) => p.id === id)
}
