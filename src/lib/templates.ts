import { buildMusicTemplate, type Template } from "@/app/api/workflow/template/music/template"

export interface TemplateMeta {
  id: string
  nameKey: string
  descriptionKey: string
  icon: string
  category: string
}

export interface TemplateEntry extends TemplateMeta {
  build: (lang: string) => Template
}

export const TEMPLATES: TemplateEntry[] = [
  {
    id: "music",
    nameKey: "templates.list.music.name",
    descriptionKey: "templates.list.music.description",
    icon: "Music",
    category: "music",
    build: buildMusicTemplate,
  },
]

export function getTemplate(id: string): TemplateEntry | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function listTemplates(): TemplateMeta[] {
  return TEMPLATES.map(({ id, nameKey, descriptionKey, icon, category }) => ({ id, nameKey, descriptionKey, icon, category }))
}
