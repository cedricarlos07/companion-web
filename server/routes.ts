import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import { eq } from 'drizzle-orm'
import type { DbHandle } from './db/client.js'
import { documents, sources, memories, employees, roles, departments, memoryVersions, memorySources, onboardings, users, handovers } from './db/schema.js'
import { authenticate, issueToken, setAuthCookie, clearAuthCookie, authRequired, requireRole } from './auth.js'
import { audit } from './audit.js'
import { ingestDocument, extractTextFromFile, storagePathFor } from './services/ingestion.js'
import { askCompanion } from './services/ask.js'
import { createMemory, updateMemory, promoteToRole } from './services/memory.js'
import { orgRiskOverview, computeEmployeeRisk, computeRoleRisk } from './services/risk.js'
import { licenseGate } from './services/license-mode.js'
import { startHandover, answerInterviewQuestion, generateHandoverPack } from './services/handover.js'
import { generateOnboarding } from './services/onboarding.js'
import { ollamaStatus } from './providers/ollama.js'

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv']

export function buildApiRouter(dbh: DbHandle): Router {
  const api = Router()
  const upload = multer({
    dest: 'data/tmp-uploads/',
    limits: { fileSize: 25 * 1024 * 1024 },
  })

  /* ------------------------------- Auth ---------------------------------- */

  api.post('/auth/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) return res.status(400).json({ error: 'email et mot de passe requis' })
    const user = await authenticate(dbh, email, password)
    if (!user) return res.status(401).json({ error: 'identifiants invalides' })
    const token = issueToken(user)
    setAuthCookie(res, token)
    await dbh.db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id))
    await audit(dbh, user.organizationId, { actor: user, action: 'auth.login', detail: { email } })
    res.json({ user })
  })

  api.post('/auth/logout', (req, res) => {
    clearAuthCookie(res)
    res.json({ ok: true })
  })

  api.get('/auth/me', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query<{ id: string; email: string; name: string; app_role: string; organization_id: string; employee_id: string | null; org_name: string; instance_url: string | null; sector: string | null; country: string | null }>(
      `SELECT u.id, u.email, u.name, u.app_role, u.organization_id, u.employee_id, o.name AS org_name, o.instance_url, o.sector, o.country
       FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.id = $1`, [req.user!.id],
    )
    if (!rows[0]) return res.status(401).json({ error: 'compte introuvable' })
    res.json({ user: rows[0] })
  })

  /* ----------------------------- Status ---------------------------------- */

  api.get('/status', async (_req, res) => {
    const ollama = await ollamaStatus()
    const counts = await dbh.query<{ memories: string; employees: string; documents: string }>(
      `SELECT (SELECT count(*) FROM memories)::text AS memories,
              (SELECT count(*) FROM employees)::text AS employees,
              (SELECT count(*) FROM documents)::text AS documents`,
    )
    // Monitoring disque
    let diskFreeGb: number | null = null
    try {
      const fsMod = await import('node:fs')
      const stats = fsMod.statSync('./data')
      void stats
      const { execSync } = await import('node:child_process')
      if (process.platform === 'win32') {
        const out = execSync('powershell -Command "(Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID=\'C:\'\\".FreeSpace/1GB)"', { timeout: 5000 }).toString().trim()
        diskFreeGb = parseFloat(out) || null
      } else {
        const out = execSync('df --output=avail -BG / | tail -1 | tr -d "G "').toString().trim()
        diskFreeGb = parseInt(out) || null
      }
    } catch { diskFreeGb = null }
    const diskWarning = diskFreeGb !== null && diskFreeGb < 10 ? `⚠️ Disque C: seulement ${diskFreeGb} GB libres` : undefined

    res.json({
      engine: 'companion-real',
      dbDriver: dbh.driver,
      disk: { freeGb: diskFreeGb, warning: diskWarning },
      ai: { provider: 'ollama', available: ollama.available, llmModel: ollama.llmModel, embedModel: ollama.embedModel },
      counts: {
        memories: Number(counts[0]?.memories ?? 0),
        employees: Number(counts[0]?.employees ?? 0),
        documents: Number(counts[0]?.documents ?? 0),
      },
    })
  })

  /* ----------------------------- Employees ------------------------------- */

  api.get('/employees', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query<{
      id: string; first_name: string; last_name: string; status: string; email: string;
      role_title: string | null; role_id: string | null; department: string | null;
      seniority_months: number; start_date: string | null;
      memories: string; procedures: string; unique_knowledge: string;
    }>(`
      SELECT e.id, e.first_name, e.last_name, e.status, e.email, e.start_date, e.seniority_months,
             r.title AS role_title, r.id AS role_id, d.name AS department,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.status NOT IN ('rejected','superseded'))::text AS memories,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type = 'procedure')::text AS procedures,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type IN ('procedure','decision','relationship')
                AND NOT EXISTS (SELECT 1 FROM memories m2 WHERE m2.organization_id = m.organization_id AND m2.id <> m.id
                  AND m2.type = m.type AND m2.title = m.title AND m2.employee_id <> m.employee_id))::text AS unique_knowledge
      FROM employees e
      LEFT JOIN roles r ON r.id = e.role_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.organization_id = $1::uuid
      ORDER BY e.first_name
    `, [req.user!.organizationId])
    res.json({ employees: rows })
  })

  api.post('/employees', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { firstName, lastName, email, roleId, departmentId, startDate, seniorityMonths } = req.body as {
      firstName?: string; lastName?: string; email?: string; roleId?: string; departmentId?: string; startDate?: string; seniorityMonths?: number
    }
    if (!firstName || !lastName || !email) return res.status(400).json({ error: 'prénom, nom et email requis' })
    const [created] = await dbh.db
      .insert(employees)
      .values({
        organizationId: req.user!.organizationId,
        firstName,
        lastName,
        email: email.toLowerCase(),
        roleId: roleId ?? null,
        departmentId: departmentId ?? null,
        startDate: startDate ?? null,
        seniorityMonths: seniorityMonths ?? 0,
        status: 'active',
      })
      .returning()
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'employee.created', targetType: 'employee', targetId: created.id,
      detail: { name: `${firstName} ${lastName}` },
    })
    res.json({ employee: created })
  })

  api.get('/employees/:id', authRequired(dbh), async (req, res) => {
    const id = String(req.params.id)
    const emp = await dbh.query<{
      id: string; first_name: string; last_name: string; status: string; email: string;
      role_title: string | null; role_id: string | null; department: string | null;
      seniority_months: number; start_date: string | null;
      memories: string; procedures: string; decisions: string; relationships: string; projects: string; unique_knowledge: string; coverage: number | null;
    }>(`
      SELECT e.id, e.first_name, e.last_name, e.status, e.email, e.start_date, e.seniority_months,
             r.title AS role_title, r.id AS role_id, d.name AS department,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.status NOT IN ('rejected','superseded'))::text AS memories,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type = 'procedure')::text AS procedures,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type = 'decision')::text AS decisions,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type = 'relationship')::text AS relationships,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type = 'project')::text AS projects,
             (SELECT count(*) FROM memories m WHERE m.employee_id = e.id AND m.type IN ('procedure','decision','relationship')
                AND NOT EXISTS (SELECT 1 FROM memories m2 WHERE m2.organization_id = m.organization_id AND m2.id <> m.id
                  AND m2.type = m.type AND m2.title = m.title AND m2.employee_id <> m.employee_id))::text AS unique_knowledge,
             (SELECT round(avg(CASE WHEN m2.scope IN ('role','company') THEN 100.0 ELSE 40 END))
                FROM memories m2 WHERE m2.employee_id = e.id) AS coverage
      FROM employees e
      LEFT JOIN roles r ON r.id = e.role_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1
    `, [id])
    if (!emp[0]) return res.status(404).json({ error: 'employé introuvable' })

    const mems = await dbh.query(`SELECT id, type, title, content, scope, status, confidence, importance, contributor, updated_at::text AS updated_at FROM memories WHERE employee_id = $1::uuid AND status NOT IN ('rejected','superseded') ORDER BY importance DESC, updated_at DESC`, [id])
    const uniques = mems.filter((m: Record<string, unknown>) =>
      ['procedure', 'decision', 'relationship'].includes(String(m.type)))
    const risk = await computeEmployeeRisk(dbh, req.user!.organizationId, id)
    res.json({ employee: emp[0], memories: mems, uniqueKnowledge: uniques, risk })
  })

  api.post('/employees/:id/status', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { status } = req.body as { status: string }
    if (!['active', 'leaving', 'onboarding', 'former'].includes(status)) {
      return res.status(400).json({ error: 'statut invalide' })
    }
    await dbh.db.update(employees).set({ status }).where(eq(employees.id, String(req.params.id)))
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'employee.status_changed', targetType: 'employee', targetId: String(req.params.id),
      detail: { status },
    })
    res.json({ ok: true })
  })

  /* ------------------------------- Roles --------------------------------- */

  api.get('/roles', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(`
      SELECT r.id, r.title, d.name AS department,
             (SELECT count(*) FROM employees e WHERE e.role_id = r.id AND e.status IN ('active','leaving'))::int AS current_employees,
             (SELECT count(*) FROM memories m WHERE m.role_id = r.id AND m.status NOT IN ('rejected','superseded'))::int AS memories,
             (SELECT count(*) FROM memories m WHERE m.role_id = r.id AND m.type = 'procedure')::int AS procedures,
             (SELECT count(*) FROM memories m WHERE m.role_id = r.id AND m.type = 'decision')::int AS decisions,
             (SELECT count(DISTINCT m.contributor) FROM memories m WHERE m.role_id = r.id)::int AS contributors,
             COALESCE((SELECT round(100.0 * count(*) FILTER (WHERE m.scope = 'role') / GREATEST(count(*), 1))
               FROM memories m WHERE m.role_id = r.id AND m.status NOT IN ('rejected','superseded')), 0)::int AS coverage
      FROM roles r LEFT JOIN departments d ON d.id = r.department_id
      WHERE r.organization_id = $1::uuid
      ORDER BY r.title
    `, [req.user!.organizationId])
    res.json({ roles: rows })
  })

  api.get('/roles/:id', authRequired(dbh), async (req, res) => {
    const id = String(req.params.id)
    const role = await dbh.query(`SELECT r.id, r.title, d.name AS department FROM roles r LEFT JOIN departments d ON d.id = r.department_id WHERE r.id = $1`, [id])
    if (!role[0]) return res.status(404).json({ error: 'rôle introuvable' })
    const mems = await dbh.query(`SELECT id, type, title, content, scope, status, confidence, importance, contributor, employee_id, updated_at::text AS updated_at FROM memories WHERE role_id = $1::uuid AND status NOT IN ('rejected','superseded') ORDER BY importance DESC`, [id])
    const contributors = await dbh.query(`
      SELECT contributor AS name, count(*)::int AS contributions,
             min(created_at::text) AS from, max(updated_at::text) AS to,
             max(employee_id::text) AS employee_id
      FROM memories WHERE role_id = $1::uuid AND contributor IS NOT NULL
      GROUP BY contributor ORDER BY count(*) DESC LIMIT 10
    `, [id])
    const risk = await computeRoleRisk(dbh, req.user!.organizationId, id)
    res.json({ role: role[0], memories: mems, contributors, risk })
  })

  api.post('/memories/:id/promote', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { roleId } = req.body as { roleId?: string }
    const target = roleId ?? req.body.roleId
    if (!target) return res.status(400).json({ error: 'roleId requis' })
    const result = await promoteToRole(dbh, String(req.params.id), target, req.user!.name)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'memory.promoted', targetType: 'memory', targetId: String(req.params.id),
      detail: { roleId: target, result },
    })
    res.json(result ?? { promoted: false })
  })

  /* ------------------------------ Sources -------------------------------- */

  api.get('/sources', authRequired(dbh), async (req, res) => {
    const srcs = await dbh.query(`SELECT * FROM sources WHERE organization_id = $1::uuid ORDER BY created_at DESC`, [req.user!.organizationId])
    const docs = await dbh.query(`
      SELECT d.id, d.title, d.mime_type, d.size_bytes, d.status, d.status_detail, d.uploaded_at::text AS uploaded_at,
             s.name AS source_name
      FROM documents d LEFT JOIN sources s ON s.id = d.source_id
      WHERE d.organization_id = $1::uuid
      ORDER BY d.uploaded_at DESC LIMIT 30
    `, [req.user!.organizationId])
    res.json({ sources: srcs, documents: docs })
  })

  api.post(
    '/sources/upload',
    authRequired(dbh),
    requireRole('owner', 'admin', 'manager', 'employee'),
    upload.array('files', 10),
    async (req, res) => {
      const files = (req.files as Express.Multer.File[]) ?? []
      const pastedText = (req.body as Record<string, string>).text
      const employeeId = (req.body as Record<string, string>).employeeId || undefined
      const orgId = req.user!.organizationId
      const sourceName = (req.body as Record<string, string>).sourceName || 'Import manuel'

      const [source] = await dbh.db
        .insert(sources)
        .values({ organizationId: orgId, kind: 'local', name: sourceName, status: 'connected', config: { employeeId: employeeId ?? null } })
        .returning()

      const createdDocs: { id: string; title: string; mime_type: string }[] = []

      for (const file of files) {
        const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          fs.unlinkSync(file.path)
          continue
        }
        const finalPath = storagePathFor(orgId, file.originalname)
        fs.renameSync(file.path, finalPath)
        const [doc] = await dbh.db
          .insert(documents)
          .values({
            organizationId: orgId,
            sourceId: source.id,
            uploadedById: req.user!.id,
            title: file.originalname,
            mimeType: ext.replace('.', ''),
            sizeBytes: file.size,
            storagePath: finalPath,
            status: 'queued',
          })
          .returning()
        createdDocs.push({ id: doc.id, title: doc.title, mime_type: doc.mimeType })
      }

      if (pastedText && pastedText.trim().length > 20) {
        const finalPath = storagePathFor(orgId, 'texte-colle.txt')
        fs.writeFileSync(finalPath, pastedText, 'utf8')
        const [doc] = await dbh.db
          .insert(documents)
          .values({
            organizationId: orgId,
            sourceId: source.id,
            uploadedById: req.user!.id,
            title: (req.body as Record<string, string>).title || 'Texte collé',
            mimeType: 'paste',
            sizeBytes: pastedText.length,
            storagePath: finalPath,
            status: 'queued',
          })
          .returning()
        createdDocs.push({ id: doc.id, title: doc.title, mime_type: doc.mimeType })
      }

      await audit(dbh, orgId, {
        actor: req.user, action: 'source.uploaded', targetType: 'source', targetId: source.id,
        detail: { documents: createdDocs.length, employeeId },
      })

      // Process synchronously (local demo scale) — the UI polls document status.
      const results = []
      for (const doc of createdDocs) {
        try {
          results.push(await ingestDocument(dbh, doc.id, req.user!.name))
        } catch (err) {
          await dbh.db.update(documents).set({ status: 'failed', statusDetail: String(err).slice(0, 300) }).where(eq(documents.id, doc.id))
          results.push({ documentId: doc.id, error: String(err) })
        }
      }

      res.json({ source, documents: createdDocs, results })
    },
  )

  api.get('/documents/:id', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(
      `SELECT id, title, status, status_detail, mime_type, size_bytes, uploaded_at::text AS uploaded_at FROM documents WHERE id = $1::uuid`,
      [String(req.params.id)],
    )
    if (!rows[0]) return res.status(404).json({ error: 'document introuvable' })
    res.json({ document: rows[0] })
  })

  /* ------------------------------ Memories -------------------------------- */

  api.get('/memories', authRequired(dbh), async (req, res) => {
    const { type, status, q, employeeId, roleId, scope } = req.query as Record<string, string | undefined>
    const rows = await dbh.query(`
      SELECT m.id, m.type, m.title, m.content, m.scope, m.status, m.confidence, m.importance,
             m.contributor, m.employee_id, m.role_id, m.version, m.origin, m.human_validated,
             m.created_at::text AS created_at, m.updated_at::text AS updated_at,
             e.first_name || ' ' || e.last_name AS employee_name,
             r.title AS role_title
      FROM memories m
      LEFT JOIN employees e ON e.id = m.employee_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE m.organization_id = $1::uuid
        AND m.status NOT IN ('rejected','superseded')
        AND ($2::text IS NULL OR m.type = $2)
        AND ($3::text IS NULL OR m.status = $3)
        AND ($4::text IS NULL OR m.scope = $4)
        AND ($5::text IS NULL OR m.employee_id = $5::uuid)
        AND ($6::text IS NULL OR m.role_id = $6::uuid)
        AND ($7::text IS NULL OR m.title ILIKE $7 OR m.content ILIKE $7)
      ORDER BY m.updated_at DESC
      LIMIT 200
    `, [req.user!.organizationId, type ?? null, status ?? null, scope ?? null, employeeId ?? null, roleId ?? null, q ? `%${q}%` : null])
    res.json({ memories: rows })
  })

  api.get('/memories/:id', authRequired(dbh), async (req, res) => {
    const id = String(req.params.id)
    const rows = await dbh.query(`
      SELECT m.*, e.first_name || ' ' || e.last_name AS employee_name, r.title AS role_title,
             m.created_at::text AS created_at, m.updated_at::text AS updated_at
      FROM memories m
      LEFT JOIN employees e ON e.id = m.employee_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE m.id = $1
    `, [id])
    if (!rows[0]) return res.status(404).json({ error: 'mémoire introuvable' })
    const evidence = await dbh.query(`
      SELECT ms.excerpt, ms.location, d.title AS document_title, d.id AS document_id, d.mime_type
      FROM memory_sources ms LEFT JOIN documents d ON d.id = ms.document_id
      WHERE ms.memory_id = $1::uuid
    `, [id])
    const versions = await dbh.query(`SELECT version, title, content, status, confidence, importance, changed_by, change_reason, created_at::text AS created_at FROM memory_versions WHERE memory_id = $1::uuid ORDER BY version DESC`, [id])
    const related = await dbh.query(`
      SELECT m2.id, m2.title, m2.type, ml.kind
      FROM memory_links ml JOIN memories m2 ON m2.id = CASE WHEN ml.from_memory_id = $1::uuid THEN ml.to_memory_id ELSE ml.from_memory_id END
      WHERE ml.from_memory_id = $2::uuid OR ml.to_memory_id = $3::uuid
    `, [id, id, id])
    res.json({ memory: rows[0], evidence, versions, related })
  })

  api.post('/memories', authRequired(dbh), requireRole('owner', 'admin', 'manager', 'employee'), async (req, res) => {
    const body = req.body as Parameters<typeof createMemory>[1]
    const result = await createMemory(dbh, {
      ...body,
      organizationId: req.user!.organizationId,
      origin: 'human',
      contributor: req.user!.name,
      humanValidated: body.status === 'verified',
      changedBy: req.user!.name,
    })
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'memory.created', targetType: 'memory', targetId: result.memory?.id,
      detail: { type: body.type, title: body.title },
    })
    res.json(result)
  })

  api.post('/memories/:id/verify', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const updated = await updateMemory(dbh, String(req.params.id), { status: 'verified' }, req.user!.name, 'vérification humaine')
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'memory.verified', targetType: 'memory', targetId: String(req.params.id), detail: {},
    })
    res.json({ memory: updated })
  })

  api.post('/memories/:id/status', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { status, reason } = req.body as { status: string; reason?: string }
    const updated = await updateMemory(dbh, String(req.params.id), { status: status as never }, req.user!.name, reason ?? `statut → ${status}`)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'memory.status_changed', targetType: 'memory', targetId: String(req.params.id), detail: { status, reason },
    })
    res.json({ memory: updated })
  })

  /* ----------------------- Auth completion -------------------------------- */

  api.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body as { email?: string }
    if (!email) return res.status(400).json({ error: 'email requis' })
    const { createPasswordReset } = await import('./services/auth-completion.js')
    const token = await createPasswordReset(dbh, email)
    // En production : envoyer par email. En dev : retourner le token pour test.
    res.json({ ok: true, ...(process.env.NODE_ENV !== 'production' && token ? { devToken: token } : {}) })
  })

  api.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string }
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'token et mot de passe (8+ caractères) requis' })
    }
    const { resetPassword } = await import('./services/auth-completion.js')
    const ok = await resetPassword(dbh, token, newPassword)
    if (!ok) return res.status(400).json({ error: 'token invalide ou expiré' })
    res.json({ ok: true })
  })

  api.get('/invitations', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const rows = await dbh.query(
      `SELECT i.id, i.email, i.role, i.status, i.expires_at::text AS expires_at, i.invited_by_name
       FROM invitations i WHERE i.organization_id = $1::uuid ORDER BY i.created_at DESC`, [req.user!.organizationId],
    )
    res.json({ invitations: rows })
  })

  api.post('/invitations', authRequired(dbh), requireRole('owner', 'admin', 'manager'), licenseGate(dbh), async (req, res) => {
    const { email, role } = req.body as { email?: string; role?: string }
    if (!email || !role) return res.status(400).json({ error: 'email et role requis' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'adresse email invalide' })
    if (!['employee', 'manager', 'admin', 'auditor'].includes(role)) {
      return res.status(400).json({ error: 'rôle invalide — employee, manager, admin ou auditor' })
    }
    const { createInvitation } = await import('./services/auth-completion.js')
    const result = await createInvitation(dbh, req.user!.organizationId, email, role, req.user!.id, req.user!.name)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'invitation.created', targetType: 'invitation', targetId: result.invitationId,
      detail: { email, role },
    })
    res.json({ invitationId: result.invitationId, ...(process.env.NODE_ENV !== 'production' ? { devToken: result.token } : {}) })
  })

  api.post('/invitations/accept', async (req, res) => {
    const { token, password, firstName, lastName } = req.body as Record<string, string>
    if (!token || !password || password.length < 8 || !firstName || !lastName) {
      return res.status(400).json({ error: 'token, mot de passe (8+), prénom et nom requis' })
    }
    const { acceptInvitation } = await import('./services/auth-completion.js')
    const ok = await acceptInvitation(dbh, token, password, firstName, lastName)
    if (!ok) return res.status(400).json({ error: 'invitation invalide ou expirée' })
    res.json({ ok: true })
  })

  /* --------------------------- Backup / Restore ---------------------------- */

  api.post('/backup', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const { createBackup } = await import('./services/backup.js')
    const backupDir = await createBackup(dbh, req.user!.organizationId)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'backup.created', targetType: 'backup',
      detail: { dir: backupDir },
    })
    res.json({ backupDir })
  })

  api.post('/restore', authRequired(dbh), requireRole('owner'), async (req, res) => {
    const { backupDir } = req.body as { backupDir?: string }
    if (!backupDir) return res.status(400).json({ error: 'backupDir requis' })
    const { restoreBackup } = await import('./services/backup.js')
    const result = await restoreBackup(dbh, backupDir)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'restore.completed', targetType: 'backup',
      detail: { backupDir, total: result.total },
    })
    res.json(result)
  })

  api.get('/backups', authRequired(dbh), requireRole('owner', 'admin'), async (_req, res) => {
    const { listBackups } = await import('./services/backup.js')
    res.json({ backups: listBackups() })
  })

  /* --------------------------- Sécurité check ------------------------------ */

  api.get('/security/check', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const issues: string[] = []
    if (process.env.NODE_ENV === 'production' && dbh.driver === 'pglite') {
      issues.push('PGlite détecté en production — PostgreSQL requis')
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET trop court (32+ caractères requis)')
    }
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
      issues.push('ENCRYPTION_KEY trop courte (32+ caractères requis)')
    }
    res.json({ ok: issues.length === 0, issues, checkedAt: new Date().toISOString() })
  })

  /* --------------------------- Setup wizard -------------------------------- */

  api.get('/setup/status', async (_req, res) => {
    const orgs = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM organizations`)
    res.json({ needsSetup: Number(orgs[0]?.cnt ?? 0) === 0 })
  })

  /* --------------------------- Entitlements -------------------------------- */

  api.get('/entitlements', authRequired(dbh), async (req, res) => {
    const { getEntitlements } = await import('./services/entitlements.js')
    const planRows = await dbh
      .query<{ plan: string }>(`SELECT plan FROM org_entitlements WHERE organization_id = $1::uuid`, [req.user!.organizationId])
      .catch(() => [])
    res.json({
      entitlements: await getEntitlements(dbh, req.user!.organizationId),
      plan: planRows[0]?.plan ?? 'pilot',
    })
  })

  api.get('/license', authRequired(dbh), async (req, res) => {
    const { checkLicenseStatus } = await import('./services/licenses.js')
    const { getLicenseMode, getInstanceId } = await import('./services/license-mode.js')
    const license = await checkLicenseStatus(dbh, req.user!.organizationId)
    const mode = await getLicenseMode(dbh, req.user!.organizationId)
    const instanceId = await getInstanceId(dbh, req.user!.organizationId)
    res.json({
      ...license,
      mode: mode.mode,
      plan: mode.plan,
      licenseId: mode.licenseId,
      expiresAt: mode.expiresAt,
      graceUntil: mode.graceUntil,
      daysLeft: mode.daysLeft,
      message: mode.message,
      instanceId,
      licensing: mode.licensing,
      lease: mode.lease,
      lastHeartbeatAt: mode.lastHeartbeatAt,
    })
  })

  /* Import d'une licence .lic signée par Kamaloka (offline) — owner uniquement. */
  api.post('/license/import', authRequired(dbh), requireRole('owner'), async (req, res) => {
    const { license } = req.body as { license?: string }
    if (!license) return res.status(400).json({ error: 'contenu de licence requis (fichier .lic)' })
    const { verifyLicense } = await import('./services/licenses.js')
    const verification = verifyLicense(license)
    if (verification.status === 'invalid' || verification.status === 'not_configured' || !verification.payload) {
      return res.status(400).json({ error: verification.error ?? 'licence invalide' })
    }
    const payload = verification.payload
    const existing = await dbh
      .query<{ id: string }>(
        `SELECT id FROM licenses WHERE license_key_hash = $1 AND organization_id = $2::uuid ORDER BY created_at DESC LIMIT 1`,
        [payload.licenseId, req.user!.organizationId],
      )
      .catch(() => [])

    const GRACE_DAYS = Math.max(0, Number(process.env.LICENSE_GRACE_DAYS ?? 30))
    const graceUntil = payload.expiresAt
      ? new Date(new Date(payload.expiresAt).getTime() + GRACE_DAYS * 86_400_000).toISOString()
      : null
    // Toutes les autres lignes passent en 'replaced' — une seule licence active à la fois.
    await dbh.exec(`UPDATE licenses SET status = 'replaced' WHERE organization_id = $1::uuid`, [req.user!.organizationId])
    if (existing[0]) {
      // Ré-import / renouvellement d'une même licence : mise à jour de la ligne existante.
      await dbh.exec(
        `UPDATE licenses SET status = 'active', plan = $1,
         entitlements = $2::jsonb,
         expires_at = $3, grace_until = $4,
         signature = $5
         WHERE id = $6::uuid`,
        [payload.plan, JSON.stringify(payload.entitlements ?? {}), payload.expiresAt ?? null, graceUntil, license, existing[0].id],
      )
    } else {
      await dbh.exec(
        `INSERT INTO licenses (organization_id, license_key_hash, plan, status, entitlements, issued_at, expires_at, grace_until, signature)
         VALUES ($1, $2, $3, 'active', $4::jsonb, $5, $6, $7, $8)`,
        [req.user!.organizationId, payload.licenseId, payload.plan, JSON.stringify(payload.entitlements ?? {}), payload.issuedAt, payload.expiresAt ?? null, graceUntil, license],
      )
    }
    // La licence active le plan : les limites d'entitlements suivent automatiquement.
    await dbh.exec(
      `INSERT INTO org_entitlements (organization_id, plan) VALUES ($1, $2)
       ON CONFLICT (organization_id) DO UPDATE SET plan = $3, updated_at = now()`, [req.user!.organizationId, payload.plan, payload.plan],
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'license.imported', targetType: 'license', targetId: payload.licenseId,
      detail: { plan: payload.plan, expiresAt: payload.expiresAt },
    })
    res.json({ ok: true, plan: payload.plan, licenseId: payload.licenseId, expiresAt: payload.expiresAt, graceUntil })
  })

  /* Retire la licence installée (retour à l'essai) — owner uniquement. */
  api.delete('/license', authRequired(dbh), requireRole('owner'), async (req, res) => {
    await dbh.exec(`UPDATE licenses SET status = 'revoked' WHERE organization_id = $1::uuid`, [req.user!.organizationId])
    await dbh.exec(`UPDATE org_entitlements SET plan = 'pilot', updated_at = now() WHERE organization_id = $1::uuid`, [req.user!.organizationId])
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'license.removed', targetType: 'license', targetId: req.user!.organizationId, detail: {},
    })
    res.json({ ok: true })
  })

  /* Signature de test avec la paire éphémère de dev — 404 en production.
   * Signe licences (payload nu) et leases (kind: 'companion-lease'). */
  api.post('/license/dev-sign', authRequired(dbh), requireRole('owner'), async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
    const { devSignLicense, devSignLease } = await import('./services/licenses.js')
    const body = req.body as Record<string, unknown>
    try {
      if (body?.kind === 'companion-lease') {
        return res.json({ lease: devSignLease(body as unknown as Parameters<typeof devSignLease>[0]) })
      }
      res.json({ license: devSignLicense(body as unknown as Parameters<typeof devSignLicense>[0]) })
    } catch (err) {
      res.status(400).json({ error: String(err).slice(0, 200) })
    }
  })

  /* Simule une réponse de heartbeat du Control Center ({status, lease}) :
   * vérifie et stocke le lease exactement comme le ferait le vrai cycle —
   * dev uniquement (404 en production). */
  api.post('/license/dev-lease', authRequired(dbh), requireRole('owner'), async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'not found' })
    const { storeLeaseFromResponse } = await import('./services/license-mode.js')
    const body = req.body as { status?: string; lease?: string }
    res.json(await storeLeaseFromResponse(dbh, req.user!.organizationId, body))
  })

  api.get('/billing/usage', authRequired(dbh), async (req, res) => {
    const { getUsageReport } = await import('./services/billing.js')
    res.json({ usage: await getUsageReport(dbh, req.user!.organizationId) })
  })

  /* -------------------------------- Ask ----------------------------------- */

  api.post('/ask', authRequired(dbh), async (req, res) => {
    const { question, roleId, employeeId, departmentId, type, engine } = req.body as Record<string, string | undefined>
    if (!question || question.trim().length < 3) return res.status(400).json({ error: 'question requise' })

    // Permissions propagées au retrieval : l'acteur détermine la clause d'accès.
    let departmentIdResolved: string | undefined = departmentId
    let employeeIdResolved: string | undefined = employeeId
    if (req.user!.appRole === 'employee' && req.user!.employeeId) {
      employeeIdResolved = employeeIdResolved ?? req.user!.employeeId ?? undefined
      const emp = await dbh.query<{ department_id: string | null }>(`SELECT department_id FROM employees WHERE id = $1::uuid`, [req.user!.employeeId])
      departmentIdResolved = departmentIdResolved ?? emp[0]?.department_id ?? undefined
    }

    const result = await askCompanion(dbh, req.user!.organizationId, question.trim(), {
      roleId, employeeId: employeeIdResolved, departmentId: departmentIdResolved, type,
    }, {
      kind: 'user',
      organizationId: req.user!.organizationId,
      appRole: req.user!.appRole,
      employeeId: req.user!.employeeId,
      departmentId: departmentIdResolved,
    }, engine === 'native' || engine === 'mem0' || engine === 'hybrid' || engine === 'fusion' ? engine : undefined)
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'ask.question', targetType: 'ask', detail: { question: question.slice(0, 200), abstained: result.abstained },
    })
    res.json(result)
  })

  /* ------------------------ System : mémoire + IA -------------------------- */

  api.get('/system/memory-provider/health', authRequired(dbh), async (req, res) => {
    const { getMemoryProvider, memorySearchEngine } = await import('./memory/index.js')
    const { checkAiHealth } = await import('./ai-settings.js')
    const provider = await getMemoryProvider(dbh, req.user!.organizationId)
    const providerHealth = await provider.health()
    const ai = await checkAiHealth(dbh, req.user!.organizationId)
    res.json({ engine: memorySearchEngine(), provider: providerHealth, ai })
  })

  /* Vérification de mise à jour — informatif uniquement, jamais appliquée automatiquement. */
  api.get('/system/update-check', authRequired(dbh), async (_req, res) => {
    const updateServer = (process.env.LICENSE_SERVER_URL ?? process.env.UPDATE_SERVER_URL ?? '').replace(/\/$/, '')
    if (!updateServer) return res.json({ available: false, reason: 'aucun serveur de mise à jour configuré' })
    try {
      const r = await fetch(`${updateServer}/releases/latest`, { signal: AbortSignal.timeout(5000) })
      if (!r.ok) return res.json({ available: false, reason: `réponse ${r.status}` })
      const data = (await r.json()) as { version?: string; channel?: string }
      const installed = '1.0.0'
      res.json({
        available: Boolean(data.version && data.version !== installed),
        installed,
        latest: data.version ?? null,
        channel: data.channel ?? 'stable',
      })
    } catch (err) {
      res.json({ available: false, reason: String(err).slice(0, 120) })
    }
  })

  api.get('/system/ai/settings', authRequired(dbh), async (req, res) => {
    const { getAiSettings } = await import('./ai-settings.js')
    res.json({ settings: await getAiSettings(dbh, req.user!.organizationId) })
  })

  api.post('/system/ai/settings', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const { setAiSettings } = await import('./ai-settings.js')
    const { chatModel, embedModel } = req.body as { chatModel?: string; embedModel?: string }
    const next = await setAiSettings(dbh, req.user!.organizationId, {
      ...(chatModel ? { chatModel } : {}),
      ...(embedModel ? { embedModel } : {}),
    })
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'system.ai_settings_changed', detail: { chatModel: next.chatModel, embedModel: next.embedModel },
    })
    res.json({ settings: next })
  })

  /* --------------------------- Knowledge Risk ------------------------------ */

  api.get('/knowledge-risk', authRequired(dbh), async (req, res) => {
    const overview = await orgRiskOverview(dbh, req.user!.organizationId)
    res.json(overview)
  })

  api.get('/knowledge-risk/employee/:id', authRequired(dbh), async (req, res) => {
    const risk = await computeEmployeeRisk(dbh, req.user!.organizationId, String(req.params.id))
    if (!risk) return res.status(404).json({ error: 'employé introuvable' })
    res.json(risk)
  })

  /* ------------------------------ Handovers -------------------------------- */

  api.get('/handovers', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(`
      SELECT h.id, h.status, h.readiness, h.created_at::text AS created_at, h.updated_at::text AS updated_at,
             e.id AS employee_id, e.first_name || ' ' || e.last_name AS employee_name,
             r.title AS role_title,
             (SELECT count(*) FROM handover_gaps g WHERE g.handover_id = h.id)::int AS gaps_total,
             (SELECT count(*) FROM handover_gaps g WHERE g.handover_id = h.id AND g.status IN ('answered','resolved'))::int AS gaps_answered
      FROM handovers h
      JOIN employees e ON e.id = h.employee_id
      LEFT JOIN roles r ON r.id = h.role_id
      WHERE h.organization_id = $1::uuid
      ORDER BY h.created_at DESC
    `, [req.user!.organizationId])
    res.json({ handovers: rows })
  })

  api.post('/handovers', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { employeeId } = req.body as { employeeId?: string }
    if (!employeeId) return res.status(400).json({ error: 'employeeId requis' })
    await dbh.db.update(employees).set({ status: 'leaving' }).where(eq(employees.id, employeeId))
    const result = await startHandover(dbh, req.user!.organizationId, employeeId, req.user!.name)
    res.json(result)
  })

  api.get('/handovers/:id', authRequired(dbh), async (req, res) => {
    const id = String(req.params.id)
    const rows = await dbh.query(`
      SELECT h.*, e.first_name || ' ' || e.last_name AS employee_name, r.title AS role_title,
             s.first_name || ' ' || s.last_name AS successor_name
      FROM handovers h
      JOIN employees e ON e.id = h.employee_id
      LEFT JOIN roles r ON r.id = h.role_id
      LEFT JOIN employees s ON s.id = h.successor_employee_id
      WHERE h.id = $1
    `, [id])
    if (!rows[0]) return res.status(404).json({ error: 'handover introuvable' })
    const gaps = await dbh.query(`
      SELECT g.id, g.kind, g.question, g.detail, g.status,
             ha.answer_text, ha.answered_by, ha.produced_memory_id,
             iq.prompt, iq.order_index
      FROM handover_gaps g
      LEFT JOIN handover_answers ha ON ha.gap_id = g.id
      LEFT JOIN interview_questions iq ON iq.gap_id = g.id
      WHERE g.handover_id = $1::uuid
      ORDER BY COALESCE(iq.order_index, 99), g.created_at
    `, [id])
    const uniqueKnowledge = await dbh.query(`
      SELECT m.id, m.title, m.type, m.confidence FROM memories m
      WHERE m.employee_id = (SELECT employee_id FROM handovers WHERE id = $1::uuid)
        AND m.type IN ('procedure','decision','relationship','lesson')
        AND m.status NOT IN ('rejected','superseded')
        AND NOT EXISTS (
          SELECT 1 FROM memories m2 WHERE m2.organization_id = m.organization_id AND m2.id <> m.id
            AND m2.type = m.type AND m2.title = m.title AND m2.employee_id <> m.employee_id
        )
      ORDER BY m.importance DESC LIMIT 20
    `, [id])
    res.json({ handover: rows[0], gaps, uniqueKnowledge })
  })

  api.post('/handovers/:id/answers', authRequired(dbh), async (req, res) => {
    const { gapId, answerText } = req.body as { gapId?: string; answerText?: string }
    if (!gapId || !answerText || answerText.trim().length < 5) {
      return res.status(400).json({ error: 'gapId et answerText requis' })
    }
    const result = await answerInterviewQuestion(dbh, req.user!.organizationId, String(req.params.id), gapId, answerText.trim(), req.user!.name)
    res.json(result)
  })

  api.post('/handovers/:id/pack', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const pack = await generateHandoverPack(dbh, req.user!.organizationId, String(req.params.id), req.user!.name)
    res.json(pack)
  })

  api.post('/handovers/:id/successor', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { employeeId } = req.body as { employeeId?: string }
    if (!employeeId) return res.status(400).json({ error: 'employeeId requis' })
    await dbh.db.update(handovers).set({ successorEmployeeId: employeeId }).where(eq(handovers.id, String(req.params.id)))
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'handover.successor_assigned', targetType: 'handover', targetId: String(req.params.id), detail: { employeeId },
    })
    res.json({ ok: true })
  })

  /* ------------------------------ Onboarding ------------------------------- */

  api.get('/onboardings', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(`
      SELECT o.id, o.plan, o.created_at::text AS created_at,
             e.id AS employee_id, e.first_name || ' ' || e.last_name AS employee_name,
             e.status AS employee_status, r.title AS role_title
      FROM onboardings o
      JOIN employees e ON e.id = o.employee_id
      LEFT JOIN roles r ON r.id = o.role_id
      WHERE o.organization_id = $1::uuid
      ORDER BY o.created_at DESC
    `, [req.user!.organizationId])
    res.json({ onboardings: rows })
  })

  api.post('/onboardings', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { employeeId, handoverId } = req.body as { employeeId?: string; handoverId?: string }
    if (!employeeId) return res.status(400).json({ error: 'employeeId requis' })
    const created = await generateOnboarding(dbh, req.user!.organizationId, employeeId, handoverId ?? null, req.user!.name)
    res.json({ onboarding: created })
  })

  api.get('/onboardings/:id', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(`
      SELECT o.*, e.first_name || ' ' || e.last_name AS employee_name, r.title AS role_title
      FROM onboardings o
      JOIN employees e ON e.id = o.employee_id
      LEFT JOIN roles r ON r.id = o.role_id
      WHERE o.id = $1
    `, [String(req.params.id)])
    if (!rows[0]) return res.status(404).json({ error: 'onboarding introuvable' })
    res.json({ onboarding: rows[0] })
  })

  /* Progression onboarding persistée — l'employé concerné peut cocher ses
   * propres étapes, les managers/admin aussi (audit dans les deux cas). */
  api.post('/onboardings/:id/progress', authRequired(dbh), async (req, res) => {
    const { key, done } = req.body as { key?: string; done?: boolean }
    if (!key || typeof done !== 'boolean') return res.status(400).json({ error: 'key et done (booléen) requis' })
    const rows = await dbh.query<{ id: string; organization_id: string; employee_id: string }>(
      `SELECT id, organization_id, employee_id FROM onboardings WHERE id = $1::uuid`, [String(req.params.id)],
    )
    const onboarding = rows[0]
    if (!onboarding) return res.status(404).json({ error: 'onboarding introuvable' })
    if (onboarding.organization_id !== req.user!.organizationId) {
      return res.status(404).json({ error: 'onboarding introuvable' })
    }
    const isOwnerEmployee = req.user!.employeeId === onboarding.employee_id
    const privileged = ['owner', 'admin', 'manager'].includes(req.user!.appRole)
    if (!isOwnerEmployee && !privileged) {
      return res.status(403).json({ error: 'seul l\'employé concerné ou un manager peut modifier la progression' })
    }
    const planRows = await dbh.query<{ plan: Record<string, unknown> }>(
      `SELECT plan FROM onboardings WHERE id = $1::uuid`, [String(req.params.id)],
    )
    const plan = planRows[0]?.plan ?? {}
    const doneItems: string[] = Array.isArray(plan.doneItems) ? (plan.doneItems as string[]) : []
    const doneItemsNext = done
      ? [...new Set([...doneItems, key])]
      : doneItems.filter((k) => k !== key)
    await dbh.db
      .update(onboardings)
      .set({ plan: { ...plan, doneItems: doneItemsNext } })
      .where(eq(onboardings.id, String(req.params.id)))
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: done ? 'onboarding.step_done' : 'onboarding.step_undone',
      targetType: 'onboarding', targetId: String(req.params.id), detail: { key },
    })
    res.json({ ok: true, doneItems: doneItemsNext })
  })

  /* ------------------------------- Overview -------------------------------- */

  api.get('/overview', authRequired(dbh), async (req, res) => {
    const org = req.user!.organizationId
    const stats = await dbh.query<{ memories: string; employees: string; roles: string; documents: string; handovers: string }>(`
      SELECT (SELECT count(*) FROM memories WHERE organization_id = $1::uuid AND status NOT IN ('rejected','superseded'))::text AS memories,
             (SELECT count(*) FROM employees WHERE organization_id = $2::uuid AND status <> 'former')::text AS employees,
             (SELECT count(*) FROM roles WHERE organization_id = $3::uuid)::text AS roles,
             (SELECT count(*) FROM documents WHERE organization_id = $4::uuid)::text AS documents,
             (SELECT count(*) FROM handovers WHERE organization_id = $5::uuid)::text AS handovers
    `, [org, org, org, org, org])
    const riskOverview = await orgRiskOverview(dbh, org)
    const recentMemories = await dbh.query(`
      SELECT m.id, m.type, m.title, m.confidence, m.status, m.updated_at::text AS updated_at, m.contributor
      FROM memories m WHERE m.organization_id = $1::uuid AND m.status NOT IN ('rejected','superseded')
      ORDER BY m.updated_at DESC LIMIT 8
    `, [org])
    const leaving = await dbh.query(`
      SELECT h.id, h.readiness, h.status, e.first_name || ' ' || e.last_name AS employee_name, r.title AS role_title
      FROM handovers h JOIN employees e ON e.id = h.employee_id LEFT JOIN roles r ON r.id = h.role_id
      WHERE h.organization_id = $1::uuid ORDER BY h.updated_at DESC LIMIT 3
    `, [org])
    res.json({
      stats: {
        memories: Number(stats[0]?.memories ?? 0),
        employees: Number(stats[0]?.employees ?? 0),
        roles: Number(stats[0]?.roles ?? 0),
        documents: Number(stats[0]?.documents ?? 0),
        handovers: Number(stats[0]?.handovers ?? 0),
      },
      risk: {
        overall: riskOverview.overall,
        level: riskOverview.level,
        criticalPeople: riskOverview.criticalPeople,
        criticalRoles: riskOverview.criticalRoles,
        topEmployees: riskOverview.employees.slice(0, 4).map((e) => ({ name: e.subjectName, score: e.score, level: e.level })),
      },
      recentMemories,
      handovers: leaving,
    })
  })

  /* ------------------------------- Audit ----------------------------------- */

  api.get('/audit', authRequired(dbh), async (req, res) => {
    const kind = req.query.kind as string | undefined
    const rows = await dbh.query(`
      SELECT id, actor_name, actor_kind, action, target_type, target_id, detail, created_at::text AS created_at
      FROM audit_events WHERE organization_id = $1::uuid AND ($2::text IS NULL OR action LIKE $2::text || '%')
      ORDER BY created_at DESC LIMIT 100
    `, [req.user!.organizationId, kind && kind !== 'all' ? kind : null])
    res.json({ events: rows })
  })

  /* --------------------------- Comptes & organisation ----------------------- */

  api.get('/users', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const rows = await dbh.query(
      `SELECT u.id, u.email, u.name, u.app_role, u.active, u.last_active_at::text AS last_active_at, u.employee_id
       FROM users u WHERE u.organization_id = $1::uuid ORDER BY u.created_at`, [req.user!.organizationId],
    )
    res.json({ users: rows })
  })

  api.post('/organizations/current', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const { name, sector, country } = req.body as { name?: string; sector?: string; country?: string }
    const trimmedName = (name ?? '').trim()
    if (trimmedName.length < 2) return res.status(400).json({ error: 'nom requis (2 caractères minimum)' })
    const current = (
      await dbh.query<{ name: string; sector: string | null; country: string | null }>(
        `SELECT name, sector, country FROM organizations WHERE id = $1::uuid`, [req.user!.organizationId],
      )
    )[0]
    if (!current) return res.status(404).json({ error: 'organisation introuvable' })
    const nextSector = sector === undefined ? current.sector : (sector.trim() || null)
    const nextCountry = country === undefined ? current.country : (country.trim() || null)
    await dbh.exec(
      `UPDATE organizations SET name = $1, sector = $2, country = $3 WHERE id = $4::uuid`,
      [trimmedName, nextSector, nextCountry, req.user!.organizationId],
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'org.updated', targetType: 'organization', targetId: req.user!.organizationId,
      detail: { name: trimmedName, sector: nextSector, country: nextCountry },
    })
    res.json({ organization: { name: trimmedName, sector: nextSector, country: nextCountry } })
  })

  /* -------------------------------- Seed ----------------------------------- */

  api.post('/admin/seed', async (_req, res) => {
    const { seedDatabase } = await import('./seed.js')
    const result = await seedDatabase(dbh)
    res.json(result)
  })

  return api
}

// Re-exported for tests.
export { documents, memories, employees, roles, departments, memoryVersions, memorySources, onboardings, extractTextFromFile }
