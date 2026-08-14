import { buildMusicTemplate } from "@/app/api/workflow/template/music/template"
import { buildDailyBriefTemplate } from "@/app/api/workflow/template/daily-brief/template"
import { buildLlmAppsTemplate } from "@/app/api/workflow/template/llm-apps/template"
import { buildModelCompareTemplate } from "@/app/api/workflow/template/model-compare/template"
import { buildSupportRoutingTemplate } from "@/app/api/workflow/template/support-routing/template"
import { buildReminderTemplate } from "@/app/api/workflow/template/reminder/template"
import { buildFileToDocxTemplate } from "@/app/api/workflow/template/file-to-docx/template"
import { buildDataToXlsxTemplate } from "@/app/api/workflow/template/data-to-xlsx/template"
import { buildMarkdownToPptxTemplate } from "@/app/api/workflow/template/markdown-to-pptx/template"
import type { Template, TemplateMeta } from "@/app/api/workflow/template/types"

export type { Template, TemplateMeta, TemplateNode, TemplateEdge } from "@/app/api/workflow/template/types"

export interface TemplateEntry extends TemplateMeta {
  build: (lang: string) => Template
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: "daily-brief",
    nameKey: "templates.list.dailyBrief.name",
    descriptionKey: "templates.list.dailyBrief.description",
    icon: "Newspaper",
    category: "automation",
    build: buildDailyBriefTemplate,
  },
  {
    id: "llm-apps",
    nameKey: "templates.list.llmApps.name",
    descriptionKey: "templates.list.llmApps.description",
    icon: "Languages",
    category: "llm",
    build: buildLlmAppsTemplate,
  },
  {
    id: "model-compare",
    nameKey: "templates.list.modelCompare.name",
    descriptionKey: "templates.list.modelCompare.description",
    icon: "GitCompare",
    category: "llm",
    build: buildModelCompareTemplate,
  },
  {
    id: "support-routing",
    nameKey: "templates.list.supportRouting.name",
    descriptionKey: "templates.list.supportRouting.description",
    icon: "Network",
    category: "automation",
    build: buildSupportRoutingTemplate,
  },
  {
    id: "reminder",
    nameKey: "templates.list.reminder.name",
    descriptionKey: "templates.list.reminder.description",
    icon: "BellRing",
    category: "automation",
    build: buildReminderTemplate,
  },
  {
    id: "music",
    nameKey: "templates.list.music.name",
    descriptionKey: "templates.list.music.description",
    icon: "Music",
    category: "music",
    build: buildMusicTemplate,
  },
  {
    id: "file-to-docx",
    nameKey: "templates.list.fileToDocx.name",
    descriptionKey: "templates.list.fileToDocx.description",
    icon: "FileText",
    category: "file",
    build: buildFileToDocxTemplate,
  },
  {
    id: "data-to-xlsx",
    nameKey: "templates.list.dataToXlsx.name",
    descriptionKey: "templates.list.dataToXlsx.description",
    icon: "Table",
    category: "file",
    build: buildDataToXlsxTemplate,
  },
  {
    id: "markdown-to-pptx",
    nameKey: "templates.list.markdownToPptx.name",
    descriptionKey: "templates.list.markdownToPptx.description",
    icon: "Presentation",
    category: "file",
    build: buildMarkdownToPptxTemplate,
  },
]

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function listTemplates(): TemplateMeta[] {
  return TEMPLATES.map(({ id, nameKey, descriptionKey, icon, category }) => ({ id, nameKey, descriptionKey, icon, category }))
}
