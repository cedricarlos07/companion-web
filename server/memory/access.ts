/**
 * Permissions mémoire propagées jusqu'au retrieval.
 *
 * Un acteur (utilisateur ou agent) ne voit que les scopes qui lui sont
 * accordés. La clause SQL produite sert au path native ET à l'hydratation
 * du path Mem0 — le contrôle est TOUJOURS refait sur la base Companion,
 * jamais sur la seule mémoire du provider.
 */

export interface MemoryActor {
  kind: 'user' | 'agent'
  organizationId: string
  /** owner | admin | manager | auditor | employee | agent */
  appRole?: string
  employeeId?: string | null
  departmentId?: string | null
  /** Pour les agents : grants du type '*', 'company', 'role', 'department', 'employee:own' */
  memoryScopes?: string[]
}

const PRIVILEGED = new Set(['owner', 'admin', 'manager', 'auditor'])

export interface SqlFragment {
  /** SQL text — placeholders $n already offset according to `startAt`. */
  text: string
  params: unknown[]
}

/**
 * Clause d'accès mémoire paramétrée. Les placeholders commencent à `startAt`
 * pour se composer avec le reste de la requête : le consommateur écrit son
 * SQL en décalant ses propres placeholders après `fragment.params.length`.
 */
export function memoryAccessClause(actor: MemoryActor | null, organizationId: string, startAt = 1): SqlFragment {
  void organizationId
  let n = startAt - 1
  const next = () => `$${++n}`

  if (!actor) return { text: 'TRUE', params: [] }

  if (actor.kind === 'agent') {
    const scopes = actor.memoryScopes ?? []
    if (scopes.includes('*')) return { text: 'TRUE', params: [] }
    const clauses: string[] = []
    const params: unknown[] = []
    for (const grant of scopes) {
      if (grant === 'company') clauses.push(`m.scope = 'company'`)
      else if (grant === 'role') clauses.push(`m.scope = 'role'`)
      else if (grant === 'department') clauses.push(`m.scope = 'department'`)
      else if (grant === 'employee:own') {
        params.push(actor.employeeId ?? '__none__')
        clauses.push(`(m.scope = 'employee' AND m.employee_id = ${next()})`)
      } else if (grant.startsWith('role:')) {
        params.push(grant.slice(5))
        clauses.push(`(m.scope = 'role' AND m.role_id IN (SELECT id FROM roles WHERE title = ${next()}))`)
      } else if (grant.startsWith('department:')) {
        params.push(grant.slice(11))
        clauses.push(`(m.scope = 'department' AND m.department_id IN (SELECT id FROM departments WHERE name = ${next()}))`)
      }
    }
    // Les agents voient aussi les mémoires dont ils sont propriétaires.
    if (actor.employeeId) {
      params.push(actor.employeeId)
      clauses.push(`m.employee_id = ${next()}`)
    }
    return clauses.length > 0
      ? { text: `(${clauses.join(' OR ')})`, params }
      : { text: 'FALSE', params: [] }
  }

  // Utilisateurs : les rôles privilégiés voient toute l'organisation.
  if (actor.appRole && PRIVILEGED.has(actor.appRole)) return { text: 'TRUE', params: [] }
  // Employé simple : ses propres mémoires + scopes partagés de son périmètre.
  const clauses: string[] = [`m.scope = 'company'`]
  const params: unknown[] = []
  if (actor.employeeId) {
    params.push(actor.employeeId)
    clauses.push(`m.employee_id = ${next()}`)
  }
  if (actor.departmentId) {
    params.push(actor.departmentId)
    clauses.push(`m.department_id = ${next()}`)
  }
  return { text: `(${clauses.join(' OR ')})`, params }
}
