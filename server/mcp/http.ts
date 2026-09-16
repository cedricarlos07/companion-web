import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Express, Request, Response } from 'express'
import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { verifyMcpToken, toCallContext } from './auth.js'
import { buildCompanionMcpServer } from './server.js'
import { checkRateLimit } from '../rate-limiter.js'

/**
 * Point d'entrée HTTP MCP (Streamable HTTP, mode stateless par requête).
 * AUTH Bearer obligatoire à CHAQUE requête — le MCP n'est jamais une seconde
 * porte d'accès : chaque tool passe par le Policy Engine Companion.
 */

const sessions = new Set<string>()

export function mountMcpHttp(app: Express, dbh: DbHandle) {
  app.post('/mcp', async (req: Request, res: Response) => {
    const auth = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined
    if (!auth) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'token MCP requis (Authorization: Bearer cmpk_…)' }, id: null })
      return
    }
    const client = await verifyMcpToken(dbh, auth)
    if (!client) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'token MCP invalide, expiré ou désactivé' }, id: null })
      return
    }
    const rl = await checkRateLimit(`mcp:${client.id}`, 60)
    if (!rl.allowed) {
      res.status(429).json({ jsonrpc: '2.0', error: { code: -32002, message: `rate limit MCP dépassé (${60 - rl.remaining} req/min)` }, id: null })
      return
    }

    const ctx = toCallContext(client)
    sessions.add(ctx.mcpClientId)

    try {
      // Mode stateless : un McServer + un transport par requête.
      const server = buildCompanionMcpServer(dbh, ctx)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res, (req as Request & { body?: unknown }).body)
    } catch (err) {
      await audit(dbh, ctx.organizationId, {
        actorName: ctx.clientName, actorKind: 'agent',
        action: 'mcp.error', targetType: 'mcp', detail: { error: String(err).slice(0, 250) },
      }).catch(() => undefined)
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'erreur interne MCP' }, id: null })
      }
    }
  })

  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'MCP Streamable HTTP : utiliser POST /mcp' }, id: null })
  })

  app.delete('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'stateless : pas de session à terminer' }, id: null })
  })
}

export function mcpActiveSessions(): number {
  return sessions.size
}
