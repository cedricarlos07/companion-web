import type { DbHandle } from './db/client.js'
import { config } from './config.js'

/**
 * AI settings — pinned models, no silent model switching.
 *
 * Resolution order: settings table (key `ai`) → env → defaults.
 * Any mismatch vs the live Ollama instance is REPORTED (degraded), never
 * silently swapped to another model.
 */

export interface AiSettings {
  provider: 'ollama'
  chatModel: string
  embedModel: string
  embedDim: number
}

export interface AiHealth {
  ok: boolean
  degraded: boolean
  provider: 'ollama'
  chatModel: string
  embedModel: string
  availableModels: string[]
  issues: string[]
}

const DEFAULTS: AiSettings = {
  provider: 'ollama',
  chatModel: config.llmModel,
  embedModel: config.embedModel,
  embedDim: config.embedDim,
}

export async function getAiSettings(dbh: DbHandle, organizationId: string): Promise<AiSettings> {
  const rows = await dbh.query<{ value: Partial<AiSettings> }>(
    `SELECT value FROM settings WHERE organization_id = $1::uuid AND key = 'ai'`,
    [organizationId],
  ).catch(() => [])
  const stored = rows[0]?.value ?? {}
  return {
    provider: 'ollama',
    chatModel: stored.chatModel ?? DEFAULTS.chatModel,
    embedModel: stored.embedModel ?? DEFAULTS.embedModel,
    embedDim: stored.embedDim ?? DEFAULTS.embedDim,
  }
}

export async function setAiSettings(dbh: DbHandle, organizationId: string, patch: Partial<AiSettings>) {
  const current = await getAiSettings(dbh, organizationId)
  const next = { ...current, ...patch }
  await dbh.exec(
    `INSERT INTO settings (organization_id, key, value, updated_at)
     VALUES ($1, 'ai', $2::jsonb, now())
     ON CONFLICT (organization_id, key) DO UPDATE SET value = excluded.value, updated_at = now()`,
    [organizationId, JSON.stringify(next)],
  )
  return next
}

/** Live Ollama health against the PINNED models — degraded ≠ silently swapped. */
export async function checkAiHealth(dbh: DbHandle, organizationId: string): Promise<AiHealth> {
  const settings = await getAiSettings(dbh, organizationId)
  const issues: string[] = []
  let availableModels: string[] = []

  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) {
      issues.push(`Ollama injoignable (${res.status}) sur ${config.ollamaUrl}`)
    } else {
      const data = (await res.json()) as { models?: { name: string }[] }
      availableModels = (data.models ?? []).map((m) => m.name)
      const hasChat = availableModels.some((n) => n.startsWith(settings.chatModel))
      const hasEmbed = availableModels.some((n) => n.startsWith(settings.embedModel))
      if (!hasChat) {
        issues.push(`Modèle de chat épinglé « ${settings.chatModel} » absent de l'instance Ollama`)
      }
      if (!hasEmbed) {
        issues.push(`Modèle d'embedding épinglé « ${settings.embedModel} » absent de l'instance Ollama`)
      }
    }
  } catch (err) {
    issues.push(`Ollama injoignable sur ${config.ollamaUrl} — mode dégradé (embeddings/LLM locaux de secours)`)
  }

  return {
    ok: issues.length === 0,
    degraded: issues.length > 0,
    provider: 'ollama',
    chatModel: settings.chatModel,
    embedModel: settings.embedModel,
    availableModels,
    issues,
  }
}
