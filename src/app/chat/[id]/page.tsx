"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Workflow } from "lucide-react"
import { useTranslation } from "@/i18n"

export default function ChatPage() {
  const params = useParams()
  const workflowId = params.id as string
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-border bg-card flex items-center px-4 gap-3">
        <Link href={`/workflow/${workflowId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("chat.workflowTest")}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <ChatPanel workflowId={workflowId} />
      </div>
    </div>
  )
}
