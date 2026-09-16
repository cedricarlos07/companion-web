import { Mastra } from '@mastra/core/mastra'
import { Agent } from '@mastra/core/agent'
import { LibSQLStore } from '@mastra/libsql'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { config } from '../config.js'
import { buildHandoverWorkflow, buildSalesFollowupWorkflow, buildResolveContradictionWorkflow, buildOnboardWorkflow, buildCaptureKnowledgeWorkflow } from './workflows.js'

/**
 * Instance Mastra — runtime d'orchestration agentique de Companion.
 *
 * - Mastra orchestre (agents, workflows, suspend/resume, retries).
 * - Companion conserve : permissions (policy), approvals, budgets, audit,
 *   Memory Engine, Role Brain, Knowledge Risk, Handover, Onboarding.
 * - Les tools Mastra appellent les services Companion via la policy layer,
 *   jamais la base directement.
 */

export function buildOllamaModel(chatModel: string) {
  const provider = createOpenAICompatible({
    name: 'ollama',
    baseURL: `${config.ollamaUrl}/v1`,
  })
  return provider.chatModel(chatModel)
}

export function createCompanionMastra() {
  const storage = new LibSQLStore({ id: 'companion-mastra', url: process.env.MASTRA_DB_URL ?? 'file:./data/mastra.db' })

  const knowledgeAgent = new Agent({
    id: 'knowledge-agent',
    name: 'knowledge-agent',
    instructions:
      "Tu es le Knowledge Agent de Companion. Tu analyses les nouvelles sources, détectes les contradictions et les lacunes, et proposes des mémories candidates. Tu ne marque jamais une mémoire comme vérifiée toi-même : c'est un humain qui valide. Réponds en français.",
    model: buildOllamaModel(config.llmModel),
  })

  const handoverAgent = new Agent({
    id: 'handover-agent',
    name: 'handover-agent',
    instructions:
      "Tu es le Handover Agent de Companion. Tu orches les départs : analyse de la mémoire de l'employé, comparaison avec le Role Brain, détection des lacunes, préparation des questions d'entretien. Réponds en français.",
    model: buildOllamaModel(config.llmModel),
  })

  const onboardingAgent = new Agent({
    id: 'onboarding-agent',
    name: 'onboarding-agent',
    instructions:
      'Tu es le Onboarding Agent de Companion. Tu génères des parcours J1/J7/J30 à partir du Role Brain, du Handover et des projets actifs. Réponds en français.',
    model: buildOllamaModel(config.llmModel),
  })

  const companyAssistant = new Agent({
    id: 'company-assistant',
    name: 'company-assistant',
    instructions:
      "Tu es le Company Assistant de Companion. Tu réponds aux questions sur l'entreprise avec des sources, prépares des actions (relances, réunions) mais ne les exécutes jamais sans validation humaine. Réponds en français.",
    model: buildOllamaModel(config.llmModel),
  })

  const mastra = new Mastra({
    agents: {
      knowledgeAgent,
      handoverAgent,
      onboardingAgent,
      companyAssistant,
    },
    workflows: {
      handoverEmployeeWorkflow: buildHandoverWorkflow(),
      salesFollowupWorkflow: buildSalesFollowupWorkflow(),
      resolveContradictionWorkflow: buildResolveContradictionWorkflow(),
      onboardEmployeeWorkflow: buildOnboardWorkflow(),
      captureKnowledgeWorkflow: buildCaptureKnowledgeWorkflow(),
    },
    storage,
    logger: false,
  })

  return mastra
}

let singleton: Mastra | null = null

export function getMastra(): Mastra {
  if (!singleton) singleton = createCompanionMastra()
  return singleton
}
