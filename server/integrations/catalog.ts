import { Router } from 'express'
import type { DbHandle } from '../db/client.js'
import { authRequired } from '../auth.js'
import { audit } from '../audit.js'
import { isActivepiecesEnabled } from '../activepieces/provider.js'

/**
 * Integration Catalog — exposé depuis Activepieces, normalisé pour Companion.
 *
 * L'utilisateur voit un catalogue d'applications avec connect/disconnect.
 * Il n'a PAS besoin de savoir ce qu'est Activepieces ou MCP.
 */

const FEATURED = [
  'google-drive', 'gmail', 'google-calendar', 'google-sheets', 'google-docs',
  'microsoft-outlook', 'microsoft-teams', 'microsoft-onedrive', 'microsoft-sharepoint',
  'microsoft-excel', 'microsoft-onenote',
  'whatsapp', 'slack', 'telegram', 'discord',
  'notion', 'confluence', 'dropbox',
  'hubspot', 'salesforce', 'odoo', 'zoho-crm', 'pipedrive', 'copper',
  'clickup', 'asana', 'trello', 'jira', 'monday', 'linear', 'todoist',
  'airtable', 'baserow',
  'github', 'gitlab',
  'zendesk', 'freshdesk', 'intercom', 'service-now',
  'calendly', 'fireflies-ai', 'fathom',
]

const CATEGORY_MAP: Record<string, string[]> = {
  'communication': ['slack', 'telegram', 'discord', 'whatsapp', 'microsoft-teams', 'twilio', 'sendinblue'],
  'email-calendar': ['gmail', 'microsoft-outlook', 'google-calendar', 'microsoft-outlook-calendar', 'calendly', 'mailchimp', 'sendgrid'],
  'documents': ['google-drive', 'microsoft-onedrive', 'microsoft-sharepoint', 'dropbox', 'notion', 'confluence', 'google-docs', 'microsoft-onenote', 'microsoft-excel', 'google-sheets', 'airtable', 'baserow'],
  'crm': ['hubspot', 'salesforce', 'odoo', 'zoho-crm', 'pipedrive', 'copper', 'activecampaign'],
  'productivity': ['clickup', 'asana', 'trello', 'jira', 'monday', 'linear', 'todoist', 'microsoft-to-do'],
  'support': ['zendesk', 'freshdesk', 'intercom', 'service-now'],
  'development': ['github', 'gitlab', 'http', 'webhook'],
  'meetings': ['zoom', 'google-meet', 'microsoft-teams', 'calendly', 'fireflies-ai', 'fathom'],
  'hr': ['bamboohr', 'hrflow'],
  'finance': ['stripe', 'xero', 'quickbooks'],
}

interface CatalogPiece {
  name: string
  displayName: string
  description: string
  logoUrl: string
  categories: string[]
  featured: boolean
  actions: number
  triggers: number
}

let catalogCache: CatalogPiece[] | null = null
let catalogCacheTime = 0
const CACHE_TTL = 3600_000 // 1h

async function fetchCatalogFromActivepieces(apToken: string): Promise<CatalogPiece[]> {
  const apUrl = process.env.ACTIVEPIECES_URL ?? 'http://localhost:5678'
  const res = await fetch(`${apUrl}/api/v1/pieces`, {
    headers: { Authorization: `Bearer ${apToken}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Activepieces API: ${res.status}`)
  const data = await res.json() as { data?: { name: string; displayName: string; description: string; logoUrl: string; actions?: unknown[]; triggers?: unknown[] }[] }
  const pieces = data.data ?? data as unknown as CatalogPiece[]
  if (!Array.isArray(pieces)) return []

  return pieces.map((p) => {
    const nameLower = p.name.toLowerCase()
    const actions = Array.isArray(p.actions) ? p.actions.length : typeof p.actions === 'number' ? p.actions : 0
    const triggers = Array.isArray(p.triggers) ? p.triggers.length : typeof p.triggers === 'number' ? p.triggers : 0
    // Categorize by name
    let categories: string[] = []
    for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
      if (keywords.some((k) => nameLower.includes(k))) categories.push(cat)
    }
    if (categories.length === 0) categories.push('other')
    return {
      name: p.name,
      displayName: p.displayName ?? p.name,
      description: (p.description ?? '').slice(0, 300),
      logoUrl: p.logoUrl ?? '',
      categories,
      featured: FEATURED.includes(p.name),
      actions,
      triggers,
    }
  })
}

export function buildIntegrationsRouter(dbh: DbHandle): Router {
  const router = Router()
  router.use(authRequired(dbh))

  /** Catalogue complet — cache 1h, featured en premier. */
  router.get('/catalog', async (req, res) => {
    try {
      const now = Date.now()
      if (!catalogCache || now - catalogCacheTime > CACHE_TTL) {
        const apToken = process.env.ACTIVEPIECES_MCP_TOKEN ?? ''
        if (isActivepiecesEnabled() && apToken) {
          catalogCache = await fetchCatalogFromActivepieces(apToken)
          catalogCacheTime = now
        }
      }
      if (!catalogCache) {
        return res.json({ pieces: [], count: 0, source: 'activepieces_unavailable' })
      }
      // Trier : featured d'abord (ordre du tableau FEATURED), puis alphabétique
      const sorted = [...catalogCache].sort((a, b) => {
        const ai = FEATURED.indexOf(a.name)
        const bi = FEATURED.indexOf(b.name)
        if (ai >= 0 && bi >= 0) return ai - bi
        if (ai >= 0) return -1
        if (bi >= 0) return 1
        return a.displayName.localeCompare(b.displayName)
      })
      res.json({ pieces: sorted, count: sorted.length, source: 'activepieces' })
    } catch (err) {
      res.status(500).json({ error: String(err).slice(0, 300), pieces: [], count: 0 })
    }
  })

  /** Recherche avec filtres. */
  router.get('/catalog/search', authRequired(dbh), async (req, res) => {
    const { q, category, featured } = req.query as Record<string, string | undefined>
    const all = catalogCache ?? []
    let results = all
    if (q) {
      const ql = q.toLowerCase()
      results = results.filter((p) =>
        p.displayName.toLowerCase().includes(ql) || p.description.toLowerCase().includes(ql) || p.name.includes(ql),
      )
    }
    if (category && category !== 'all') {
      results = results.filter((p) => p.categories.includes(category))
    }
    if (featured === 'true') {
      results = results.filter((p) => p.featured)
    }
    res.json({ pieces: results.slice(0, 100), count: results.length })
  })

  /** Santé de l'intégration Activepieces. */
  router.get('/activepieces/health', async (_req, res) => {
    const { externalHealth } = await import('../activepieces/provider.js')
    const health = await externalHealth()
    res.json({ ...health, enabled: isActivepiecesEnabled() })
  })

  return router
}

export { FEATURED, CATEGORY_MAP }
