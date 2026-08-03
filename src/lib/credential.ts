import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"

/**
 * 按凭证 ID 读取解密后的值。
 * - credentialId 为空 → 返回 null（不查库）
 * - 凭证不存在 → 返回 null（调用方决定如何处理）
 * - 凭证存在 → 解密返回明文值
 */
export async function resolveCredentialValue(credentialId?: string | null): Promise<string | null> {
  if (!credentialId) return null
  const cred = await prisma.credential.findUnique({ where: { id: credentialId } })
  if (!cred) return null
  return decrypt(cred.value)
}
