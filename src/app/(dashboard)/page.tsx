"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Workflow, ArrowRight, Brain, MessageSquare, BookOpen } from "lucide-react"
import { useTranslation } from "@/i18n"

export default function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("home.welcome")}</h1>
        <p className="text-muted-foreground mt-1">{t("home.description")}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <div className="rounded-md bg-blue-100 p-2 w-fit mb-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <CardTitle className="text-base">{t("home.inputNodes")}</CardTitle>
            <CardDescription>{t("home.inputNodesDesc")}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="rounded-md bg-purple-100 p-2 w-fit mb-2">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <CardTitle className="text-base">{t("home.llmNodes")}</CardTitle>
            <CardDescription>{t("home.llmNodesDesc")}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="rounded-md bg-green-100 p-2 w-fit mb-2">
              <BookOpen className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle className="text-base">{t("home.outputNodes")}</CardTitle>
            <CardDescription>{t("home.outputNodesDesc")}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("home.getStarted")}</h2>
        <div className="flex gap-3">
          <Link href="/workflow/new">
            <Button>
              <Workflow className="h-4 w-4 mr-2" />
              {t("home.createWorkflow")}
            </Button>
          </Link>
          <Link href="/workflows">
            <Button variant="outline">
              {t("home.viewAll")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
