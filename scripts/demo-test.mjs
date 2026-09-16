/*
 * CRITICAL DEMO TEST — le scénario Moussa → Yann de bout en bout, contre l'API réelle.
 *
 *   1.  login Ange (owner)
 *   2.  rôle « Responsable Commercial » récupéré
 *   3.  créer l'employé Moussa (démo) avec ce rôle
 *   4.  importer 3 documents réels pour Moussa
 *   5.  extraction → au moins 1 memory candidate créée
 *   6.  les memories apparaissent dans Employee Memory
 *   7.  « Comment préparons-nous un appel d'offres ? » → réponse sourcée (non-abstention)
 *   8.  Moussa passe en leaving
 *   9.  lancement du handover → analyse
 *   10. détection d'au moins un knowledge gap
 *   11. réponse à une question d'interview → nouvelle memory candidate
 *   12. validation de cette memory → verified
 *   13. génération du Handover Pack (humain + machine)
 *   14. assignation de Yann comme successeur
 *   15. génération de l'onboarding de Yann (J1/J7/J30)
 *   16. Knowledge Risk calculé avec facteurs explicables
 *   17. journal d'audit peuplé
 *
 * Usage : node scripts/demo-test.mjs   (serveur lancé sur :5299)
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5299'
let cookie = ''

const results = []
function step(n, label, ok, detail = '') {
  results.push({ n, label, ok, detail })
  console.log(`${ok ? '✅' : '❌'} Étape ${String(n).padStart(2, ' ')} — ${label}${detail ? ` → ${detail}` : ''}`)
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  if (cookie) headers.cookie = cookie
  if (body) headers['content-type'] = 'application/json'
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let data = null
  try {
    data = await res.json()
  } catch {
    /* 204 etc. */
  }
  return { status: res.status, data }
}

