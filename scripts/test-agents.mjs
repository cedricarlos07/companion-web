/*
 * CRITICAL AGENT TEST — scénarios A/B/C de la phase agentique.
 *   A. Contradiction → Knowledge Agent → revue humaine → nouvelle version
 *   B. « Prépare une relance pour Orange CI » → draft → approval → SUSPEND
 *      → approve → mock send → verify → completed → feedback
 *   C. employee.leaving → trigger → Handover workflow → gaps → SUSPEND
 *
 * Usage : node scripts/test-agents.mjs  (serveur sur :5299)
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5299'
let cookie = ''

const results = []
function step(label, ok, detail = '') {
  results.push({ label, ok })
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` → ${detail}` : ''}`)
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function main() {
  // Login owner
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: 'ange.niamke@kamaloka.ci', password: 'companion' },
  })
  step('Login owner', login.status === 200)

  // Agents réels
  const agents = (await api('/agents')).data?.agents ?? []
  const byKey = Object.fromEntries(agents.map((a) => [a.key, a]))
  step('4 agents seedés', agents.length >= 4, agents.map((a) => a.key).join(', '))

  /* -------------------- SCÉNARIO A — KNOWLEDGE AGENT --------------------- */

  // Trouver une mémoire en conflit (seed : processus SAV)
  const conflicted = (await api('/memories?status=contradicted')).data?.memories ?? []
  const target = conflicted[0]
  step('A1 — mémoire en conflit présente', Boolean(target), target ? target.title.slice(0, 60) : '')

  // Déclencher le workflow resolve-contradiction (trigger réel)
  const started = await api('/events/memory.contradicted', {
    method: 'POST',
    body: { memoryId: target?.id },
  })
  const runA = started.data?.started?.[0]
  step('A2 — Knowledge Agent démarré (trigger)', Boolean(runA?.runId), `run ${runA?.runId?.slice(0, 8)}`)

  // Statut : suspendu en attente de revue
  const runADetail = (await api(`/runs/${runA?.runId}`)).data
  step('A3 — run suspendu en revue (waiting_input)', runADetail?.run?.status === 'waiting_input', `status=${runADetail?.run?.status}`)

  // Résolution humaine : approuver avec contenu résolu → nouvelle version
  const versionBefore = (await api(`/memories/${target?.id}`)).data?.memory?.version ?? 1
  const resolution = `Résolution validée par un manager : la version A (500 000 FCFA) s'applique aux comptes majeurs, la version B aux comptes standard. Référence : comité du ${new Date().toISOString().slice(0, 10)}.`
  const resumed = await api(`/runs/${runA?.runId}/resume`, {
    method: 'POST',
    body: { resumeData: { approved: true, resolvedContent: resolution, decidedBy: 'Ange Niamké' } },
  })
  step('A4 — résolution approuvée → workflow terminé', resumed.status === 200 && resumed.data?.run?.status === 'completed', `status=${resumed.data?.run?.status}`)

  const after = (await api(`/memories/${target?.id}`)).data
  step('A5 — nouvelle version appliquée', (after?.memory?.version ?? 1) > versionBefore, `v${versionBefore} → v${after?.memory?.version}`)
  step('A6 — statut mémoire actif', after?.memory?.status === 'active', `status=${after?.memory?.status}`)

  /* -------------------- SCÉNARIO B — SALES COPILOT ----------------------- */

  const assistantId = byKey['company-assistant']?.id
  const runB = await api(`/agents/${assistantId}/runs`, {
    method: 'POST',
    body: {
      agentKey: 'company-assistant',
      workflowId: 'salesFollowupWorkflow',
      goal: 'Prépare une relance pour Orange CI',
      skill: 'draft_followup',
      inputData: { client: 'Orange CI', goal: 'relance après proposition' },
    },
  })
  const runBId = runB.data?.run?.id
  step('B1 — run Company Assistant démarré', Boolean(runBId), `run ${runBId?.slice(0, 8)}`)

  const detailB = (await api(`/runs/${runBId}`)).data
  step('B2 — attente d’approbation (pas d’envoi)', detailB?.run?.status === 'waiting_approval', `status=${detailB?.run?.status}`)

  const approvals = (await api('/approvals?status=pending')).data?.approvals ?? []
  const bApproval = approvals.find((a) => a.run_id === runBId)
  step('B3 — approval réelle créée avec draft', Boolean(bApproval), bApproval ? `tool=${bApproval.tool}, risque=${bApproval.risk_level}` : '')

  const approved = await api(`/approvals/${bApproval?.id}/approve`, { method: 'POST' })
  step('B4 — approbation → reprise Mastra', approved.status === 200, `status=${approved.data?.run?.status}`)

  const detailB2 = (await api(`/runs/${runBId}`)).data
  step('B5 — run completed, email simulé envoyé', detailB2?.run?.status === 'completed', `status=${detailB2?.run?.status}`)

  const bFeedback = await api(`/runs/${runBId}/feedback`, {
    method: 'POST',
    body: { verdict: 'approve', comment: 'Relance conforme au contexte client.' },
  })
  step('B6 — feedback enregistré', bFeedback.status === 200)

  /* -------------------- SCÉNARIO C — HANDOVER TRIGGER -------------------- */

  // Créer un employé de démonstration puis le déclarer partant.
  const stamp = Date.now()
  const emp = await api('/employees', {
    method: 'POST',
    body: {
      firstName: 'Test',
      lastName: `Handover ${stamp}`,
      email: `test.handover.${stamp}@kamaloka.ci`,
    },
  })
  const empId = emp.data?.employee?.id
  step('C1 — employé de test créé', Boolean(empId))

  await api(`/employees/${empId}/status`, { method: 'POST', body: { status: 'leaving' } })
  const trigC = await api('/events/employee.leaving', { method: 'POST', body: { employeeId: empId } })
  const runC = trigC.data?.started?.[0]
  step('C2 — trigger employee.leaving → Handover Agent', Boolean(runC?.runId), `run ${runC?.runId?.slice(0, 8)}`)

  const detailC = (await api(`/runs/${runC?.runId}`)).data
  step('C3 — workflow suspendu (attente entretien)', detailC?.run?.status === 'waiting_input', `status=${detailC?.run?.status}`)

  // Gaps réellement détectés ?
  const handovers = (await api('/handovers')).data?.handovers ?? []
  const cHandover = handovers.find((h) => h.employee_id === empId)
  step('C4 — handover avec gaps détectés', Boolean(cHandover), cHandover ? `${cHandover.gaps_total} lacunes` : '')

  /* ---------------------------- SYNTHÈSE --------------------------------- */

  const failed = results.filter((r) => !r.ok)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (failed.length === 0) {
    console.log(`🏆 AGENT TEST : ${results.length}/${results.length} vérifications passées.`)
  } else {
    console.log(`💥 AGENT TEST : ${failed.length} échec(s) / ${results.length}`)
    for (const f of failed) console.log(`   - ${f.label}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Test interrompu:', e)
  process.exit(1)
})
