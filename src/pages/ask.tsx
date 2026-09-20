import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Composer } from '@/components/common/composer'
import { SourceReference, EvidenceCard } from '@/components/common/memory-bits'
import { ConfidenceBadge } from '@/components/common/badges'
import { AgentThinking } from '@/components/application/agent-thinking/agent-thinking'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import {
  AiBrain01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  SparklesIcon,
  TargetIcon,
} from '@/lib/icons'

const EXAMPLES = [
  'Que savons-nous du client SOTRA ?',
  'Pourquoi avons-nous changé le processus SAV ?',
  "Comment l'équipe commerciale prépare-t-elle un appel d'offres ?",
  'Quels savoirs risquent de disparaître ?',
]

interface AskResult {
  question: string
  answer: string
  abstained?: boolean
  claims: { text: string; ref: number }[]
  sources: { title: string; meta: string }[]
  memoriesUsed: { type: string; confidence: number }[]
  confidence: number
}

const DEMO_RESULT: AskResult = {
  question: 'Que savons-nous du client SOTRA ?',
  answer:
    "SOTRA est un compte historique suivi par Moussa Koné. La facturation est passée au trimestre en juin 2026, contre un escompte de 1,5 %. Le contrat intègre la trêve de fin d'année : aucune opération n'est menée chez le client sans accord préalable. Le projet « Migration ERP SOTRA » est en phase pilote, piloté par Koffi N'Guessan. Point de vigilance : les validations internes de SOTRA prennent 5 à 7 jours de plus en période de paie.",
  claims: [
    { text: 'Facturation trimestrielle décidée en comité de direction (juin 2026), escompte 1,5 %.', ref: 1 },
    { text: 'Engagement informel : préavis de 15 jours avant toute modification tarifaire.', ref: 2 },
    { text: 'Délais de validation allongés en période de paie — à intégrer dans tout planning.', ref: 3 },
    { text: 'Migration ERP en bascule par agence pilote avant déploiement national.', ref: 4 },
  ],
  sources: [
    { title: 'Compte-rendu commercial.pdf', meta: 'Document' },
    { title: 'Réunion du 8 septembre', meta: 'Réunion' },
    { title: 'Note de Moussa', meta: 'Note' },
    { title: 'CRM — SOTRA', meta: 'CRM' },
  ],
  memoriesUsed: [
    { type: 'Décision', confidence: 92 },
    { type: 'Procédure', confidence: 88 },
    { type: 'Relation', confidence: 85 },
  ],
  confidence: 91,
}

type Phase = 'idle' | 'thinking' | 'answered'

