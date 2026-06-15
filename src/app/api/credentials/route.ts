import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encrypt, decrypt, maskValue } from "@/lib/crypto"

export async function GET() {
  try {
    const creds = await prisma.credential.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        scope: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(creds)
  } catch (error) {
    console.error("Failed to list credentials:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, type = "api_key", value, scope = "global", workflowId } = await req.json()
    if (!name || !value) {
      return NextResponse.json({ error: "name and value required" }, { status: 400 })
    }

    const cred = await prisma.credential.create({
      data: {
        name,
        type,
        value: encrypt(value),
        scope,
        workflowId: scope === "workflow" ? workflowId : null,
      },
    })

    return NextResponse.json({
      id: cred.id,
      name: cred.name,
      type: cred.type,
      scope: cred.scope,
      createdAt: cred.createdAt,
    }, { status: 201 })
  } catch (error) {
    console.error("Failed to create credential:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
