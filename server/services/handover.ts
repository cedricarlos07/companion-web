import { eq } from 'drizzle-orm'
import type { DbHandle } from '../db/client.js'
import { handovers, handoverGaps, handoverAnswers, interviewQuestions, memories, employees } from '../db/schema.js'
import { createMemory } from './memory.js'
import { computeEmployeeRisk } from './risk.js'
import { audit } from '../audit.js'

/**
 * Handover engine:
 *   employee.status = leaving → analyse (projects, clients, procedures, decisions,
 *   tasks, unique knowledge) → knowledge gaps → targeted interview questions →
 *   answers become Memory Candidates → validation → Human Handover Pack +
 *   Machine Context Pack.
 */

export interface HandoverAnalysisSection {
  key: string
  label: string
  coverage: number
  items: string[]
}

export async function startHandover(dbh: DbHandle, organizationId: string, employeeId: string, actorName: string) {
  const emp = await dbh.query<{ id: string; role_id: string | null; first_name: string; last_name: string }>(
    `SELECT id, role_id, first_name, last_name FROM employees WHERE id = '${employeeId}' AND organization_id = '${organizationId}'`,
  )
  const employee = emp[0]
  if (!employee) throw new Error('employé introuvable')

  // Analysis: coverage per knowledge domain from real memories.
  const sections = await analyzeCoverage(dbh, employeeId, employee.role_id)

  const [handover] = await dbh.db
    .insert(handovers)
    .values({
      organizationId,
      employeeId,
      roleId: employee.role_id,
      status: 'gaps',
      readiness: Math.round(sections.reduce((s, x) => s + x.coverage, 0) / sections.length),
      analysis: { sections, startedAt: new Date().toISOString(), engine: 'v1' },
    })
    .returning()

  // Unique knowledge = durable memories that only this employee holds.
  const uniques = await dbh.query<{ id: string; title: string; type: string; content: string }>(`
    SELECT m.id, m.title, m.type, m.content
    FROM memories m
    WHERE m.employee_id = '${employeeId}'
      AND m.type IN ('procedure', 'decision', 'relationship', 'lesson')
      AND m.status IN ('active', 'verified', 'candidate')
      AND NOT EXISTS (
        SELECT 1 FROM memories m2
        WHERE m2.organization_id = m.organization_id AND m2.id <> m.id
          AND m2.type = m.type AND m2.title = m.title AND m2.employee_id <> m.employee_id
      )
    ORDER BY m.importance DESC
    LIMIT 20
  `)

  // Gaps → targeted questions.
  const gaps = detectGaps(sections, uniques)
  for (const [i, gap] of gaps.entries()) {
    const [createdGap] = await dbh.db
      .insert(handoverGaps)
      .values({
        handoverId: handover.id,
        kind: gap.kind,
        question: gap.question,
        detail: gap.detail,
        relatedMemoryId: gap.relatedMemoryId ?? null,
      })
      .returning()
    await dbh.db.insert(interviewQuestions).values({
      handoverId: handover.id,
      gapId: createdGap.id,
      prompt: gap.question,
      orderIndex: i,
    })
  }

  await audit(dbh, organizationId, {
    actorName,
    actorKind: 'agent',
    action: 'handover.started',
    targetType: 'handover',
    targetId: handover.id,
    detail: { employee: `${employee.first_name} ${employee.last_name}`, gaps: gaps.length },
  })

  return { handover, sections, gaps: gaps.length, uniqueKnowledge: uniques.length }
}

