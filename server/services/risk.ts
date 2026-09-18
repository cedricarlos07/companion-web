import type { DbHandle } from '../db/client.js'

/**
 * Knowledge Risk — explicable score per employee and per role.
 *
 *   score = 30% single-owner ratio     (knowledge only this person holds)
 *        + 25% coverage gap            (inverse of documented coverage)
 *      + 15% freshness risk          (stale knowledge)
 *      + 10% source diversity risk   (knowledge with a single weak source)
 *      + 20% handover readiness gap  (no handover or low readiness)
 *
 * Every score returns its factors — the UI never shows a magic number.
 */

export interface RiskFactor {
  key: string
  label: string
  value: number
  weight: number
  contribution: number
  detail: string
}

export interface RiskScore {
  subjectType: 'employee' | 'role'
  subjectId: string
  subjectName: string
  score: number
  level: 'critical' | 'high' | 'moderate' | 'low'
  factors: RiskFactor[]
  stats: {
    memories: number
    procedures: number
    uniqueMemories: number
    staleMemories: number
    singleSourceMemories: number
    handoverReadiness: number | null
    coverage: number
  }
}

export async function computeEmployeeRisk(dbh: DbHandle, organizationId: string, employeeId: string): Promise<RiskScore | null> {
  const emp = await dbh.query<{ id: string; first_name: string; last_name: string; role_id: string | null; status: string }>(
    `SELECT id, first_name, last_name, role_id, status FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`, [employeeId, organizationId],
  )
  const e = emp[0]
  if (!e) return null
  const name = `${e.first_name} ${e.last_name}`

  const stats = await memoryStatsFor(dbh, 'employee', employeeId)
  const orgTotals = await orgTotalsFor(dbh, organizationId)

  // 1) Single-owner ratio — of all org memories with an employee owner, how much rests on this person alone?
  const singleOwner = await dbh.query<{ cnt: string }>(`
    SELECT count(*)::text AS cnt FROM memories m
    WHERE m.organization_id = $1::uuid
      AND m.employee_id = $2::uuid
      AND m.type IN ('procedure', 'decision')
      AND NOT EXISTS (
        SELECT 1 FROM memories m2
        WHERE m2.organization_id = m.organization_id
          AND m2.id <> m.id
          AND m2.type = m.type
          AND m2.scope = m.scope
          AND m2.title = m.title
          AND m2.employee_id <> m.employee_id
      )
  `, [organizationId, employeeId])
  const singleOwnerCount = Number(singleOwner[0]?.cnt ?? 0)
  const uniqueRatio = stats.total > 0 ? Math.min(1, singleOwnerCount / Math.max(20, stats.total * 0.25)) : 0.9

  // 2) Coverage — documented durable knowledge vs role expectation
  const coverage = estimateCoverage(stats)

  // 3) Freshness — share of durable knowledge not touched in 12 months
  const freshnessRisk = stats.total > 0 ? stats.stale / stats.total : 0.8

  // 4) Source diversity — memories with zero or one source document
  const sourceDiversityRisk = stats.total > 0 ? stats.singleSource / stats.total : 0.8

  // 5) Handover readiness
  const hv = await dbh.query<{ readiness: number }>(
    `SELECT readiness FROM handovers WHERE employee_id = $1::uuid ORDER BY created_at DESC LIMIT 1`, [employeeId],
  )
  const handoverReadiness = hv[0]?.readiness ?? null
  const handoverGap = e.status === 'leaving' ? 1 - (handoverReadiness ?? 0) / 100 : handoverReadiness === null ? 0.4 : 1 - handoverReadiness / 100

  const factors: RiskFactor[] = [
    factor('single_owner', 'Connaissances à propriétaire unique', uniqueRatio * 100, 30, `${singleOwnerCount} procédures/décisions ne reposent que sur ${name}`),
    factor('coverage', 'Couverture documentaire', (1 - coverage) * 100, 25, `Couverture estimée ${Math.round(coverage * 100)} % — ${stats.procedures} procédures documentées`),
    factor('freshness', 'Obsolescence', freshnessRisk * 100, 15, `${stats.stale} connaissance(s) non mises à jour depuis plus de 12 mois`),
    factor('diversity', 'Diversité des sources', sourceDiversityRisk * 100, 10, `${stats.singleSource} connaissance(s) appuyées sur une seule source`),
    factor('handover', 'Préparation du transfert', handoverGap * 100, 20, handoverReadiness === null ? 'Aucun handover préparé' : `Handover à ${handoverReadiness} %`),
  ]

  const score = Math.round(factors.reduce((s, f) => s + f.contribution, 0))
  return {
    subjectType: 'employee',
    subjectId: employeeId,
    subjectName: name,
    score,
    level: levelOf(score),
    factors,
    stats: {
      memories: stats.total,
      procedures: stats.procedures,
      uniqueMemories: singleOwnerCount,
      staleMemories: stats.stale,
      singleSourceMemories: stats.singleSource,
      handoverReadiness,
      coverage: Math.round(coverage * 100),
    },
  }
}

