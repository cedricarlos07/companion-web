import { config } from '../config.js'

/**
 * Ollama provider — embeddings + structured generation, 100 % local (BYOK/self-hosted).
 * Every call degrades gracefully: if Ollama is unreachable the caller falls back
 * to the deterministic local provider.
 */

export interface OllamaStatus {
  available: boolean
  llmModel: string
  embedModel: string
}

export async function ollamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) })
    if (!res.ok) return { available: false, llmModel: config.llmModel, embedModel: config.embedModel }
    const data = (await res.json()) as { models?: { name: string }[] }
    const names = (data.models ?? []).map((m) => m.name)
    return {
      available: names.length > 0,
      llmModel: names.some((n) => n.startsWith(config.llmModel)) ? config.llmModel : (names[0] ?? config.llmModel),
      embedModel: names.some((n) => n.startsWith(config.embedModel)) ? config.embedModel : (names[0] ?? config.embedModel),
    }
  } catch {
    return { available: false, llmModel: config.llmModel, embedModel: config.embedModel }
  }
}

export async function ollamaEmbed(input: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.embedModel, input }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { embeddings?: number[][] }
    const emb = data.embeddings?.[0]
    return Array.isArray(emb) && emb.length > 0 ? emb : null
  } catch {
    return null
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Structured generation — Ollama `format: json` + schema instruction in the prompt. */
export async function ollamaChatJson(
  messages: ChatMessage[],
  options: { temperature?: number; timeoutMs?: number } = {},
): Promise<unknown | null> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.llmModel,
        messages,
        stream: false,
        format: 'json',
        options: { temperature: options.temperature ?? 0.2 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string } }
    if (!data.message?.content) return null
    try {
      return JSON.parse(data.message.content)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

export async function ollamaChat(
  messages: ChatMessage[],
  options: { temperature?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.llmModel,
        messages,
        stream: false,
        options: { temperature: options.temperature ?? 0.3 },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 120000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string } }
    return data.message?.content ?? null
  } catch {
    return null
  }
}
