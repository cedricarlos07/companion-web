import { z } from 'zod'
import { createStep, createWorkflow } from '@mastra/core/workflows'
import { getRunContext } from './run-context.js'
import { authorizeToolCall, recordToolCall } from './policy.js'

/**
 * Workflows Mastra réels — chaque step exécute les tools Companion
 * policy-gated. suspend/resume porte l'attente humaine :
 *   - attente des réponses d'entretien + validation (handover)
 *   - approbation d'envoi (sales follow-up, send_email = MOCK)
 *   - revue de résolution de contradiction
 *
 * Sémantique Mastra : quand un step appelle suspend(), il est RE-EXÉCUTÉ au
 * resume avec `resumeData` dans son contexte — la décision humaine y arrive.
 */

const runIdSchema = z.object({ runId: z.string() })

const toolCtxOf = (runId: string) => getRunContext(runId)

async function authorize(runId: string, tool: string, input: Record<string, unknown>) {
  const ctx = getRunContext(runId)
  await authorizeToolCall(
    { dbh: ctx.dbh, organizationId: ctx.organizationId, agentId: ctx.agentId, runId, initiatorName: ctx.initiatorName },
    tool,
    input,
  )
}

async function record(runId: string, tool: string, input: Record<string, unknown>, output: unknown) {
  const ctx = getRunContext(runId)
  await recordToolCall(ctx, tool, input, output as Record<string, unknown>)
}

/* ------------------------------ HANDOVER ---------------------------------- */

