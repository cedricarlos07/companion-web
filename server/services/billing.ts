import type { DbHandle } from '../db/client.js'
import { getEntitlements, type Entitlements } from './entitlements.js'

/**
 * Billing — usage tracking + cost estimation + plan limits.
 *
 * Le client voit des FCFA, pas des tokens.
 * BYOK = facturé directement par le fournisseur (Companion n'affiche qu'une estimation).
 * Managed AI = Companion facture l'enveloppe consommée.
 */

export interface UsageCategory {
  key: string
  label: string
  amountFcf: number
  included: boolean
  detail?: string
}

export interface UsageReport {
  period: string
  plan: string
  categories: UsageCategory[]
  totalFcf: number
  includedFcf: number
  remainingFcf: number | null
  byok: boolean
  limits: {
    users: { current: number; max: number }
    agents: { current: number; max: number }
    integrations: { current: number; max: number }
    mcpClients: { current: number; max: number }
    storageGb: { current: number; max: number }
  }
}

/** Tarifs de référence FCFA par unité de consommation (configurables). */
const RATES: Record<string, number> = {
  'ia_llm_1k_tokens': 15,       // 15 F / 1k tokens LLM
  'ia_embedding_1k': 2,         // 2 F / 1k embeddings
  'whatsapp_message': 25,       // 25 F / message
  'storage_gb': 850,            // 850 F / GB / mois
  'managed_infra_base': 100_000, // Infrastructure managée de base
}

export async function getUsageReport(dbh: DbHandle, organizationId: string): Promise<UsageReport> {
  const ent = await getEntitlements(dbh, organizationId)
  const planRows = await dbh
    .query<{ plan: string }>(`SELECT plan FROM org_entitlements WHERE organization_id = $1::uuid`, [organizationId])
    .catch(() => [])
  const plan = planRows[0]?.plan ?? 'pilot'

  // Usage actuel depuis la base
  const counts = await dbh
    .query<{
      users: string; agents: string; integrations: string; mcp_clients: string;
      tokens: string; documents: string; storage_bytes: string; whatsapp: string;
    }>(
      `SELECT
        (SELECT count(*) FROM users WHERE organization_id = $1::uuid)::text AS users,
        (SELECT count(*) FROM agents WHERE organization_id = $2::uuid AND status != 'paused')::text AS agents,
        (SELECT count(*) FROM sources WHERE organization_id = $3::uuid AND status = 'connected')::text AS integrations,
        (SELECT count(*) FROM mcp_clients WHERE organization_id = $4::uuid AND status = 'active')::text AS mcp_clients,
        (SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) FROM agent_runs WHERE organization_id = $5::uuid)::text AS tokens,
        (SELECT count(*) FROM documents WHERE organization_id = $6::uuid)::text AS documents,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM documents WHERE organization_id = $7::uuid)::text AS storage_bytes,
        (SELECT count(*) FROM memories WHERE organization_id = $8::uuid AND contributor LIKE '%whatsapp%')::text AS whatsapp`, [organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId],
    )
    .catch(() => [{ users: '0', agents: '0', integrations: '0', mcp_clients: '0', tokens: '0', documents: '0', storage_bytes: '0', whatsapp: '0' }])

  const c = counts[0] ?? {} as Record<string, string>
  const totalTokens = Number(c.tokens ?? 0)

  // Estimation IA en FCFA (si BYOK, c'est une estimation indicative seulement)
  const iaFcf = Math.round((totalTokens / 1000) * RATES['ia_llm_1k_tokens'])

  const categories: UsageCategory[] = [
    { key: 'ia', label: 'IA (LLM + embeddings)', amountFcf: iaFcf, included: false, detail: `${totalTokens.toLocaleString('fr-FR')} tokens cumulés` },
    { key: 'storage', label: 'Stockage documents', amountFcf: Math.round((Number(c.storage_bytes ?? 0) / 1e9) * RATES['storage_gb']), included: true },
  ]

  const totalFcf = categories.reduce((s, cat) => s + cat.amountFcf, 0)
  const includedFcf = 0 // BYOK : rien d'inclus, tout est estimatif

  return {
    period: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    plan,
    categories,
    totalFcf,
    includedFcf,
    remainingFcf: null,
    byok: true,
    limits: {
      users: { current: Number(c.users ?? 0), max: ent['users.max'] },
      agents: { current: Number(c.agents ?? 0), max: ent['agents.max'] },
      integrations: { current: Number(c.integrations ?? 0), max: ent['sources.max'] },
      mcpClients: { current: Number(c.mcp_clients ?? 0), max: ent['mcpClients.max'] },
      storageGb: { current: Math.round(Number(c.storage_bytes ?? 0) / 1e9 * 10) / 10, max: ent['storage.maxGb'] },
    },
  }
}

/** Vérifie si une limite de plan est atteinte. */
export async function isPlanLimitReached(
  dbh: DbHandle,
  organizationId: string,
  resource: 'users' | 'agents' | 'mcp_clients' | 'sources',
): Promise<boolean> {
  const ent = await getEntitlements(dbh, organizationId)
  const limitKey = `${resource === 'users' ? 'users' : resource === 'agents' ? 'agents' : resource === 'mcp_clients' ? 'mcpClients' : 'sources'}.max` as keyof Entitlements
  const max = ent[limitKey]
  if (typeof max !== 'number') return false

  const tableMap: Record<string, string> = {
    users: 'users',
    agents: 'agents',
    mcp_clients: 'mcp_clients',
    sources: 'sources',
  }
  const table = tableMap[resource]
  if (!table) return false

  const rows = await dbh
    .query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM $1 WHERE organization_id = $2::uuid`, [table, organizationId])
    .catch(() => [])
  return Number(rows[0]?.cnt ?? 0) >= max
}

export { RATES }
