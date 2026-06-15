"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { LocaleSwitcher } from "@/components/LocaleSwitcher"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/i18n"
import { Workflow, Plus, Home, Activity, Shield, Database } from "lucide-react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <div className="flex h-full">
      <aside className="w-56 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">My Workflow</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/"
            className={cn(
              buttonVariants({
                variant: pathname === "/" ? "secondary" : "ghost",
                size: "sm",
              }),
              "w-full justify-start",
            )}
          >
            <Home className="h-4 w-4 mr-2" />
            {t("sidebar.home")}
          </Link>

          <Link
            href="/workflows"
            className={cn(
              buttonVariants({
                variant: pathname.startsWith("/workflow") ? "secondary" : "ghost",
                size: "sm",
              }),
              "w-full justify-start",
            )}
          >
            <Workflow className="h-4 w-4 mr-2" />
            {t("sidebar.workflows")}
          </Link>

          <Link
            href="/history"
            className={cn(
              buttonVariants({
                variant: pathname === "/history" ? "secondary" : "ghost",
                size: "sm",
              }),
              "w-full justify-start",
            )}
          >
            <Activity className="h-4 w-4 mr-2" />
            执行历史
          </Link>

          <Link
            href="/credentials"
            className={cn(
              buttonVariants({
                variant: pathname === "/credentials" ? "secondary" : "ghost",
                size: "sm",
              }),
              "w-full justify-start",
            )}
          >
            <Shield className="h-4 w-4 mr-2" />
            凭证管理
          </Link>

          <Link
            href="/knowledge"
            className={cn(buttonVariants({ variant: pathname === "/knowledge" ? "secondary" : "ghost", size: "sm" }), "w-full justify-start")}
          >
            <Database className="h-4 w-4 mr-2" />知识库
          </Link>

          <Separator className="my-2" />

          <Link
            href="/workflow/new"
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "w-full justify-start",
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("sidebar.newWorkflow")}
          </Link>
        </nav>

        <div className="p-3 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{t("app.version")}</div>
          <LocaleSwitcher />
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
