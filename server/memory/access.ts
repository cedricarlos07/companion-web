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

export function memoryAccessClause(actor: MemoryActor | null, organizationId: string): string {
  void organizationId
  if (!actor) return 'TRUE'

  if (actor.kind === 'agent') {
    const scopes = actor.memoryScopes ?? []
    if (scopes.includes('*')) return 'TRUE'
    const clauses: string[] = []
    for (const grant of scopes) {
      if (grant === 'company') clauses.push(`m.scope = 'company'`)
      else if (grant === 'role') clauses.push(`m.scope = 'role'`)
      else if (grant === 'department') clauses.push(`m.scope = 'department'`)
      else if (grant === 'employee:own')
        clauses.push(`(m.scope = 'employee' AND m.employee_id = '${actor.employeeId ?? '__none__'}')`)
      else if (grant.startsWith('role:'))
        clauses.push(`(m.scope = 'role' AND m.role_id IN (SELECT id FROM roles WHERE title = '${grant.slice(4).replace(/'/g, "''")}'))`)
      else if (grant.startsWith('department:'))
        clauses.push(`(m.scope = 'department' AND m.department_id IN (SELECT id FROM departments WHERE name = '${grant.slice(11).replace(/'/g, "''")}'))`)
    }
    // Les agents voient aussi les mémoires dont ils sont propriétaires.
    if (actor.employeeId) clauses.push(`m.employee_id = '${actor.employeeId}'`)
    return clauses.length > 0 ? `(${clauses.join(' OR ')})` : 'FALSE'
  }

  // Utilisateurs : les rôles privilégiés voient toute l'organisation.
  if (actor.appRole && PRIVILEGED.has(actor.appRole)) return 'TRUE'
  // Employé simple : ses propres mémoires + scopes partagés de son périmètre.
  const clauses: string[] = [`m.scope = 'company'`]
  if (actor.employeeId) clauses.push(`m.employee_id = '${actor.employeeId}'`)
  if (actor.departmentId) clauses.push(`m.department_id = '${actor.departmentId}'`)
  return `(${clauses.join(' OR ')})`
}