export async function computeRoleRisk(dbh: DbHandle, organizationId: string, roleId: string): Promise<RiskScore | null> {
  const role = await dbh.query<{ id: string; title: string }>(
    `SELECT id, title FROM roles WHERE id = $1::uuid AND organization_id = $2::uuid`, [roleId, organizationId],
  )
  const r = role[0]
  if (!r) return null

  const stats = await memoryStatsFor(dbh, 'role', roleId)
  const holders = await dbh.query<{ cnt: string }>(
    `SELECT count(*)::text AS cnt FROM employees WHERE role_id = $1::uuid AND status IN ('active', 'leaving')`, [roleId],
  )
  const holderCount = Number(holders[0]?.cnt ?? 0)

  const singleOwner = await dbh.query<{ cnt: string }>(`
    SELECT count(DISTINCT m.title)::text AS cnt FROM memories m
    WHERE m.organization_id = $1::uuid AND m.role_id = $2::uuid
      AND m.type IN ('procedure', 'decision')
      AND NOT EXISTS (
        SELECT 1 FROM memories m3
        WHERE m3.organization_id = m.organization_id AND m3.role_id = m.role_id
          AND m3.title = m.title AND m3.id <> m.id
      )
  `, [organizationId, roleId])
  const uniqueCount = Number(singleOwner[0]?.cnt ?? 0)
  const uniqueRatio = stats.total > 0 ? Math.min(1, uniqueCount / Math.max(20, stats.total * 0.2)) : 1
  // A role held by a single person is structurally riskier.
  const busFactor = holderCount <= 1 ? 1 : holderCount === 2 ? 0.55 : 0.25
  const coverage = estimateCoverage(stats)
  const freshnessRisk = stats.total > 0 ? stats.stale / stats.total : 0.8
  const sourceDiversityRisk = stats.total > 0 ? stats.singleSource / stats.total : 0.8

  const lastHv = await dbh.query<{ readiness: number }>(`
    SELECT h.readiness FROM handovers h
    JOIN employees e ON e.id = h.employee_id
    WHERE e.role_id = $1::uuid ORDER BY h.created_at DESC LIMIT 1
  `, [roleId])
  const handoverReadiness = lastHv[0]?.readiness ?? null
  const handoverGap = handoverReadiness === null ? 0.5 : 1 - handoverReadiness / 100

  const factors: RiskFactor[] = [
    factor('single_owner', 'Savoir concentré sur un titulaire', uniqueRatio * 100, 30, `${uniqueCount} procédures/décisions du rôle sans doublon`),
    factor('bus_factor', 'Nombre de titulaires', busFactor * 100, 25, `${holderCount} personne(s) occupent ce rôle`),
    factor('coverage', 'Couverture documentaire', (1 - coverage) * 100, 15, `Couverture estimée ${Math.round(coverage * 100)} %`),
    factor('freshness', 'Obsolescence', freshnessRisk * 100, 15, `${stats.stale} connaissance(s) obsolète(s) sur ${stats.total}`),
    factor('handover', 'Préparation du transfert', handoverGap * 100, 15, handoverReadiness === null ? 'Aucun handover sur ce rôle' : `Dernier handover à ${handoverReadiness} %`),
  ]

  const score = Math.round(factors.reduce((s, f) => s + f.contribution, 0))
  return {
    subjectType: 'role',
    subjectId: roleId,
    subjectName: r.title,
    score,
    level: levelOf(score),
    factors,
    stats: {
      memories: stats.total,
      procedures: stats.procedures,
      uniqueMemories: uniqueCount,
      staleMemories: stats.stale,
      singleSourceMemories: stats.singleSource,
      handoverReadiness,
      coverage: Math.round(coverage * 100),
    },
  }
}