export function buildHandoverWorkflow() {
  const fetchEmployee = createStep({
    id: 'fetch-employee',
    inputSchema: runIdSchema.extend({ employeeId: z.string() }),
    outputSchema: runIdSchema.extend({ employeeId: z.string(), name: z.string(), memoryCount: z.number() }),
    execute: async ({ inputData }) => {
      const { getEmployeeContextTool } = await import('./tools.js')
      await authorize(inputData.runId, 'get_employee_context', { employeeId: inputData.employeeId })
      const out = await getEmployeeContextTool.execute(toolCtxOf(inputData.runId), { employeeId: inputData.employeeId })
      await record(inputData.runId, 'get_employee_context', { employeeId: inputData.employeeId }, out as never)
      const ctx = getRunContext(inputData.runId)
      const count = await ctx.dbh.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM memories WHERE employee_id = '${inputData.employeeId}'`,
      )
      return {
        runId: inputData.runId,
        employeeId: inputData.employeeId,
        name: out.name,
        memoryCount: Number(count[0]?.cnt ?? 0),
      }
    },
  })

  const analyzeGaps = createStep({
    id: 'analyze-gaps',
    inputSchema: runIdSchema.extend({ employeeId: z.string(), name: z.string(), memoryCount: z.number() }),
    outputSchema: runIdSchema.extend({ handoverId: z.string(), gaps: z.number(), questions: z.array(z.string()) }),
    resumeSchema: z.object({ interviewDone: z.boolean(), handoverId: z.string() }),
    suspendSchema: z.object({ reason: z.string(), handoverId: z.string(), questions: z.array(z.string()) }),
    execute: async ({ inputData, runId: mastraRunId, suspend, resumeData }) => {
      const ctx = getRunContext(inputData.runId)
      let handoverId = resumeData?.handoverId ?? ''

      if (!resumeData?.interviewDone) {
        const { createHandoverTool } = await import('./tools.js')
        await authorize(inputData.runId, 'create_handover', { employeeId: inputData.employeeId })
        const out = await createHandoverTool.execute(toolCtxOf(inputData.runId), { employeeId: inputData.employeeId })
        await record(inputData.runId, 'create_handover', { employeeId: inputData.employeeId }, out as never)
        handoverId = out.handoverId
        const gaps = await ctx.dbh.query<{ question: string }>(
          `SELECT question FROM handover_gaps WHERE handover_id = '${handoverId}' ORDER BY created_at`,
        )
        // SUSPEND : attente des réponses d'entretien de l'employé (HITL).
        await suspend({ reason: 'waiting_interview', handoverId, questions: gaps.map((g) => g.question) })
      }

      const gaps = await ctx.dbh.query<{ id: string; question: string; status: string }>(
        `SELECT id, question, status FROM handover_gaps WHERE handover_id = '${handoverId}' ORDER BY created_at`,
      )
      return {
        runId: inputData.runId,
        handoverId,
        gaps: gaps.filter((g) => g.status === 'open').length,
        questions: gaps.map((g) => g.question),
      }
    },
  })

  const buildPack = createStep({
    id: 'build-pack',
    inputSchema: runIdSchema.extend({ handoverId: z.string(), gaps: z.number(), questions: z.array(z.string()) }),
    outputSchema: runIdSchema.extend({ handoverId: z.string(), readiness: z.number() }),
    resumeSchema: z.object({ validated: z.boolean(), decidedBy: z.string().optional() }),
    suspendSchema: z.object({ reason: z.string(), handoverId: z.string() }),
    execute: async ({ inputData, suspend, resumeData }) => {
      const ctx = getRunContext(inputData.runId)
      if (!resumeData?.validated) {
        // SUSPEND : validation du manager avant génération du pack final.
        await suspend({ reason: 'waiting_validation', handoverId: inputData.handoverId })
      }
      const { generateHandoverPack } = await import('../services/handover.js')
      const pack = await generateHandoverPack(ctx.dbh, ctx.organizationId, inputData.handoverId, ctx.initiatorName ?? 'Handover Agent')
      const readiness = (pack.humanPack as { readiness?: number })?.readiness ?? 94
      return { runId: inputData.runId, handoverId: inputData.handoverId, readiness }
    },
  })

  return createWorkflow({
    id: 'handover-employee-workflow',
    inputSchema: runIdSchema.extend({ employeeId: z.string() }),
    outputSchema: runIdSchema.extend({ handoverId: z.string(), readiness: z.number() }),
    steps: [fetchEmployee, analyzeGaps, buildPack],
  })
    .then(fetchEmployee)
    .then(analyzeGaps)
    .then(buildPack)
    .commit()
}

/* --------------------------- SALES FOLLOW-UP ------------------------------- */

export function buildSalesFollowupWorkflow() {
  const gatherContext = createStep({
    id: 'gather-context',
    inputSchema: runIdSchema.extend({ client: z.string(), goal: z.string() }),
    outputSchema: runIdSchema.extend({ client: z.string(), goal: z.string(), citations: z.array(z.string()) }),
    execute: async ({ inputData }) => {
      const { searchMemoryTool } = await import('./tools.js')
      await authorize(inputData.runId, 'search_memory', { query: inputData.client })
      const out = await searchMemoryTool.execute(toolCtxOf(inputData.runId), {
        query: `client ${inputData.client} contexte engagements`,
        topK: 6,
      })
      await record(inputData.runId, 'search_memory', { client: inputData.client }, out as never)
      return { runId: inputData.runId, client: inputData.client, goal: inputData.goal, citations: out.results.map((r) => `${r.title} (${r.type})`) }
    },
  })

  const draftFollowup = createStep({
    id: 'draft-followup',
    inputSchema: runIdSchema.extend({ client: z.string(), goal: z.string(), citations: z.array(z.string()) }),
    outputSchema: runIdSchema.extend({ draft: z.string(), approvalId: z.string(), approved: z.boolean(), decidedBy: z.string().optional() }),
    resumeSchema: z.object({ approved: z.boolean(), decidedBy: z.string().optional() }),
    suspendSchema: z.object({ reason: z.string(), approvalId: z.string(), draft: z.string(), client: z.string(), citations: z.array(z.string()) }),
    execute: async ({ inputData, suspend, resumeData, suspendData }) => {
      if (resumeData) {
        // Reprise après décision humaine — le draft est dans suspendData.
        return {
          runId: inputData.runId,
          draft: (suspendData as { draft?: string } | undefined)?.draft ?? '',
          approvalId: (suspendData as { approvalId?: string } | undefined)?.approvalId ?? '',
          approved: resumeData.approved ?? false,
          decidedBy: resumeData.decidedBy,
        }
      }
      const ctx = getRunContext(inputData.runId)
      const { requestApprovalTool } = await import('./tools.js')
      await authorize(inputData.runId, 'request_approval', { tool: 'send_email' })
      const draft = `Bonjour,\n\nSuite à nos échanges concernant ${inputData.client}, nous restons à votre disposition pour planifier un point cette semaine.\n\nSources : ${inputData.citations.join(', ') || 'mémoire commerciale'}\n\nCordialement,\nL'équipe commerciale Kamaloka`
      const approval = await requestApprovalTool.execute(toolCtxOf(inputData.runId), {
        action: `Envoyer la relance préparée pour ${inputData.client}`,
        tool: 'send_email',
        riskLevel: 'high',
        reason: `Draft préparé par le Company Assistant à partir de ${inputData.citations.length} sources. Envoi simulé (sandbox) après approbation.`,
        preview: {
          to: `contact@${inputData.client.toLowerCase().replace(/[^a-z]/g, '')}.ci`,
          subject: `Suivi — ${inputData.client}`,
          body: draft,
          citations: inputData.citations,
        },
      })
      // SUSPEND : l'email ne part PAS sans approbation (HITL).
      await suspend({
        reason: 'waiting_approval',
        approvalId: approval.approvalId,
        draft,
        client: inputData.client,
        citations: inputData.citations,
      })
      return { runId: inputData.runId, draft: '', approvalId: approval.approvalId, approved: false }
    },
  })

  const sendMock = createStep({
    id: 'send-email-mock',
    inputSchema: runIdSchema.extend({
      draft: z.string(),
      approvalId: z.string(),
      approved: z.boolean(),
      decidedBy: z.string().optional(),
    }),
    outputSchema: runIdSchema.extend({ draft: z.string(), sent: z.boolean() }),
    execute: async ({ inputData }) => {
      if (!inputData.approved) {
        throw new Error(`envoi refusé par ${inputData.decidedBy ?? 'un décideur'} — terminaison propre, aucun email envoyé`)
      }
      // send_email : réel via Activepieces si configuré, sinon mock sandbox.
      const ap = await import('../activepieces/provider.js')
      if (ap.isActivepiecesEnabled()) {
        const ctx = getRunContext(inputData.runId)
        const { authorizeExternalTool } = await import('../activepieces/provider.js')
        await authorizeExternalTool(ctx.dbh, ctx.organizationId, 'copilot', 'gmail.send_email', ctx.initiatorName ?? 'agent', inputData.approvalId)
        const result = await ap.executeExternalTool(ctx.dbh, ctx.organizationId, 'gmail.send_email', {
          to: 'contact@kamaloka.ci',
          subject: 'Suivi client',
          body: inputData.draft,
        }, inputData.runId, ctx.initiatorName ?? 'agent')
        await record(inputData.runId, 'send_email_activepieces', { via: 'activepieces' }, { sent: true })
        return { runId: inputData.runId, draft: inputData.draft, sent: true }
      }
      // Mock sandbox — pas de vraie connexion.
      await record(inputData.runId, 'send_email_mock', { approvalId: inputData.approvalId }, { sent: true, sandbox: true })
      return { runId: inputData.runId, draft: inputData.draft, sent: true }
    },
  })

  return createWorkflow({
    id: 'sales-followup-workflow',
    inputSchema: runIdSchema.extend({ client: z.string(), goal: z.string() }),
    outputSchema: runIdSchema.extend({ draft: z.string(), sent: z.boolean() }),
    steps: [gatherContext, draftFollowup, sendMock],
  })
    .then(gatherContext)
    .then(draftFollowup)
    .then(sendMock)
    .commit()
}

