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
    const rows = await dbh.query<{ id: string; email: string; name: string; app_role: string; organization_id: string; employee_id: string | null; org_name: string; instance_url: string | null }>(
      `SELECT u.id, u.email, u.name, u.app_role, u.organization_id, u.employee_id, o.name AS org_name, o.instance_url
       FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.id = '${req.user!.id}'`,
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
    res.json({
      engine: 'companion-real',
      dbDriver: dbh.driver,
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
      WHERE e.organization_id = '${req.user!.organizationId}'
      ORDER BY e.first_name
    `)
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
      WHERE e.id = '${id}'
    `)
    if (!emp[0]) return res.status(404).json({ error: 'employé introuvable' })

    const mems = await dbh.query(`SELECT id, type, title, content, scope, status, confidence, importance, contributor, updated_at::text AS updated_at FROM memories WHERE employee_id = '${id}' AND status NOT IN ('rejected','superseded') ORDER BY importance DESC, updated_at DESC`)
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
      WHERE r.organization_id = '${req.user!.organizationId}'
      ORDER BY r.title
    `)
    res.json({ roles: rows })
  })

  api.get('/roles/:id', authRequired(dbh), async (req, res) => {
    const id = String(req.params.id)
    const role = await dbh.query(`SELECT r.id, r.title, d.name AS department FROM roles r LEFT JOIN departments d ON d.id = r.department_id WHERE r.id = '${id}'`)
    if (!role[0]) return res.status(404).json({ error: 'rôle introuvable' })
    const mems = await dbh.query(`SELECT id, type, title, content, scope, status, confidence, importance, contributor, employee_id, updated_at::text AS updated_at FROM memories WHERE role_id = '${id}' AND status NOT IN ('rejected','superseded') ORDER BY importance DESC`)
    const contributors = await dbh.query(`
      SELECT contributor AS name, count(*)::int AS contributions,
             min(created_at::text) AS from, max(updated_at::text) AS to,
             max(employee_id) AS employee_id
      FROM memories WHERE role_id = '${id}' AND contributor IS NOT NULL
      GROUP BY contributor ORDER BY count(*) DESC LIMIT 10
    `)
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
    const srcs = await dbh.query(`SELECT * FROM sources WHERE organization_id = '${req.user!.organizationId}' ORDER BY created_at DESC`)
    const docs = await dbh.query(`
      SELECT d.id, d.title, d.mime_type, d.size_bytes, d.status, d.status_detail, d.uploaded_at::text AS uploaded_at,
             s.name AS source_name
      FROM documents d LEFT JOIN sources s ON s.id = d.source_id
      WHERE d.organization_id = '${req.user!.organizationId}'
      ORDER BY d.uploaded_at DESC LIMIT 30
    `)
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
    const rows = await dbh.query(`SELECT id, title, status, status_detail, mime_type, size_bytes, uploaded_at::text AS uploaded_at FROM documents WHERE id = '${String(req.params.id)}'`)
    if (!rows[0]) return res.status(404).json({ error: 'document introuvable' })
    res.json({ document: rows[0] })
  })

  /* ------------------------------ Memories -------------------------------- */

  api.get('/memories', authRequired(dbh), async (req, res) => {
    const { type, status, q, employeeId, roleId, scope } = req.query as Record<string, string | undefined>
    const clauses = [`m.organization_id = '${req.user!.organizationId}'`, `m.status NOT IN ('rejected','superseded')`]
    if (type) clauses.push(`m.type = '${type}'`)
    if (status) clauses.push(`m.status = '${status}'`)
    if (scope) clauses.push(`m.scope = '${scope}'`)
    if (employeeId) clauses.push(`m.employee_id = '${employeeId}'`)
    if (roleId) clauses.push(`m.role_id = '${roleId}'`)
    if (q) clauses.push(`(m.title ILIKE '%${q.replace(/'/g, "''")}%' OR m.content ILIKE '%${q.replace(/'/g, "''")}%')`)
    const rows = await dbh.query(`
      SELECT m.id, m.type, m.title, m.content, m.scope, m.status, m.confidence, m.importance,
             m.contributor, m.employee_id, m.role_id, m.version, m.origin, m.human_validated,
             m.created_at::text AS created_at, m.updated_at::text AS updated_at,
             e.first_name || ' ' || e.last_name AS employee_name,
             r.title AS role_title
      FROM memories m
      LEFT JOIN employees e ON e.id = m.employee_id
      LEFT JOIN roles r ON r.id = m.role_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY m.updated_at DESC
      LIMIT 200
    `)
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
      WHERE m.id = '${id}'
    `)
    if (!rows[0]) return res.status(404).json({ error: 'mémoire introuvable' })
    const evidence = await dbh.query(`
      SELECT ms.excerpt, ms.location, d.title AS document_title, d.id AS document_id, d.mime_type
      FROM memory_sources ms LEFT JOIN documents d ON d.id = ms.document_id
      WHERE ms.memory_id = '${id}'
    `)
    const versions = await dbh.query(`SELECT version, title, content, status, confidence, importance, changed_by, change_reason, created_at::text AS created_at FROM memory_versions WHERE memory_id = '${id}' ORDER BY version DESC`)
    const related = await dbh.query(`
      SELECT m2.id, m2.title, m2.type, ml.kind
      FROM memory_links ml JOIN memories m2 ON m2.id = CASE WHEN ml.from_memory_id = '${id}' THEN ml.to_memory_id ELSE ml.from_memory_id END
      WHERE ml.from_memory_id = '${id}' OR ml.to_memory_id = '${id}'
    `)
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
       FROM invitations i WHERE i.organization_id = '${req.user!.organizationId}' ORDER BY i.created_at DESC`,
    )
    res.json({ invitations: rows })
  })

  api.post('/invitations', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { email, role } = req.body as { email?: string; role?: string }
    if (!email || !role) return res.status(400).json({ error: 'email et role requis' })
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

  /* --------------------------- Entitlements -------------------------------- */

  api.get('/entitlements', authRequired(dbh), async (req, res) => {
    const { getEntitlements } = await import('./services/entitlements.js')
    res.json({ entitlements: await getEntitlements(dbh, req.user!.organizationId) })
  })

  api.get('/license', authRequired(dbh), async (req, res) => {
    const { checkLicenseStatus } = await import('./services/licenses.js')
    const license = await checkLicenseStatus(dbh, req.user!.organizationId)
    res.json(license)
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
      const emp = await dbh.query<{ department_id: string | null }>(`SELECT department_id FROM employees WHERE id = '${req.user!.employeeId}'`)
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
      WHERE h.organization_id = '${req.user!.organizationId}'
      ORDER BY h.created_at DESC
    `)
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
      WHERE h.id = '${id}'
    `)
    if (!rows[0]) return res.status(404).json({ error: 'handover introuvable' })
    const gaps = await dbh.query(`
      SELECT g.id, g.kind, g.question, g.detail, g.status,
             ha.answer_text, ha.answered_by, ha.produced_memory_id,
             iq.prompt, iq.order_index
      FROM handover_gaps g
      LEFT JOIN handover_answers ha ON ha.gap_id = g.id
      LEFT JOIN interview_questions iq ON iq.gap_id = g.id
      WHERE g.handover_id = '${id}'
      ORDER BY COALESCE(iq.order_index, 99), g.created_at
    `)
    const uniqueKnowledge = await dbh.query(`
      SELECT m.id, m.title, m.type, m.confidence FROM memories m
      WHERE m.employee_id = (SELECT employee_id FROM handovers WHERE id = '${id}')
        AND m.type IN ('procedure','decision','relationship','lesson')
        AND m.status NOT IN ('rejected','superseded')
        AND NOT EXISTS (
          SELECT 1 FROM memories m2 WHERE m2.organization_id = m.organization_id AND m2.id <> m.id
            AND m2.type = m.type AND m2.title = m.title AND m2.employee_id <> m.employee_id
        )
      ORDER BY m.importance DESC LIMIT 20
    `)
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
      WHERE o.organization_id = '${req.user!.organizationId}'
      ORDER BY o.created_at DESC
    `)
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
      WHERE o.id = '${String(req.params.id)}'
    `)
    if (!rows[0]) return res.status(404).json({ error: 'onboarding introuvable' })
    res.json({ onboarding: rows[0] })
  })

  /* ------------------------------- Overview -------------------------------- */

  api.get('/overview', authRequired(dbh), async (req, res) => {
    const org = req.user!.organizationId
    const stats = await dbh.query<{ memories: string; employees: string; roles: string; documents: string; handovers: string }>(`
      SELECT (SELECT count(*) FROM memories WHERE organization_id = '${org}' AND status NOT IN ('rejected','superseded'))::text AS memories,
             (SELECT count(*) FROM employees WHERE organization_id = '${org}' AND status <> 'former')::text AS employees,
             (SELECT count(*) FROM roles WHERE organization_id = '${org}')::text AS roles,
             (SELECT count(*) FROM documents WHERE organization_id = '${org}')::text AS documents,
             (SELECT count(*) FROM handovers WHERE organization_id = '${org}')::text AS handovers
    `)
    const riskOverview = await orgRiskOverview(dbh, org)
    const recentMemories = await dbh.query(`
      SELECT m.id, m.type, m.title, m.confidence, m.status, m.updated_at::text AS updated_at, m.contributor
      FROM memories m WHERE m.organization_id = '${org}' AND m.status NOT IN ('rejected','superseded')
      ORDER BY m.updated_at DESC LIMIT 8
    `)
    const leaving = await dbh.query(`
      SELECT h.id, h.readiness, h.status, e.first_name || ' ' || e.last_name AS employee_name, r.title AS role_title
      FROM handovers h JOIN employees e ON e.id = h.employee_id LEFT JOIN roles r ON r.id = h.role_id
      WHERE h.organization_id = '${org}' ORDER BY h.updated_at DESC LIMIT 3
    `)
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
    const where = kind && kind !== 'all'
      ? `action LIKE '${kind}%'`
      : 'true'
    const rows = await dbh.query(`
      SELECT id, actor_name, actor_kind, action, target_type, target_id, detail, created_at::text AS created_at
      FROM audit_events WHERE organization_id = '${req.user!.organizationId}' AND ${where}
      ORDER BY created_at DESC LIMIT 100
    `)
    res.json({ events: rows })
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
