import { eq } from 'drizzle-orm'
import type { DbHandle } from '../db/client.js'
import { onboardings, employees } from '../db/schema.js'
import { audit } from '../audit.js'

/**
 * Onboarding generator — J1 / J7 / J30 plan built from:
 * Role Brain + Handover + Company Brain + active projects.
 */

interface PlanSection {
  id: string
  phase: 'J1' | 'J7' | 'J30'
  title: string
  detail: string
  icon: string
  items: string[]
  from: string
}

export async function generateOnboarding(
  dbh: DbHandle,
  organizationId: string,
  employeeId: string,
  handoverId: string | null,
  actorName: string,
) {
  const emp = await dbh.query<{ first_name: string; last_name: string; role_id: string | null }>(
    `SELECT first_name, last_name, role_id FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`, [employeeId, organizationId],
  )
  const employee = emp[0]
  if (!employee) throw new Error('employé introuvable')
  const employeeName = `${employee.first_name} ${employee.last_name}`
  const roleId = employee.role_id

  const roleTitle = roleId
    ? (await dbh.query<{ title: string }>(`SELECT title FROM roles WHERE id = $1::uuid`, [roleId]))[0]?.title ?? ''
    : ''

  // Role Brain durable knowledge
  const roleMemories = roleId
    ? await dbh.query<{ id: string; type: string; title: string; content: string }>(
        `SELECT id, type, title, content FROM memories
         WHERE role_id = $1::uuid AND scope IN ('role', 'company') AND status IN ('active', 'verified')
         ORDER BY importance DESC LIMIT 30`, [roleId],
      )
    : []

  // Handover contributions
  const handoverMemories = handoverId
    ? await dbh.query<{ id: string; type: string; title: string; content: string; contributor: string | null }>(
        `SELECT m.id, m.type, m.title, m.content, m.contributor FROM memories m
         JOIN handover_answers ha ON ha.produced_memory_id = m.id
         WHERE ha.handover_id = $1::uuid
         GROUP BY m.id, m.type, m.title, m.content, m.contributor, m.importance
         ORDER BY m.importance DESC LIMIT 12`, [handoverId],
      )
    : []

  const procedures = roleMemories.filter((m) => m.type === 'procedure')
  const clients = roleMemories.filter((m) => m.type === 'relationship')
  const decisions = roleMemories.filter((m) => m.type === 'decision')
  const projects = roleMemories.filter((m) => m.type === 'project')
  const tasks = roleMemories.filter((m) => m.type === 'preference' || m.type === 'fact')

  const sections: PlanSection[] = [
    {
      id: 'j1-access',
      phase: 'J1',
      title: 'Jour 1 — Mise en place',
      detail: 'Accès, présentations, première connexion à Companion.',
      icon: 'role',
      from: 'Company Brain',
      items: [
        'Créer vos accès (email, outils métier, Companion)',
        'Lire le résumé du rôle — 10 minutes',
        `Rencontrer les titulaires du rôle ${roleTitle ? `(${roleTitle})` : ''}`,
      ],
    },
    {
      id: 'j1-role',
      phase: 'J1',
      title: 'Comprendre le rôle',
      detail: 'Responsabilités et routine du poste.',
      icon: 'role',
      from: 'Role Brain',
      items: tasks.slice(0, 3).map((t) => t.title).concat(['Les 5 tâches récurrentes du poste']).slice(0, 4),
    },
    {
      id: 'j7-procedures',
      phase: 'J7',
      title: 'Semaine 1 — Procédures critiques',
      detail: 'Les procédures à maîtriser dès les premiers jours.',
      icon: 'procedures',
      from: 'Role Brain + Handover',
      items: [
        ...procedures.slice(0, 4).map((p) => p.title),
        ...handoverMemories.filter((m) => m.type === 'procedure').slice(0, 2).map((p) => `${p.title} (issu de l'entretien de transfert)`),
      ].slice(0, 6),
    },
    {
      id: 'j7-clients',
      phase: 'J7',
      title: 'Semaine 1 — Clients & relations',
      detail: 'Le portefeuille, son histoire et ses engagements.',
      icon: 'customers',
      from: 'Role Brain + Handover',
      items: [
        ...clients.slice(0, 4).map((c) => c.title),
        ...handoverMemories.filter((m) => m.type === 'relationship').slice(0, 2).map((c) => `${c.title} (engagements de ${c.contributor ?? 'votre prédécesseur'})`),
      ].slice(0, 6),
    },
    {
      id: 'j7-projects',
      phase: 'J7',
      title: 'Semaine 1 — Projets en cours',
      detail: 'Ce qui tourne actuellement et où vous intervenez.',
      icon: 'projects',
      from: 'Projets actifs',
      items: projects.slice(0, 4).map((p) => p.title),
    },
    {
      id: 'j30-decisions',
      phase: 'J30',
      title: 'Mois 1 — Décisions importantes',
      detail: 'Les décisions récentes et leur rationale.',
      icon: 'decisions',
      from: 'Role Brain',
      items: decisions.slice(0, 4).map((d) => d.title),
    },
    {
      id: 'j30-tasks',
      phase: 'J30',
      title: 'Mois 1 — Tâches récurrentes',
      detail: 'Le rythme hebdomadaire et mensuel du poste.',
      icon: 'tasks',
      from: 'Role Brain',
      items: tasks.slice(0, 4).map((t) => t.title),
    },
    {
      id: 'j30-check',
      phase: 'J30',
      title: 'Mois 1 — Vérification des connaissances',
      detail: 'Un quiz court pour valider l’essentiel.',
      icon: 'check',
      from: 'Onboarding Agent',
      items: ['10 questions sur les clients et procédures critiques'],
    },
    {
      id: 'j30-ask',
      phase: 'J30',
      title: 'Demander à Companion',
      detail: 'Posez toutes vos questions à la mémoire de l’entreprise.',
      icon: 'ask',
      from: 'Ask Companion',
      items: ['Exemples : « Comment préparons-nous un appel d’offres ? »', '« Quels sont les engagements envers ce client ? »'],
    },
  ]

  const people = await dbh.query<{ name: string; role: string | null }>(
    roleId
      ? `SELECT e.first_name || ' ' || e.last_name AS name, r.title AS role
         FROM employees e LEFT JOIN roles r ON r.id = e.role_id
         WHERE e.role_id = $1::uuid AND e.id <> $2 AND e.status <> 'former' LIMIT 4`
      : `SELECT '' AS name, '' AS role LIMIT 0`,
    roleId ? [roleId, employeeId] : [],
  )
  if (people.length > 0) {
    sections.splice(5, 0, {
      id: 'j7-people',
      phase: 'J7',
      title: 'Semaine 1 — Personnes à connaître',
      detail: 'Votre réseau interne.',
      icon: 'people',
      from: 'Organisation',
      items: people.map((p) => `${p.name}${p.role ? ` — ${p.role}` : ''}`),
    })
  }

  const readiness = Math.round(
    Math.min(96, 40 + procedures.length * 4 + clients.length * 3 + (handoverMemories.length > 0 ? 15 : 0) + decisions.length * 2),
  )

  const [created] = await dbh.db
    .insert(onboardings)
    .values({
      organizationId,
      employeeId,
      roleId,
      handoverId,
      plan: {
        employee: employeeName,
        role: roleTitle,
        readiness,
        sections,
        generatedAt: new Date().toISOString(),
      },
    })
    .returning()

  // The new employee becomes "onboarding".
  await dbh.db.update(employees).set({ status: 'onboarding' }).where(eq(employees.id, employeeId))

  await audit(dbh, organizationId, {
    actorName,
    actorKind: 'agent',
    action: 'onboarding.generated',
    targetType: 'onboarding',
    targetId: created.id,
    detail: { employee: employeeName, readiness, sections: sections.length },
  })

  return created
}