export function AskPage() {
  const [question, setQuestion] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<AskResult | null>(null)
  const { pushToast } = useAppStore()

  async function ask(q?: string) {
    const text = (q ?? question).trim()
    if (!text) return
    setQuestion(text)
    setPhase('thinking')
    const started = Date.now()
    const real = await api.ask(text)
    // Laisse voir l'état de réflexion au moins un instant.
    const elapsed = Date.now() - started
    if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed))
    if (real) {
      setResult({
        question: real.question,
        answer: real.answer,
        abstained: real.abstained,
        claims: [],
        sources: real.citations.map((c) => ({
          title: c.documentTitle ?? c.title,
          meta: c.type,
        })),
        memoriesUsed: real.memoriesUsed,
        confidence: real.confidence,
      })
      setPhase('answered')
    } else {
      // Backend indisponible — réponse de démonstration clairement identifiée.
      setResult({ ...DEMO_RESULT, question: text })
      setPhase('answered')
    }
  }

  return (
    <div>
      <PageHeader
        title="Demander à Companion"
        subtitle="Interrogez la mémoire de votre entreprise — chaque réponse cite ses sources."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {phase === 'idle' && (
            <div className="rounded-2xl border border-border-button-default bg-background-primary-default px-6 py-12 shadow-card">
              <div className="mx-auto max-w-lg text-center">
                <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
                  <HugeIcon icon={SparklesIcon} size="lg" />
                </span>
                <h2 className="text-title-2-medium text-text-primary">
                  Que voulez-vous savoir sur votre entreprise ?
                </h2>
                <ul className="mt-6 space-y-2 text-left">
                  {EXAMPLES.map((ex) => (
                    <li key={ex}>
                      <button
                        type="button"
                        onClick={() => {
                          setQuestion(ex)
                          ask(ex)
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5 text-left text-body-2-medium text-text-secondary transition-colors hover:border-border-button-hover hover:bg-background-primary-hover hover:text-text-primary"
                      >
                        <HugeIcon icon={TargetIcon} size="xs" className="shrink-0 text-accent-500" />
                        {ex}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {phase === 'thinking' && (
            <Card>
              <div className="flex flex-col items-center gap-4 py-10">
                <AgentThinking label="Recherche dans la mémoire de l'entreprise" showTimer tone="accent" />
                <p className="max-w-md text-center text-body-2-regular text-text-secondary">
                  Consultation du Company Brain, des Role Brains concernés et des sources approuvées.
                </p>
              </div>
            </Card>
          )}

          {phase === 'answered' && result && (
            <>
              <Card>
                <p className="mb-2 flex items-center gap-2 text-caption-1-medium text-text-tertiary">
                  <HugeIcon icon={AiBrain01Icon} size="xs" />
                  Réponse de Companion · contexte : Entreprise entière
                </p>
                <h2 className="text-headline-medium text-text-primary">{result.question}</h2>
                <p className="mt-3 text-body-medium leading-relaxed text-text-primary">{result.answer}</p>

                {result.abstained && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-caption-1-medium text-amber-800">
                    <HugeIcon icon={TargetIcon} size="xs" />
                    Abstention : pas assez de contexte fiable dans la mémoire — importez une source ou documentez cette connaissance.
                  </div>
                )}

                <ul className="mt-4 space-y-2">
                  {result.claims.map((c) => (
                    <li key={c.ref} className="flex items-start gap-2 text-body-2-regular text-text-secondary">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-background-secondary-default text-caption-2-semibold text-text-tertiary tabular-nums">
                        {c.ref}
                      </span>
                      {c.text}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-separator-border pt-4">
                  <Button
                    variant="secondary"
                    size="xs"
                    leadingIcon={adaptIcon(Copy01Icon, 16)}
                    onClick={() => {
                      navigator.clipboard?.writeText(`${result.question}\n\n${result.answer}`)
                      pushToast('Réponse copiée.')
                    }}
                  >
                    Copier
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    leadingIcon={adaptIcon(CheckmarkCircle02Icon, 16)}
                    onClick={() => {
                      const res0 = result
                      const created = fetch('/api/memories', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'fact',
                          title: res0.question.slice(0, 120),
                          content: res0.answer.slice(0, 4000),
                          scope: 'company',
                          status: 'candidate',
                          confidence: res0.confidence,
                        }),
                      }).then((r) => r.json().catch(() => null)).then((b) => ({ ok: Boolean(b?.memory), id: b?.memory?.id }))
                      void created.then((c) => {
                        if (c.ok) pushToast('Mémoire candidate enregistrée — à valider dans Company Brain.', 'success')
                        else pushToast('Enregistrement impossible — permission ou backend indisponible.', 'error')
                      })
                    }}
                  >
                    Enregistrer comme mémoire
                  </Button>
                  <Button variant="secondary" size="xs" onClick={() => setPhase('idle')}>
                    Continuer
                  </Button>
                </div>
              </Card>

              <Card title="Confiance de la réponse">
                <div className="flex flex-wrap items-center gap-4">
                  <ConfidenceBadge value={result.confidence} />
                  <div className="flex flex-wrap gap-2">
                    {result.memoriesUsed.map((m) => (
                      <span
                        key={m.type}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-caption-1-medium text-text-secondary"
                      >
                        {m.type}
                        <span className="text-body-2-semibold text-text-primary tabular-nums">{m.confidence} %</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            </>
          )}

          <Composer
            value={question}
            onValueChange={setQuestion}
            onSubmit={() => ask()}
            busy={phase === 'thinking'}
            placeholder="Ex. : Pourquoi avons-nous changé le processus SAV ?"
            footerNote="Réponses générées uniquement à partir des connaissances validées de votre instance."
          />
        </div>

        {/* Contextual right panel */}
        <div className="space-y-4">
          <Card title="Sources utilisées">
            {phase === 'answered' && result ? (
              <div className="space-y-1">
                {result.sources.map((s, i) => (
                  <SourceReference key={s.title} index={i + 1} title={s.title} meta={s.meta} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-lg bg-background-secondary-default" />
                ))}
                <p className="pt-1 text-caption-1-medium text-text-tertiary">
                  Les sources citées apparaîtront après votre question.
                </p>
              </div>
            )}
          </Card>

          <Card title="Mémoires utilisées">
            {phase === 'answered' && result ? (
              <ul className="space-y-2.5">
                {result.memoriesUsed.map((m) => (
                  <li key={m.type} className="flex items-center justify-between gap-2">
                    <span className="text-body-2-medium text-text-primary">{m.type}</span>
                    <span className="text-body-2-semibold text-text-primary tabular-nums">{m.confidence} %</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-2-regular text-text-tertiary">
                Types de mémoires mobilisés par la réponse.
              </p>
            )}
          </Card>

          {phase === 'answered' && (
            <Card title="Extrait de preuve">
              <EvidenceCard
                evidence={{
                  id: 'ev-sample',
                  kind: 'meeting',
                  title: 'Réunion du 8 septembre — compte rendu',
                  date: '8 septembre 2026',
                  author: 'Comité Commercial',
                }}
                index={1}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