/* ------------------------- RESOLVE CONTRADICTION --------------------------- */

export function buildResolveContradictionWorkflow() {
  const loadEvidence = createStep({
    id: 'load-evidence',
    inputSchema: runIdSchema.extend({ memoryId: z.string() }),
    outputSchema: runIdSchema.extend({ memoryId: z.string(), title: z.string(), version: z.number() }),
    execute: async ({ inputData }) => {
      const ctx = getRunContext(inputData.runId)
      const rows = await ctx.dbh.query<{ id: string; title: string; version: number }>(
        `SELECT id, title, version FROM memories WHERE id = '${inputData.memoryId}'`,
      )
      return {
        runId: inputData.runId,
        memoryId: rows[0]?.id ?? inputData.memoryId,
        title: rows[0]?.title ?? '',
        version: rows[0]?.version ?? 1,
      }
    },
  })

  const awaitReview = createStep({
    id: 'await-review',
    inputSchema: runIdSchema.extend({ memoryId: z.string(), title: z.string(), version: z.number() }),
    outputSchema: runIdSchema.extend({ memoryId: z.string(), resolution: z.string(), approved: z.boolean(), decidedBy: z.string().optional() }),
    resumeSchema: z.object({ approved: z.boolean(), resolvedContent: z.string().optional(), decidedBy: z.string().optional() }),
    suspendSchema: z.object({ reason: z.string(), memoryId: z.string() }),
    execute: async ({ inputData, suspend, resumeData }) => {
      if (resumeData) {
        return {
          runId: inputData.runId,
          memoryId: inputData.memoryId,
          resolution: resumeData.resolvedContent ?? inputData.title,
          approved: resumeData.approved ?? false,
          decidedBy: resumeData.decidedBy,
        }
      }
      await suspend({ reason: 'waiting_review', memoryId: inputData.memoryId })
      return { runId: inputData.runId, memoryId: inputData.memoryId, resolution: '', approved: false }
    },
  })

  const applyResolution = createStep({
    id: 'apply-resolution',
    inputSchema: runIdSchema.extend({ memoryId: z.string(), resolution: z.string(), approved: z.boolean(), decidedBy: z.string().optional() }),
    outputSchema: runIdSchema.extend({ memoryId: z.string(), newVersion: z.number() }),
    execute: async ({ inputData }) => {
      if (!inputData.approved) throw new Error('résolution rejetée — les deux versions restent en revue')
      const ctx = getRunContext(inputData.runId)
      const { updateMemory } = await import('../services/memory.js')
      const updated = (await updateMemory(
        ctx.dbh,
        inputData.memoryId,
        { status: 'active', content: inputData.resolution },
        inputData.decidedBy ?? 'manager',
        'résolution de contradiction validée par un humain',
      )) as { version?: number } | null
      return { runId: inputData.runId, memoryId: inputData.memoryId, newVersion: updated?.version ?? 0 }
    },
  })

  return createWorkflow({
    id: 'resolve-contradiction-workflow',
    inputSchema: runIdSchema.extend({ memoryId: z.string() }),
    outputSchema: runIdSchema.extend({ memoryId: z.string(), newVersion: z.number() }),
    steps: [loadEvidence, awaitReview, applyResolution],
  })
    .then(loadEvidence)
    .then(awaitReview)
    .then(applyResolution)
    .commit()
}

