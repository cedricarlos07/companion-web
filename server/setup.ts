import { Router } from 'express'
import bcrypt from 'bcryptjs'
import type { DbHandle } from './db/client.js'

/**
 * Setup wizard — crée l'organisation, le owner et les données initiales
 * en un seul appel idempotent. Ne fonctionne QUE si aucune organisation n'existe.
 */
export function buildSetupRouter(dbh: DbHandle): Router {
  const router = Router()

  router.get('/status', async (_req, res) => {
    const orgs = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM organizations`)
    res.json({ needsSetup: Number(orgs[0]?.cnt ?? 0) === 0 })
  })

  router.post('/', async (req, res) => {
    const orgCount = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM organizations`)
    if (Number(orgCount[0]?.cnt ?? 0) > 0) {
      return res.status(409).json({ error: 'setup déjà effectué' })
    }

    const {
      orgName, sector, country,
      ownerEmail, ownerPassword, ownerFirstName, ownerLastName,
      departmentName, roleName,
    } = req.body as Record<string, string>

    if (!orgName || !ownerEmail || !ownerPassword || ownerPassword.length < 8) {
      return res.status(400).json({ error: 'orgName, ownerEmail et ownerPassword (8+) requis' })
    }

    // Organisation
    await dbh.exec(
      `INSERT INTO organizations (name, slug, sector, country) VALUES ('${orgName.replace(/'/g, "''")}', '${orgName.toLowerCase().replace(/[^a-z0-9]/g, '-')}', '${(sector ?? '').replace(/'/g, "''")}', '${(country ?? '').replace(/'/g, "''")}')`,
    )
    const org = (await dbh.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`))[0]

    // Département
    const dept = departmentName || 'Général'
    await dbh.exec(`INSERT INTO departments (organization_id, name) VALUES ('${org.id}', '${dept.replace(/'/g, "''")}')`)
    const deptId = (await dbh.query<{ id: string }>(`SELECT id FROM departments WHERE organization_id = '${org.id}' LIMIT 1`))[0]?.id

    // Rôle
    const role = roleName || 'Directeur'
    await dbh.exec(`INSERT INTO roles (organization_id, department_id, title) VALUES ('${org.id}', ${deptId ? `'${deptId}'` : 'NULL'}, '${role.replace(/'/g, "''")}')`)
    const roleId = (await dbh.query<{ id: string }>(`SELECT id FROM roles WHERE organization_id = '${org.id}' LIMIT 1`))[0]?.id

    // Owner
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash(ownerPassword, 10)
    await dbh.exec(
      `INSERT INTO users (organization_id, email, password_hash, name, app_role) VALUES ('${org.id}', '${ownerEmail.replace(/'/g, "''")}', '${hash}', '${(ownerFirstName || 'Admin').replace(/'/g, "''")} ${(ownerLastName || '').replace(/'/g, "''")}', 'owner')`,
    )

    res.json({ ok: true, organizationId: org.id, message: 'Organisation créée. Redémarrez Companion pour le seed des données de démonstration.' })
  })

  return router
}
