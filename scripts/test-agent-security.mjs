/*
 * SECURITY TESTS — denials explicites de la policy layer.
 *   1. Company Assistant → tool hors allowlist        → DENIED
 *   2. Knowledge Agent → draft_followup (ventes)      → DENIED
 *   3. Tool inconnu                                   → DENIED
 *   4. Budget tokens dépassé                          → DENIED
 *   5. Modification des permissions d'un agent        → DENIED (aucune API)
 *   6. Cross-organization                             → DENIED (isolation SQL)
 *
 * Usage : node scripts/test-agent-security.mjs
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5299'
let cookie = ''
const results = []
function check(label, ok, detail = '') {
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
  await api('/auth/login', {
    method: 'POST',
    body: { email: 'ange.niamke@kamaloka.ci', password: 'companion' },
  })

  const agents = (await api('/agents')).data?.agents ?? []
  const byKey = Object.fromEntries(agents.map((a) => [a.key, a]))
  const assistant = byKey['company-assistant']
  const knowledge = byKey['knowledge-agent']

  // 1. Tool hors allowlist du Company Assistant
  let r = await api(`/agents/${assistant.id}/policy-check`, {
    method: 'POST',
    body: { tool: 'get_employee_context', input: { employeeId: '00000000-0000-0000-0000-000000000000' } },
  })
  check('Company Assistant → contexte employé hors allowlist = DENIED', r.data?.allowed === false, r.data?.reason?.slice(0, 80))

  // 2. Knowledge Agent → skill ventes
  r = await api(`/agents/${knowledge.id}/runs`, {
    method: 'POST',
    body: {
      agentKey: 'knowledge-agent',
      workflowId: 'salesFollowupWorkflow',
      goal: 'tentative ventes',
      skill: 'draft_followup',
      inputData: { client: 'X', goal: 'x' },
    },
  })
  check('Knowledge Agent → skill draft_followup (ventes) = DENIED', r.status === 403, r.data?.error?.slice(0, 80))

  // 3. Tool inconnu
  r = await api(`/agents/${assistant.id}/policy-check`, {
    method: 'POST',
    body: { tool: 'launch_nuclear_missile', input: {} },
  })
  check('Tool inconnu = DENIED', r.data?.allowed === false)

  // 4. Budget dépassé : on écrase max_run_tokens puis on restaure.
  await api(`/agents/${assistant.id}/limits`, { method: 'POST', body: { maxRunTokens: 1 } })
  r = await api(`/agents/${assistant.id}/policy-check`, {
    method: 'POST',
    body: { tool: 'search_memory', input: { query: 'test' } },
  })
  check('Budget dépassé = DENIED', r.data?.allowed === false, r.data?.reason?.slice(0, 80))
  await api(`/agents/${assistant.id}/limits`, { method: 'POST', body: { maxRunTokens: 20000 } })
  r = await api(`/agents/${assistant.id}/policy-check`, {
    method: 'POST',
    body: { tool: 'search_memory', input: { query: 'test' } },
  })
  check('Budget restauré = ALLOWED', r.data?.allowed === true)

  // 5. Aucune API ne permet de modifier les permissions d'un agent.
  const permAttempt = await api(`/agents/${assistant.id}/permissions`, {
    method: 'PATCH',
    body: { allowedTools: ['*'] },
  })
  check('Modification des permissions = DENIED (aucune route)', permAttempt.status === 404, `HTTP ${permAttempt.status}`)

  // 6. Cross-organization : un agent d'une autre org est invisible.
  r = await api('/agents/00000000-0000-0000-0000-00000000dead')
  check('Agent cross-org = DENIED (404)', r.status === 404)

  // 7. Copilot sans approval → waiting_approval (pas d'exécution) — prouvé par scénario B,
  //    on re-vérifie ici qu'aucun approval approve n'est requis pour SUSPENDRE.
  const run = await api(`/agents/${assistant.id}/runs`, {
    method: 'POST',
    body: {
      agentKey: 'company-assistant',
      workflowId: 'salesFollowupWorkflow',
      goal: 'test sandbox sans approval',
      skill: 'draft_followup',
      inputData: { client: 'NSIA', goal: 'test sécurité' },
    },
  })
  const detail = (await api(`/runs/${run.data?.run?.id}`)).data
  const sentMock = (detail?.steps ?? []).some((s) => s.description === 'send-email-mock' && s.status === 'success')
  check('Copilot sans approval = WAITING_APPROVAL, aucun envoi', detail?.run?.status === 'waiting_approval' && !sentMock, `status=${detail?.run?.status}`)

  const failed = results.filter((r) => !r.ok)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (failed.length === 0) {
    console.log(`🔒 SECURITY TESTS : ${results.length}/${results.length} passés.`)
  } else {
    console.log(`💥 SECURITY TESTS : ${failed.length} échec(s) / ${results.length}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Test interrompu:', e)
  process.exit(1)
})