/* ------------------------------ ONBOARDING --------------------------------- */

export function buildOnboardWorkflow() {
  const generate = createStep({
    id: 'generate-onboarding',
    inputSchema: runIdSchema.extend({ employeeId: z.string(), handoverId: z.string().optional() }),
    outputSchema: runIdSchema.extend({ onboardingId: z.string(), sections: z.number() }),
    execute: async ({ inputData }) => {
      const { createOnboardingTool } = await import('./tools.js')
      await authorize(inputData.runId, 'create_onboarding', { employeeId: inputData.employeeId })
      const out = await createOnboardingTool.execute(toolCtxOf(inputData.runId), {
        employeeId: inputData.employeeId,
        handoverId: inputData.handoverId,
      })
      await record(inputData.runId, 'create_onboarding', { employeeId: inputData.employeeId }, out as never)
      return { runId: inputData.runId, onboardingId: out.onboardingId, sections: out.sections }
    },
  })

  return createWorkflow({
    id: 'onboard-employee-workflow',
    inputSchema: runIdSchema.extend({ employeeId: z.string(), handoverId: z.string().optional() }),
    outputSchema: runIdSchema.extend({ onboardingId: z.string(), sections: z.number() }),
    steps: [generate],
  })
    .then(generate)
    .commit()
}

/* --------------------------- CAPTURE KNOWLEDGE ----------------------------- */

export function buildCaptureKnowledgeWorkflow() {
  const verifyExtraction = createStep({
    id: 'verify-extraction',
    inputSchema: runIdSchema.extend({ documentId: z.string().optional() }),
    outputSchema: runIdSchema.extend({ analyzed: z.boolean(), documents: z.number() }),
    execute: async ({ inputData }) => {
      if (!inputData.documentId) return { runId: inputData.runId, analyzed: false, documents: 0 }
      const ctx = getRunContext(inputData.runId)
      const rows = await ctx.dbh.query<{ status: string; count: string }>(
        `SELECT (SELECT status FROM documents WHERE id = '${inputData.documentId}') AS status,
                (SELECT count(*) FROM memories m JOIN memory_sources ms ON ms.memory_id = m.id WHERE ms.document_id = '${inputData.documentId}')::text AS count`,
      )
      return { runId: inputData.runId, analyzed: rows[0]?.status === 'done', documents: Number(rows[0]?.count ?? 0) }
    },
  })

  return createWorkflow({
    id: 'capture-knowledge-workflow',
    inputSchema: runIdSchema.extend({ documentId: z.string().optional() }),
    outputSchema: runIdSchema.extend({ analyzed: z.boolean(), documents: z.number() }),
    steps: [verifyExtraction],
  })
    .then(verifyExtraction)
    .commit()
}