async function analyzeCoverage(dbh: DbHandle, employeeId: string, roleId: string | null): Promise<HandoverAnalysisSection[]> {
  const sectionDefs: { key: string; label: string; types: string[] }[] = [
    { key: 'clients', label: 'Clients & relations', types: ['relationship'] },
    { key: 'projects', label: 'Projets', types: ['project'] },
    { key: 'procedures', label: 'Procédures', types: ['procedure'] },
    { key: 'decisions', label: 'Contexte de décision', types: ['decision'] },
    { key: 'tasks', label: 'Tâches récurrentes', types: ['preference', 'fact'] },
    { key: 'lessons', label: 'Leçons', types: ['lesson'] },
  ]
  const sections: HandoverAnalysisSection[] = []
  for (const def of sectionDefs) {
    const owned = await dbh.query<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM memories WHERE employee_id = '${employeeId}' AND type = ANY(${sqlAny(def.types)}) AND status IN ('active','verified','candidate')`,
    )
    // Role Brain reference: what the role already holds independently of this person.
    const roleOwned = roleId
      ? await dbh.query<{ cnt: string }>(
          `SELECT count(DISTINCT lower(title))::text AS cnt FROM memories WHERE role_id = '${roleId}' AND type = ANY(${sqlAny(def.types)}) AND status IN ('active','verified')`,
        )
      : [{ cnt: '0' }]
    const ownedCount = Number(owned[0]?.cnt ?? 0)
    const roleCount = Number(roleOwned[0]?.cnt ?? 0)
    // Coverage = how much of this person's knowledge is already secured in the Role Brain + duplicates.
    const coverage = ownedCount === 0
      ? 60
      : Math.max(10, Math.min(98, Math.round((roleCount / (roleCount + ownedCount)) * 100 + 20)))
    const items = await dbh.query<{ title: string }>(
      `SELECT title FROM memories WHERE employee_id = '${employeeId}' AND type = ANY(${sqlAny(def.types)}) AND status IN ('active','verified','candidate') ORDER BY importance DESC LIMIT 5`,
    )
    sections.push({ key: def.key, label: def.label, coverage, items: items.map((i) => i.title) })
  }
  return sections
}

function detectGaps(
  sections: HandoverAnalysisSection[],
  uniques: { id: string; title: string; type: string; content: string }[],
): { kind: string; question: string; detail: string; relatedMemoryId?: string }[] {
  const gaps: { kind: string; question: string; detail: string; relatedMemoryId?: string }[] = []

  const procedures = sections.find((s) => s.key === 'procedures')
  if (!procedures || procedures.items.length === 0) {
    gaps.push({
      kind: 'missing_procedure',
      question: 'Quelles sont les procédures que vous suivez chaque semaine et que personne d’autre ne documente ?',
      detail: 'Aucune procédure documentée détectée sur ce poste.',
    })
  } else if (procedures.coverage < 70) {
    gaps.push({
      kind: 'missing_procedure',
      question: `Pouvez-vous détailler la procédure « ${procedures.items[0]} » étape par étape, comme pour un successeur ?`,
      detail: 'Procédure connue de vous seul(e) — faible couverture dans le Role Brain.',
    })
  }

  const decisions = sections.find((s) => s.key === 'decisions')
  if (!decisions || decisions.coverage < 70) {
    gaps.push({
      kind: 'decision_context',
      question: 'Quelles décisions récentes avez-vous arbitrées, et pour quelles raisons ?',
      detail: 'Le contexte de décision n’est pas suffisamment documenté.',
    })
  }

  const relations = sections.find((s) => s.key === 'clients')
  if (!relations || relations.coverage < 75) {
    gaps.push({
      kind: 'single_owner_relation',
      question: 'Qui relaie vos relations clients et fournisseurs pendant votre absence, et avec quels engagements ?',
      detail: 'Relations à propriétaire unique détectées.',
    })
  }

  const tasks = sections.find((s) => s.key === 'tasks')
  if (!tasks || tasks.items.length === 0) {
    gaps.push({
      kind: 'undocumented_task',
      question: 'Quelles tâches récurrentes faites-vous chaque mois que personne d’autre ne voit ?',
      detail: 'Aucune tâche récurrente documentée.',
    })
  }

  // First unique knowledge items become explicit interview questions.
  for (const u of uniques.slice(0, 3)) {
    if (gaps.length >= 6) break
    gaps.push({
      kind: u.type === 'decision' ? 'conflict' : 'missing_procedure',
      question: `Je trouve « ${u.title} » mais le détail est incomplet. Pouvez-vous l’expliquer comme si vous formiez votre successeur ?`,
      detail: 'Connaissance qui dépend principalement de vous.',
      relatedMemoryId: u.id,
    })
  }

  if (gaps.length === 0) {
    gaps.push({
      kind: 'missing_procedure',
      question: 'Y a-t-il un savoir ou une astuce du poste que vous n’avez jamais eu l’occasion de documenter ?',
      detail: 'Couverture globalement bonne — question ouverte de sécurité.',
    })
  }
  return gaps.slice(0, 6)
}

const VALID_TYPES = new Set(['fact', 'decision', 'procedure', 'relationship', 'preference', 'lesson', 'project', 'handover'])

/** Answer an interview question → becomes a Memory Candidate (validated separately). */
export async function answerInterviewQuestion(
  dbh: DbHandle,
  organizationId: string,
  handoverId: string,
  gapId: string,
  answerText: string,
  answeredBy: string,
) {
  const gaps = await dbh.query<{ id: string; handover_id: string; question: string; kind: string; related_memory_id: string | null }>(
    `SELECT id, handover_id, question, kind, related_memory_id FROM handover_gaps WHERE id = '${gapId}' AND handover_id = '${handoverId}'`,
  )
  const gap = gaps[0]
  if (!gap) throw new Error('question introuvable')

  const hv = await dbh.query<{ employee_id: string; role_id: string | null }>(
    `SELECT employee_id, role_id FROM handovers WHERE id = '${handoverId}'`,
  )
  const employeeId = hv[0]?.employee_id
  const roleId = hv[0]?.role_id ?? null
  const emp = await dbh.query<{ first_name: string; last_name: string; role_id: string | null }>(
    `SELECT first_name, last_name, role_id FROM employees WHERE id = '${employeeId}'`,
  )
  const employeeName = emp[0] ? `${emp[0].first_name} ${emp[0].last_name}` : answeredBy

  // Create the memory candidate from the answer (interview origin).
  const type = guessType(gap.question, answerText) as Parameters<typeof createMemory>[1]['type']
  const title = titleFromAnswer(gap.question, answerText)
  const result = await createMemory(dbh, {
    organizationId,
    type,
    title,
    content: answerText,
    scope: 'employee',
    employeeId,
    roleId,
    confidence: 78,
    importance: 82,
    status: 'candidate',
    contributor: employeeName,
    origin: 'interview',
    source: {
      excerpt: answerText.slice(0, 280),
      location: 'entretien de connaissances',
    },
    changedBy: answeredBy,
  })

  await dbh.db.insert(handoverAnswers).values({
    gapId,
    handoverId,
    answerText,
    answeredBy,
    producedMemoryId: result.memory?.id ?? null,
  })
  await dbh.db
    .update(handoverGaps)
    .set({ status: 'answered' })
    .where(eq(handoverGaps.id, gapId))
  await dbh.db
    .update(interviewQuestions)
    .set({ answeredAt: new Date() })
    .where(eq(interviewQuestions.gapId, gapId))

  await audit(dbh, organizationId, {
    actorName: answeredBy,
    action: 'handover.interview_answered',
    targetType: 'memory',
    targetId: result.memory?.id,
    detail: { gap: gapId, type },
  })

  // Recompute readiness: answered gaps lift coverage.
  await recomputeReadiness(dbh, handoverId)
  return { answer: (await dbh.query(`SELECT * FROM handover_answers WHERE gap_id = '${gapId}'`))[0], memory: result.memory, created: result.created }
}

function guessType(question: string, answer: string): string {
  const t = `${question} ${answer}`.toLowerCase()
  if (/proc[ée]dur|[ée]tape|comment/.test(t)) return 'procedure'
  if (/pourquoi|d[ée]cision|arbitr|valid/.test(t)) return 'decision'
  if (/client|fournisseur|relation|contact/.test(t)) return 'relationship'
  if (/t[âa]che|r[ée]current|chaque (mois|semaine|lundi|vendredi)/.test(t)) return 'preference'
  if (/le[çc]on|attention|[ée]viter|pi[èe]ge/.test(t)) return 'lesson'
  return 'fact'
}

function titleFromAnswer(question: string, answer: string): string {
  const firstSentence = answer.split(/(?<=[.!?])\s/)[0] ?? answer
  if (firstSentence.length >= 25 && firstSentence.length <= 120) return firstSentence
  const cleaned = question
    .replace(/^(Qui|Que|Quelles?|Quel(?:le?s)?|Comment|Pourquoi|O[uù])\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned || answer.slice(0, 120)
}

async function recomputeReadiness(dbh: DbHandle, handoverId: string) {
  const hv = await dbh.query<{ employee_id: string; readiness: number; analysis: unknown }>(
    `SELECT employee_id, readiness, analysis FROM handovers WHERE id = '${handoverId}'`,
  )
  if (!hv[0]) return
  const gaps = await dbh.query<{ total: string; answered: string }>(
    `SELECT count(*)::text AS total, count(*) FILTER (WHERE status IN ('answered','resolved'))::text AS answered FROM handover_gaps WHERE handover_id = '${handoverId}'`,
  )
  const total = Number(gaps[0]?.total ?? 0)
  const answered = Number(gaps[0]?.answered ?? 0)
  const analysis = hv[0].analysis as { sections?: { coverage: number }[] }
  const baseCoverage = analysis.sections?.length
    ? analysis.sections.reduce((s, x) => s + x.coverage, 0) / analysis.sections.length
    : 60
  const readiness = Math.round(Math.min(98, baseCoverage * 0.7 + (total > 0 ? (answered / total) * 30 : 30)))
  await dbh.db
    .update(handovers)
    .set({ readiness, updatedAt: new Date() })
    .where(eq(handovers.id, handoverId))
}

/** Generates the Human Handover Pack + Machine Context Pack. */
export async function generateHandoverPack(dbh: DbHandle, organizationId: string, handoverId: string, actorName: string) {
  const hv = await dbh.query<{ id: string; employee_id: string; role_id: string | null; readiness: number; successor_employee_id: string | null }>(
    `SELECT id, employee_id, role_id, readiness, successor_employee_id FROM handovers WHERE id = '${handoverId}' AND organization_id = '${organizationId}'`,
  )
  const handover = hv[0]
  if (!handover) throw new Error('handover introuvable')

  const emp = await dbh.query<{ first_name: string; last_name: string; role_id: string | null }>(
    `SELECT first_name, last_name, role_id FROM employees WHERE id = '${handover.employee_id}'`,
  )
  const employeeName = emp[0] ? `${emp[0].first_name} ${emp[0].last_name}` : 'Employé'
  const roleTitle = emp[0]?.role_id
    ? (await dbh.query<{ title: string }>(`SELECT title FROM roles WHERE id = '${emp[0].role_id}'`))[0]?.title
    : ''

  const byType = async (types: string[]) =>
    dbh.query<{ id: string; title: string; content: string; status: string; confidence: number; contributor: string | null }>(
      `SELECT id, title, content, status, confidence, contributor FROM memories
       WHERE employee_id = '${handover.employee_id}' AND type = ANY(${sqlAny(types)})
         AND status IN ('active','verified','candidate')
       ORDER BY importance DESC LIMIT 12`,
    )

  const [procedures, decisions, relations, projects, lessons, tasks] = await Promise.all([
    byType(['procedure']),
    byType(['decision']),
    byType(['relationship']),
    byType(['project']),
    byType(['lesson']),
    byType(['preference', 'fact']),
  ])

  const risk = await computeEmployeeRisk(dbh, organizationId, handover.employee_id)

  const humanPack = {
    employee: employeeName,
    role: roleTitle ?? '',
    readiness: handover.readiness,
    generatedAt: new Date().toISOString(),
    summary: [
      `Poste : ${roleTitle ?? '—'} — portefeuille et responsabilités transférables documentés à partir de ${procedures.length + decisions.length + relations.length} connaissances.`,
      `${procedures.length} procédure(s), ${decisions.length} décision(s) avec rationale, ${relations.length} relation(s) clé(s).`,
      risk ? `Risque résiduel : ${risk.score}/100 (${risk.level}) — ${risk.factors.map((f) => `${f.label} ${f.value} %`).join(', ')}.` : '',
    ].filter(Boolean),
    sections: [
      { key: 'responsabilites', title: 'Responsabilités', items: (risk?.stats.procedures ?? 0) > 0 ? [`Pilotage des procédures du poste (${procedures.length} documentées)`, `Relations clés : ${relations.slice(0, 3).map((r) => r.title).join(', ') || '—'}`] : ['À compléter lors de l’entretien'] },
      { key: 'procedures', title: 'Procédures', items: procedures.map((p) => `${p.title} (confiance ${p.confidence} %${p.status === 'verified' ? ', vérifiée' : ', à valider'})`) },
      { key: 'clients', title: 'Clients & relations', items: relations.map((r) => r.title) },
      { key: 'projets', title: 'Projets', items: projects.map((p) => p.title) },
      { key: 'decisions', title: 'Décisions & contexte', items: decisions.map((d) => d.title) },
      { key: 'lecons', title: 'Leçons', items: lessons.map((l) => l.title) },
      { key: 'taches', title: 'Tâches récurrentes', items: tasks.map((t) => t.title) },
      { key: 'risques', title: 'Risques résiduels', items: risk ? risk.factors.filter((f) => f.value >= 50).map((f) => `${f.label} : ${f.detail}`) : [] },
    ],
  }

  // Machine Context Pack — dense markdown an agent can ingest.
  const machineLines: string[] = [
    `# Machine Context Pack — ${employeeName} (${roleTitle ?? ''})`,
    `# Généré par Companion le ${new Date().toISOString().slice(0, 10)} — readiness ${handover.readiness} %`,
    '',
  ]
  for (const [label, list] of [
    ['PROCEDURE', procedures], ['DECISION', decisions], ['RELATIONSHIP', relations],
    ['PROJECT', projects], ['LESSON', lessons], ['TASK', tasks],
  ] as const) {
    for (const m of list) {
      machineLines.push(`## ${label}: ${m.title}`)
      machineLines.push(m.content)
      machineLines.push(`source: ${m.contributor ?? 'n/a'} | status: ${m.status} | confidence: ${m.confidence}%`)
      machineLines.push('')
    }
  }
  const machinePack = machineLines.join('\n')

  await dbh.db
    .update(handovers)
    .set({ status: 'ready', humanPack, machinePack, readiness: Math.max(handover.readiness, 90), updatedAt: new Date() })
    .where(eq(handovers.id, handoverId))

  await audit(dbh, organizationId, {
    actorName,
    actorKind: 'agent',
    action: 'handover.pack_generated',
    targetType: 'handover',
    targetId: handoverId,
    detail: { readiness: Math.max(handover.readiness, 90) },
  })

  return { humanPack, machinePack }
}

function sqlAny(values: string[]): string {
  return `ARRAY[${values.map((v) => `'${v}'`).join(',')}]::text[]`
}
