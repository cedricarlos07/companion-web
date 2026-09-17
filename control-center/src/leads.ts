import { Router, json as expressJson } from 'express'
import type { DbHandle } from './db.js'

/**
 * Demandes de démo — formulaire public de la landing.
 * Les leads commerciaux vivent ici (Kamaloka), jamais dans les instances clientes.
 */

function clean(v: unknown, max = 300): string {
  return String(v ?? '').replace(/'/g, "''").slice(0, max).trim()
}

export function buildLeadsApi(dbh: DbHandle): Router {
  const router = Router()
  router.use(expressJson())

  /** Public : soumission du formulaire « Demander une démo ». */
  router.post('/v1/demo-requests', async (req, res) => {
    const b = req.body as Record<string, unknown>
    // Honeypot anti-spam : les bots remplissent tous les champs.
    if (clean(b.company_website)) return res.json({ ok: true })
    const fullName = clean(b.fullName, 120)
    const email = clean(b.email, 160)
    const company = clean(b.company, 160)
    if (!fullName || !company) return res.status(400).json({ error: 'nom et entreprise requis' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'email invalide' })
    await dbh.exec(
      `INSERT INTO demo_requests (full_name, email, phone, company, role, company_size, problem, tools, deployment, message, offer)
       VALUES ('${fullName}', '${email}', '${clean(b.phone, 40)}', '${company}',
               '${clean(b.role, 60)}', '${clean(b.companySize, 40)}', '${clean(b.problem, 80)}',
               '${clean(b.tools, 120)}', '${clean(b.deployment, 60)}', '${clean(b.message, 2000)}',
               '${clean(b.offer, 20) || 'demo'}')`,
    )
    res.json({ ok: true })
  })

  return router
}
