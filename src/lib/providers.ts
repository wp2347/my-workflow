export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  maxOutputTokens: number
}

export interface ProviderInfo {
  id: string
  name: string
  models: ModelInfo[]
  defaultApiKeyEnv: string
  defaultBaseUrl: string
  docs: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    defaultApiKeyEnv: "OPENAI_API_KEY",
    defaultBaseUrl: "https://api.openai.com/v1",
    docs: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-5.5", name: "GPT-5.5", contextWindow: 200000, maxOutputTokens: 32768 },
      { id: "gpt-5", name: "GPT-5", contextWindow: 200000, maxOutputTokens: 32768 },
      { id: "gpt-5-mini", name: "GPT-5 Mini", contextWindow: 200000, maxOutputTokens: 16384 },
      { id: "gpt-5-nano", name: "GPT-5 Nano", contextWindow: 200000, maxOutputTokens: 16384 },
      { id: "gpt-4.1", name: "GPT-4.1", contextWindow: 1000000, maxOutputTokens: 32768 },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", contextWindow: 1000000, maxOutputTokens: 16384 },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", contextWindow: 1000000, maxOutputTokens: 16384 },
      { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutputTokens: 16384 },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", contextWindow: 128000, maxOutputTokens: 16384 },
      { id: "o4-mini", name: "o4 Mini", contextWindow: 200000, maxOutputTokens: 100000 },
      { id: "o3", name: "o3", contextWindow: 200000, maxOutputTokens: 100000 },
      { id: "o3-mini", name: "o3 Mini", contextWindow: 200000, maxOutputTokens: 100000 },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    defaultApiKeyEnv: "ANTHROPIC_API_KEY",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    docs: "https://console.anthropic.com/keys",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, maxOutputTokens: 64000 },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", contextWindow: 200000, maxOutputTokens: 32000 },
      { id: "claude-3.5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextWindow: 200000, maxOutputTokens: 8192 },
      { id: "claude-3.5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutputTokens: 8192 },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", contextWindow: 200000, maxOutputTokens: 4096 },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    defaultApiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    docs: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 2097152, maxOutputTokens: 65536 },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, maxOutputTokens: 65536 },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1048576, maxOutputTokens: 8192 },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultApiKeyEnv: "DEEPSEEK_API_KEY",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    docs: "https://platform.deepseek.com/api_keys",
    models: [
      { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", contextWindow: 1000000, maxOutputTokens: 384000 },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", contextWindow: 1000000, maxOutputTokens: 384000 },
      { id: "deepseek-chat", name: "DeepSeek V3 (Legacy)", contextWindow: 65536, maxOutputTokens: 8192 },
      { id: "deepseek-reasoner", name: "DeepSeek R1 (Legacy)", contextWindow: 65536, maxOutputTokens: 8192 },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    defaultApiKeyEnv: "GROQ_API_KEY",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    docs: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextWindow: 131072, maxOutputTokens: 32768 },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", contextWindow: 131072, maxOutputTokens: 131072 },
      { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", contextWindow: 131072, maxOutputTokens: 8192 },
      { id: "qwen/qwen3-32b", name: "Qwen 3 32B", contextWindow: 131072, maxOutputTokens: 40960 },
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", contextWindow: 131072, maxOutputTokens: 65536 },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    defaultApiKeyEnv: "MISTRAL_API_KEY",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    docs: "https://console.mistral.ai/api-keys",
    models: [
      { id: "mistral-medium-latest", name: "Mistral Medium 3.5", contextWindow: 256000, maxOutputTokens: 131072 },
      { id: "mistral-small-latest", name: "Mistral Small 4", contextWindow: 256000, maxOutputTokens: 131072 },
      { id: "mistral-large-latest", name: "Mistral Large 3", contextWindow: 256000, maxOutputTokens: 131072 },
      { id: "ministral-8b-latest", name: "Ministral 3 8B", contextWindow: 256000, maxOutputTokens: 8192 },
      { id: "ministral-3b-latest", name: "Ministral 3 3B", contextWindow: 256000, maxOutputTokens: 8192 },
      { id: "codestral-latest", name: "Codestral", contextWindow: 256000, maxOutputTokens: 8192 },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    defaultApiKeyEnv: "XAI_API_KEY",
    defaultBaseUrl: "https://api.x.ai/v1",
    docs: "https://console.x.ai",
    models: [
      { id: "grok-4.3", name: "Grok 4.3", contextWindow: 1000000, maxOutputTokens: 32768 },
      { id: "grok-4.20-0309-reasoning", name: "Grok 4.20 Reasoning", contextWindow: 1000000, maxOutputTokens: 32768 },
      { id: "grok-4.20-0309-non-reasoning", name: "Grok 4.20", contextWindow: 1000000, maxOutputTokens: 32768 },
      { id: "grok-build-0.1", name: "Grok Build 0.1", contextWindow: 256000, maxOutputTokens: 32768 },
    ],
  },
  {
    id: "cohere",
    name: "Cohere",
    defaultApiKeyEnv: "COHERE_API_KEY",
    defaultBaseUrl: "https://api.cohere.ai/v1",
    docs: "https://dashboard.cohere.ai/api-keys",
    models: [
      { id: "command-a-03-2025", name: "Command A", contextWindow: 256000, maxOutputTokens: 4096 },
      { id: "command-r-plus-08-2024", name: "Command R+", contextWindow: 128000, maxOutputTokens: 4096 },
      { id: "command-r-08-2024", name: "Command R", contextWindow: 128000, maxOutputTokens: 4096 },
    ],
  },
  {
    id: "openai-compatible",
    name: "Custom / Proxy",
    defaultApiKeyEnv: "",
    defaultBaseUrl: "https://api.openai.com/v1",
    docs: "https://platform.openai.com",
    models: [
      { id: "custom-model", name: "Type model ID manually", contextWindow: 128000, maxOutputTokens: 16384 },
    ],
  },
]

export function getProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getModelInfo(providerId: string, modelId: string): ModelInfo | undefined {
  const provider = getProvider(providerId)
  return provider?.models.find((m) => m.id === modelId)
}

export function getAllModels(): Array<ModelInfo & { provider: string; providerName: string }> {
  return PROVIDERS.flatMap((p) =>
    p.models.map((m) => ({
      ...m,
      provider: p.id,
      providerName: p.name,
    })),
  )
}
