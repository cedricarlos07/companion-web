import { Router } from 'express'
import type { DbHandle } from '../db/client.js'
import { authRequired, requireRole } from '../auth.js'
import { audit } from '../audit.js'
import { licenseGate } from '../services/license-mode.js'
import { generateToken, hashToken } from './auth.js'
import { mcpActiveSessions } from './http.js'

/** Gestion des clients MCP — admin uniquement. Tokens jamais retournés après création. */
export function buildMcpManagementRouter(dbh: DbHandle): Router {
  const router = Router()
  const guard = [authRequired(dbh), requireRole('owner', 'admin')]

  router.get('/health', async (_req, res) => {
    const tools = [
      'search_memory', 'get_company_context', 'get_employee_context', 'get_role_context',
      'get_project_context', 'get_knowledge_gaps', 'create_memory', 'correct_memory',
      'create_handover', 'request_approval',
    ]
    const rows = await dbh.query<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM mcp_clients WHERE status = 'active'`,
    ).catch(() => [])
    res.json({
      status: 'active',
      protocolVersion: '2025-06-18',
      serverVersion: 'companion-mcp-1.0.0',
      tools,
      activeSessions: mcpActiveSessions(),
      activeClients: Number(rows[0]?.cnt ?? 0),
    })
  })

  router.get('/clients', ...guard, async (req, res) => {
    const rows = await dbh.query(
      `SELECT id, name, status, allowed_scopes, allowed_tools, created_by, created_at::text AS created_at,
              last_used_at::text AS last_used_at, expires_at::text AS expires_at
       FROM mcp_clients WHERE organization_id = '${req.user!.organizationId}' ORDER BY created_at DESC`,
    )
    res.json({ clients: rows })
  })

  /* Nouveau client MCP = nouvelle intégration : bloqué en mode restreint. */
  router.post('/clients', licenseGate(dbh), ...guard, async (req, res) => {
    const { name, scopes, tools, expiresInDays } = req.body as {
      name?: string; scopes?: string[]; tools?: string[]; expiresInDays?: number
    }
    if (!name || !scopes?.length || !tools?.length) {
      return res.status(400).json({ error: 'nom, scopes et tools requis' })
    }
    const token = generateToken()
    const expires = expiresInDays ? `, expires_at = now() + interval '${Math.floor(expiresInDays)} days'` : ''
    const rows = await dbh.query<{ id: string }>(
      `INSERT INTO mcp_clients (organization_id, name, token_hash, status, allowed_scopes, allowed_tools, created_by${expiresInDays ? ', expires_at' : ''})
       VALUES ('${req.user!.organizationId}', '${name.replace(/'/g, "''")}', '${hashToken(token)}', 'active',
               '${JSON.stringify(scopes)}'::jsonb, '${JSON.stringify(tools)}'::jsonb, '${req.user!.name.replace(/'/g, "''")}'${expiresInDays ? `, now() + interval '${Math.floor(expiresInDays)} days'` : ''})
       RETURNING id`,
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'mcp.client_created', targetType: 'mcp_client', targetId: rows[0].id,
      detail: { name, scopes, tools },
    })
    res.json({ clientId: rows[0].id, token })
  })

  router.post('/clients/:id/rotate', ...guard, async (req, res) => {
    const token = generateToken()
    await dbh.exec(
      `UPDATE mcp_clients SET token_hash = '${hashToken(token)}', status = 'active', last_used_at = NULL WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`,
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'mcp.client_rotated', targetType: 'mcp_client', targetId: String(req.params.id), detail: {},
    })
    res.json({ token })
  })

  router.post('/clients/:id/disable', ...guard, async (req, res) => {
    await dbh.exec(`UPDATE mcp_clients SET status = 'disabled' WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'mcp.client_disabled', targetType: 'mcp_client', targetId: String(req.params.id), detail: {},
    })
    res.json({ ok: true })
  })

  router.delete('/clients/:id', ...guard, async (req, res) => {
    await dbh.exec(`DELETE FROM mcp_clients WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'mcp.client_deleted', targetType: 'mcp_client', targetId: String(req.params.id), detail: {},
    })
    res.json({ ok: true })
  })

  router.get('/clients/:id/activity', ...guard, async (req, res) => {
    const rows = await dbh.query(
      `SELECT action, target_id, detail, created_at::text AS created_at FROM audit_events
       WHERE organization_id = '${req.user!.organizationId}'
         AND (action LIKE 'mcp.%' OR (target_type = 'mcp_client' AND target_id = '${req.params.id}'))
         AND (detail->>'client' = (SELECT name FROM mcp_clients WHERE id = '${req.params.id}')
              OR target_id = '${req.params.id}'
              OR action LIKE 'mcp.request%')
       ORDER BY created_at DESC LIMIT 50`,
    )
    res.json({ activity: rows })
  })

  return router
}
