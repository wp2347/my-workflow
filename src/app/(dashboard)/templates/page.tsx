"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LayoutTemplate, Loader2, Music, ArrowRight, Newspaper, Languages, GitCompare, Network, BellRing, FileText, Table, Presentation, FolderSearch2, ChartPie, Bot } from "lucide-react"
import { useTranslation } from "@/i18n"

interface TemplateItem {
  id: string
  nameKey: string
  descriptionKey: string
  icon: string
  category: string
}

const iconMap: Record<string, React.ReactNode> = {
  Music: <Music className="h-6 w-6" />,
  Newspaper: <Newspaper className="h-6 w-6" />,
  Languages: <Languages className="h-6 w-6" />,
  GitCompare: <GitCompare className="h-6 w-6" />,
  Network: <Network className="h-6 w-6" />,
  BellRing: <BellRing className="h-6 w-6" />,
  FileText: <FileText className="h-6 w-6" />,
  Table: <Table className="h-6 w-6" />,
  Presentation: <Presentation className="h-6 w-6" />,
  FolderSearch2: <FolderSearch2 className="h-6 w-6" />,
  ChartPie: <ChartPie className="h-6 w-6" />,
  Bot: <Bot className="h-6 w-6" />,
}

export default function TemplatesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(() => {
    setLoading(true)
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutTemplate className="h-6 w-6" />{t("templates.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("templates.description")}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <LayoutTemplate className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{t("templates.noTemplates")}</h3>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="group hover:border-primary transition-colors">
              <CardHeader className="py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary flex-shrink-0">{iconMap[tpl.icon] || <LayoutTemplate className="h-6 w-6" />}</div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm">{t(tpl.nameKey)}</CardTitle>
                    <CardDescription className="text-xs mt-1">{t(tpl.descriptionKey)}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant="outline" className="text-[10px]">{t(`templates.category.${tpl.category}`)}</Badge>
                  <Button size="sm" onClick={() => router.push(`/workflow/new?template=${tpl.id}`)}>
                    {t("templates.useTemplate")}<ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