async function main() {
  // 1. Login
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: 'ange.niamke@kamaloka.ci', password: 'companion' },
  })
  step(1, 'Connexion Ange (owner)', login.status === 200 && Boolean(login.data?.user?.id), `role=${login.data?.user?.app_role}`)

  // 2. Rôle Responsable Commercial
  const roles = await api('/roles')
  const commercialRole = (roles.data?.roles ?? []).find((r) => r.title === 'Responsable Commercial')
  step(2, 'Rôle Responsable Commercial trouvé', Boolean(commercialRole), commercialRole ? `memories=${commercialRole.memories}` : '')

  // 3. Créer Moussa (démo) avec ce rôle
  const stamp = Date.now()
  const roleId = commercialRole?.id
  const created = await api('/employees', {
    method: 'POST',
    body: {
      firstName: 'Moussa',
      lastName: `Koné Démo ${stamp}`,
      email: `moussa.demo.${stamp}@kamaloka.ci`,
      roleId,
    },
  })
  const moussaId = created.data?.employee?.id
  step(3, 'Employé Moussa créé avec le rôle Responsable Commercial', Boolean(moussaId), moussaId ? moussaId.slice(0, 8) : JSON.stringify(created.data))

  // 4. Importer 3 documents réels
  const fs = await import('node:fs')
  const path = await import('node:path')
  const docsDir = path.join(process.cwd(), 'scripts', 'demo-docs')
  const form = new FormData()
  for (const f of ['procedure-appel-offres.txt', 'compte-rendu-commercial.txt', 'notes-clients-contrats.txt']) {
    form.append('files', new Blob([fs.readFileSync(path.join(docsDir, f))]), f)
  }
  form.append('employeeId', moussaId)
  form.append('sourceName', 'Dossier de démonstration Moussa')
  const upload = await api('/sources/upload', { method: 'POST', form })
  const uploadResults = upload.data?.results ?? []
  const totalCreated = uploadResults.reduce((s, r) => s + (r.memoriesCreated ?? 0), 0)
  const totalChunks = uploadResults.reduce((s, r) => s + (r.chunksIndexed ?? 0), 0)
  const engine = uploadResults[0]?.engine
  step(4, 'Import de 3 documents', upload.status === 200 && uploadResults.length === 3, `${totalChunks} chunks, moteur=${engine}`)

  // 5. Extraction → memories créées (ou confirmées en cas de ré-import : déduplication)
  const totalConfirmed = uploadResults.reduce((s, r) => s + (r.confirmations ?? 0), 0)
  step(5, 'Memories extraites ou confirmées', totalCreated + totalConfirmed >= 1, `${totalCreated} créée(s), ${totalConfirmed} confirmation(s)`)

  // 6. Employee Memory : visible sur /employees/:id
  const empDetail = await api(`/employees/${moussaId}`)
  const memCount = Number(empDetail.data?.employee?.memories ?? 0)
  step(6, 'Employee Memory peuplée', memCount >= totalCreated, `${memCount} connaissances sur le profil`)

  // 7. Ask Companion — question du milestone
  const ask = await api('/ask', {
    method: 'POST',
    body: { question: "Comment préparons-nous un appel d'offres ?" },
  })
  const abstained = Boolean(ask.data?.abstained)
  const citations = ask.data?.citations?.length ?? 0
  step(7, 'Ask Companion répond avec sources', ask.status === 200 && !abstained && citations > 0, `citations=${citations}, confiance=${ask.data?.confidence} %, moteur=${ask.data?.engine}`)
  console.log(`   ↳ extrait : « ${(ask.data?.answer ?? '').slice(0, 140)}… »`)

  // 8. Moussa partant
  const leaving = await api(`/employees/${moussaId}/status`, { method: 'POST', body: { status: 'leaving' } })
  step(8, 'Moussa déclaré partant', leaving.status === 200 && leaving.data?.ok === true)

  // 9-10. Lancer le handover → gaps détectés
  const handover = await api('/handovers', { method: 'POST', body: { employeeId: moussaId } })
  const handoverId = handover.data?.handover?.id
  const gapCount = handover.data?.gaps ?? 0
  step(9, 'Handover lancé (analyse)', Boolean(handoverId), `readiness initiale=${handover.data?.handover?.readiness} %`)
  step(10, 'Knowledge gaps détectés', gapCount >= 1, `${gapCount} gap(s)`)

  // 11. Répondre à une question d'interview
  const detail = await api(`/handovers/${handoverId}`)
  const firstOpenGap = (detail.data?.gaps ?? []).find((g) => g.status === 'open')
  // Réponse unique par exécution : la déduplication doit lier la mémoire à CE Moussa, pas à un import précédent.
  const answerText =
    `Pour chaque appel d'offres (référence ${stamp}) : 1) vérifier le périmètre et le montant ; 2) rassembler l'attestation fiscale de moins de 3 mois, les attestations bancaires et les références signées ; 3) obtenir le cautionnement de 2 % auprès de la banque ; 4) faire valider la marge par Ibrahim Diallo sous 48 heures ouvrées ; 5) déposer uniquement via la plateforme dématérialisée de l'acheteur et archiver l'accusé de dépôt.`
  const answered = await api(`/handovers/${handoverId}/answers`, {
    method: 'POST',
    body: { gapId: firstOpenGap?.id, answerText },
  })
  const producedMemoryId = answered.data?.memory?.id
  step(11, 'Réponse interview → memory candidate', Boolean(producedMemoryId), producedMemoryId ? `memory ${producedMemoryId.slice(0, 8)}` : JSON.stringify(answered.data)?.slice(0, 120))

  // 12. Valider la memory produite
  const verified = await api(`/memories/${producedMemoryId}/verify`, { method: 'POST' })
  step(12, 'Memory validée (verified)', verified.status === 200 && verified.data?.memory?.status === 'verified', `statut=${verified.data?.memory?.status}`)

  // 13. Générer le Handover Pack
  const pack = await api(`/handovers/${handoverId}/pack`, { method: 'POST' })
  const packSections = pack.data?.humanPack?.sections?.length ?? 0
  const machineLen = (pack.data?.machinePack ?? '').length
  step(13, 'Handover Pack généré (humain + machine)', packSections > 0 && machineLen > 200, `${packSections} sections, machine pack ${machineLen} caractères`)

  // 14. Assigner Yann
  const employees = await api('/employees')
  const yann = (employees.data?.employees ?? []).find((e) => e.first_name === 'Yann' && e.last_name === 'Kouamé')
  step(14, 'Yann Kouamé trouvé', Boolean(yann), yann ? yann.id.slice(0, 8) : '')
  const assigned = await api(`/handovers/${handoverId}/successor`, { method: 'POST', body: { employeeId: yann?.id } })
  step(14.1, 'Yann assigné successeur', assigned.status === 200)

  // 15. Onboarding de Yann
  const onboarding = await api('/onboardings', {
    method: 'POST',
    body: { employeeId: yann?.id, handoverId },
  })
  const plan = onboarding.data?.onboarding?.plan ?? {}
  const phases = [...new Set((plan.sections ?? []).map((s) => s.phase))]
  step(15, 'Onboarding de Yann généré', Boolean(onboarding.data?.onboarding?.id) && plan.sections?.length > 0, `readiness=${plan.readiness} %, ${plan.sections?.length} sections, phases=${phases.join('/')}`)

  // 16. Knowledge Risk explicable
  const risk = await api('/knowledge-risk')
  const top = risk.data?.employees?.[0]
  step(16, 'Knowledge Risk avec facteurs', Boolean(risk.data?.overall !== undefined) && Boolean(top?.factors?.length), `global=${risk.data?.overall} (${risk.data?.level}), top=${top?.subjectName} ${top?.score} % avec ${top?.factors?.length} facteurs`)

  // 17. Audit
  const auditLog = await api('/audit')
  const actions = [...new Set((auditLog.data?.events ?? []).map((e) => e.action))]
  step(17, "Journal d'audit peuplé", (auditLog.data?.events?.length ?? 0) >= 5, `${auditLog.data?.events?.length} événements : ${actions.slice(0, 6).join(', ')}`)

  // ---- verdict ----
  const failed = results.filter((r) => !r.ok)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (failed.length === 0) {
    console.log(`🏆 CRITICAL DEMO TEST : ${results.length}/${results.length} étapes passées. Companion est réel.`)
  } else {
    console.log(`💥 CRITICAL DEMO TEST : ${failed.length} échec(s) sur ${results.length} étapes.`)
    for (const f of failed) console.log(`   - étape ${f.n}: ${f.label} ${f.detail}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Test interrompu:', err)
  process.exit(1)
})
