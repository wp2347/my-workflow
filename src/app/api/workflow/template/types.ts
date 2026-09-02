export interface TemplateNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: { type: string; label: string; config: Record<string, unknown> }
}
export interface TemplateEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}
export interface Template {
  name: string
  description: string
  nodes: TemplateNode[]
  edges: TemplateEdge[]
}

export interface TemplateMeta {
  id: string
  nameKey: string
  descriptionKey: string
  icon: string
  category: string
}
