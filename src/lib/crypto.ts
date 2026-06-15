import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || "my-workflow-default-key-32chars!"
  return crypto.createHash("sha256").update(key).digest()
}

const IV_LENGTH = 12
const TAG_LENGTH = 16

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  const tag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`
}

export function decrypt(combined: string): string {
  const key = getKey()
  const [ivHex, tagHex, encrypted] = combined.split(":")

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

export function maskValue(value: string): string {
  if (value.length <= 8) return "****"
  return value.substring(0, 4) + "****" + value.substring(value.length - 4)
}
