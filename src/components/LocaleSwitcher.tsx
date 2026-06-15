"use client"

import { useTranslation } from "@/i18n"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"

export function LocaleSwitcher() {
  const { locale, setLocale } = useTranslation()

  const toggle = () => {
    setLocale(locale === "zh" ? "en" : "zh")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={toggle}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      <Globe className="h-4 w-4" />
    </Button>
  )
}
