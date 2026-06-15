import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt, maskValue } from "@/lib/crypto"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const cred = await prisma.credential.findUnique({ where: { id } })
    if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({
      id: cred.id,
      name: cred.name,
      type: cred.type,
      scope: cred.scope,
      value: decrypt(cred.value),
    })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.credential.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
