"use client"

import { useTranslation } from "@/i18n"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FolderOpen, FileText, Package } from "lucide-react"
import type { PackItem } from "@/stores/extensions"

interface PacksTabProps {
  packs: PackItem[]
  loading: boolean
  onInstall: (id: string) => Promise<void>
  onUninstall: (id: string) => Promise<void>
}

const iconMap: Record<string, React.ReactNode> = {
  "folder-open": <FolderOpen className="h-5 w-5" />,
  "file-text": <FileText className="h-5 w-5" />,
}

export function PacksTab({ packs, loading, onInstall, onUninstall }: PacksTabProps) {
  const { t } = useTranslation()

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (packs.length === 0) return <div className="text-muted-foreground text-sm">{t("packs.empty")}</div>

  const handleToggle = async (pack: PackItem) => {
    if (pack.installed) {
      if (!confirm(t("packs.uninstallConfirm", { name: pack.name }))) return
      await onUninstall(pack.id)
    } else {
      await onInstall(pack.id)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {packs.map((pack) => (
        <Card key={pack.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-node-llm-bg p-1.5 text-node-llm">
                {iconMap[pack.icon || ""] || <Package className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {pack.source === "builtin"
                    ? t(`packs.${pack.id}.name`)
                    : pack.name}
                </h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{pack.version}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {pack.source === "builtin" ? t("packs.source.official") : t("packs.source.imported")}
                  </Badge>
                  {pack.installed && <Badge variant="info" className="text-[10px]">{t("packs.installed")}</Badge>}
                </div>
              </div>
            </div>
            <Button
              variant={pack.installed ? "outline" : "default"}
              size="sm"
              disabled={loading}
              onClick={() => handleToggle(pack)}
            >
              {pack.installed ? t("packs.uninstall") : t("packs.install")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {pack.source === "builtin"
              ? t(`packs.${pack.id}.description`)
              : pack.description}
          </p>
        </Card>
      ))}
    </div>
  )
}
