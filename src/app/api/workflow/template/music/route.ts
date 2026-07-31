import { NextRequest, NextResponse } from "next/server"

interface TemplateNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: { type: string; label: string; config: Record<string, unknown> }
}
interface TemplateEdge { id: string; source: string; target: string }
interface Template { name: string; description: string; nodes: TemplateNode[]; edges: TemplateEdge[] }

const I18N = {
  zh: {
    name: "音乐生成模板",
    description: "输入提示词自动生成音乐并导出",
    labelInput: "提示词", labelMusic: "音乐生成", labelOutput: "导出",
  },
  en: {
    name: "Music Generation Template",
    description: "Generate music from a prompt and export it",
    labelInput: "Prompt", labelMusic: "Music Generation", labelOutput: "Export",
  },
}

export function buildMusicTemplate(lang: string): Template {
  const i = lang === "en" ? I18N.en : I18N.zh
  const musicDefault: Record<string, unknown> = {
    apiUrl: "", method: "POST", headers: { "Content-Type": "application/json" },
    bodyTemplate: '{\n  "prompt": "{{ $input.prompt }}",\n  "style": "",\n  "duration": 0\n}',
    auth: "none", authToken: "",
    pollingEnabled: false, taskIdField: "data.task_id", pollUrlTemplate: "",
    pollIntervalMs: 3000, pollMaxAttempts: 60, pollStatusField: "", pollSuccessValue: "",
    audioUrlField: "data.audio_url", metadataField: "data.metadata",
  }
  return {
    name: i.name,
    description: i.description,
    nodes: [
      { id: "input-1", type: "input", position: { x: 100, y: 200 },
        data: { type: "input", label: i.labelInput, config: { name: "prompt", type: "text", required: true, default: "" } } },
      { id: "music-1", type: "music", position: { x: 400, y: 200 },
        data: { type: "music", label: i.labelMusic, config: musicDefault } },
      { id: "output-1", type: "output", position: { x: 700, y: 200 },
        data: { type: "output", label: i.labelOutput, config: { format: "text", template: "", exportMode: "download", exportPath: "storage/exports/", remoteUrl: "" } } },
    ],
    edges: [
      { id: "e1", source: "input-1", target: "music-1" },
      { id: "e2", source: "music-1", target: "output-1" },
    ],
  }
}

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") || "zh"
  return NextResponse.json(buildMusicTemplate(lang))
}