export async function orgRiskOverview(dbh: DbHandle, organizationId: string) {
  const emps = await dbh.query<{ id: string }>(
    `SELECT id FROM employees WHERE organization_id = $1::uuid AND status IN ('active', 'leaving')`, [organizationId],
  )
  const rolesList = await dbh.query<{ id: string }>(
    `SELECT id FROM roles WHERE organization_id = $1::uuid`, [organizationId],
  )
  const employeeScores: RiskScore[] = []
  for (const e of emps) {
    const s = await computeEmployeeRisk(dbh, organizationId, e.id)
    if (s) employeeScores.push(s)
  }
  const roleScores: RiskScore[] = []
  for (const r of rolesList) {
    const s = await computeRoleRisk(dbh, organizationId, r.id)
    if (s) roleScores.push(s)
  }
  const overall = employeeScores.length > 0
    ? Math.round(employeeScores.reduce((s, e) => s + e.score, 0) / employeeScores.length)
    : 0
  return {
    overall,
    level: levelOf(overall),
    criticalPeople: employeeScores.filter((e) => e.level === 'critical' || e.level === 'high').length,
    criticalRoles: roleScores.filter((r) => r.level === 'critical').length,
    singleOwnerProcedures: employeeScores.reduce((s, e) => s + e.stats.uniqueMemories, 0),
    employees: employeeScores.sort((a, b) => b.score - a.score),
    roles: roleScores.sort((a, b) => b.score - a.score),
  }
}

/* ------------------------------ internals ------------------------------- */

interface MemStats {
  total: number
  procedures: number
  stale: number
  singleSource: number
}

async function memoryStatsFor(dbh: DbHandle, scope: 'employee' | 'role', id: string): Promise<MemStats> {
  const rows = await dbh.query<{ total: string; procedures: string; stale: string; single_source: string }>(`
    SELECT
      count(*)::text AS total,
      count(*) FILTER (WHERE m.type = 'procedure' AND m.status IN ('active','verified','candidate'))::text AS procedures,
      count(*) FILTER (WHERE m.updated_at < now() - interval '365 days')::text AS stale,
      count(*) FILTER (WHERE (SELECT count(*) FROM memory_sources ms WHERE ms.memory_id = m.id) <= 1 AND m.origin <> 'human')::text AS single_source
    FROM memories m
    WHERE CASE WHEN $2::text = 'role' THEN m.role_id::text ELSE m.employee_id::text END = $1::text
      AND m.status NOT IN ('rejected', 'superseded')
  `, [id, scope])
  return {
    total: Number(rows[0]?.total ?? 0),
    procedures: Number(rows[0]?.procedures ?? 0),
    stale: Number(rows[0]?.stale ?? 0),
    singleSource: Number(rows[0]?.single_source ?? 0),
  }
}

async function orgTotalsFor(dbh: DbHandle, organizationId: string) {
  const rows = await dbh.query<{ employees: string; roles: string }>(`
    SELECT
      (SELECT count(*) FROM employees WHERE organization_id = $1::uuid AND status <> 'former')::text AS employees,
      (SELECT count(*) FROM roles WHERE organization_id = $2::uuid)::text AS roles
  `, [organizationId, organizationId])
  return { employees: Number(rows[0]?.employees ?? 0), roles: Number(rows[0]?.roles ?? 0) }
}

/** Estimated documented coverage from durable knowledge volume and procedure share. */
function estimateCoverage(stats: MemStats): number {
  if (stats.total === 0) return 0.2
  const volumeScore = Math.min(1, stats.total / 300)
  const procedureScore = Math.min(1, stats.procedures / 25)
  return Math.max(0.15, Math.min(0.98, volumeScore * 0.5 + procedureScore * 0.5))
}

function factor(key: string, label: string, value: number, weight: number, detail: string): RiskFactor {
  const v = Math.max(0, Math.min(100, value))
  return { key, label, value: Math.round(v), weight, contribution: (v / 100) * weight, detail }
}

function levelOf(score: number): RiskScore['level'] {
  if (score >= 70) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 30) return 'moderate'
  return 'low'
}
