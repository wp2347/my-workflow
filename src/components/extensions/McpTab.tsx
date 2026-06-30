"use client"

import { useEffect } from "react"
import { useTranslation } from "@/i18n"
import { useExtensionsStore } from "@/stores/extensions"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Circle } from "lucide-react"

export function McpTab() {
  const { t } = useTranslation()
  const { mcpServers, loading, fetchMcpServers } = useExtensionsStore()

  useEffect(() => {
    fetchMcpServers()
  }, [fetchMcpServers])

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>
  if (mcpServers.length === 0) return <div className="text-muted-foreground text-sm">{t("extensions.common.noData")}</div>

  const statusColor: Record<string, string> = {
    online: "text-green-500",
    offline: "text-gray-400",
    error: "text-red-500",
    untested: "text-yellow-500",
    checking: "text-blue-500",
  }

  const statusLabel: Record<string, string> = {
    online: t("extensions.mcp.statusOnline"),
    offline: t("extensions.mcp.statusOffline"),
    error: t("extensions.mcp.statusError"),
    untested: t("extensions.mcp.statusUntested"),
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {mcpServers.map((server) => (
        <Card key={server.id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{server.name}</h3>
              <div className="flex items-center gap-1">
                <Circle className={`h-2 w-2 fill-current ${statusColor[server.status] || statusColor.untested}`} />
                <span className="text-xs text-muted-foreground">{statusLabel[server.status] || statusLabel.untested}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">{server.description || ""}</p>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="uppercase">{server.transport}</Badge>
            {server.hasAuth && <Badge variant="secondary">Auth</Badge>}
            <span className="text-muted-foreground truncate">{server.url || server.command || ""}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}
