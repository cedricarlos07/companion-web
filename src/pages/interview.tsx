import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow } from '@/components/common/progress'
import { KnowledgeTypeBadge, RiskBadge } from '@/components/common/badges'
import { Button } from '@/components/base/buttons/button'
import { Textarea } from '@/components/base/textarea/textarea'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  AiChat02Icon,
  Attachment01Icon,
  CheckmarkCircle02Icon,
  Mic01Icon,
  ArrowRight02Icon,
  SparklesIcon,
} from '@/lib/icons'
import { INTERVIEW_QUESTIONS, getHandover } from '@/data/continuity'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'

interface RealGap {
  id: string
  question: string
  detail: string | null
  status: string
  answer_text: string | null
  produced_memory_id: string | null
}

/** Knowledge interview — Companion asks targeted questions to fill handover gaps. */
export function InterviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const handover = id ? getHandover(id) : undefined
  const [current, setCurrent] = useState(5) // 6th question (index 5) — matches the 6/9 demo state
  const [answers, setAnswers] = useState(INTERVIEW_QUESTIONS.filter((q) => q.answer))
  const [draft, setDraft] = useState('')
  const [realGaps, setRealGaps] = useState<RealGap[] | null>(null)
  const [realHandoverId, setRealHandoverId] = useState<string | null>(null)
  const [produced, setProduced] = useState<{ title: string; content: string } | null>(null)

  // Entretien réel : les gaps détectés par le Handover Agent deviennent les questions.
  useEffect(() => {
    if (!id) return
    api.handover(id).then((res) => {
      if (res?.gaps && res.gaps.length > 0) {
        setRealGaps(res.gaps)
        setRealHandoverId(String(res.handover.id))
      }
    })
  }, [id])

  // Questions actives : gaps réels ouverts, sinon le jeu de démo.
  const openRealGaps = (realGaps ?? []).filter((g) => g.status === 'open')
  const usingReal = realGaps !== null && openRealGaps.length + (realGaps?.filter((g) => g.status !== 'open').length ?? 0) > 0
  const realAnswered = (realGaps ?? []).filter((g) => g.status !== 'open')

  if (!handover) {
    return (
      <EmptyState
        title="Transfert introuvable."
        action={<Button onClick={() => navigate('/handovers')}>Retour aux transferts</Button>}
      />
    )
  }

  const totalQuestions = usingReal ? (realGaps?.length ?? 0) : INTERVIEW_QUESTIONS.length
  const answeredCount = usingReal ? realAnswered.length : Math.max(answers.length, current)
  const question = usingReal
    ? undefined
    : INTERVIEW_QUESTIONS[current]
  const currentReal = usingReal ? openRealGaps[0] : undefined
  const finished = usingReal ? openRealGaps.length === 0 : current >= INTERVIEW_QUESTIONS.length

  async function submitAnswer() {
    if (draft.trim().length < 3) {
      pushToast('Écrivez votre réponse, enregistrez un audio ou passez à la question suivante.', 'info')
      return
    }
    if (usingReal && currentReal && realHandoverId) {
      const res = await api.answerInterview(realHandoverId, currentReal.id, draft.trim())
      if (res?.memory) {
        setProduced({ title: String(res.memory.title ?? ''), content: String(res.memory.content ?? '') })
        pushToast('Réponse enregistrée — mémoire candidate créée dans la vraie base.')
      } else {
        pushToast('Réponse enregistrée localement (backend indisponible).', 'info')
      }
      // Rafraîchit les gaps depuis le serveur.
      const fresh = await api.handover(realHandoverId)
      if (fresh?.gaps) setRealGaps(fresh.gaps)
    } else if (question) {
      setAnswers((list) => {
        const others = list.filter((a) => a.id !== question.id)
        return [...others, { ...question, answer: draft.trim() }]
      })
      setCurrent((c) => c + 1)
      pushToast('Réponse enregistrée — Companion prépare la mémoire candidate.')
    }
    setDraft('')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Compléter le transfert de connaissances"
        subtitle={`${handover.employeeName} · entretien mené par Companion`}
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate(`/handovers/${handover.id}`)} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Handover {handover.employeeName}
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">Entretien</span>
          </nav>
        }
        actions={<RiskBadge risk="high" label={`${answeredCount} / ${totalQuestions} questions`} />}
      />

      <div className="mb-4">
        <ProgressRow label="Progression" value={totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0} />
      </div>

      {!finished && (question || currentReal) ? (
        <>
          {/* Question */}
          <Card className="mb-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                <HugeIcon icon={SparklesIcon} size="sm" />
              </span>
              <div className="min-w-0">
                <p className="text-caption-1-medium text-text-tertiary">
                  Companion · question {answeredCount + 1} sur {totalQuestions}
                </p>
                <p className="mt-1 text-body-medium leading-relaxed text-text-primary">
                  {currentReal ? currentReal.question : question!.prompt}
                </p>
                {currentReal?.detail && (
                  <p className="mt-1 text-caption-1-regular text-text-tertiary">{currentReal.detail}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Response composer */}
          <Card>
            <Textarea
              label="Votre réponse"
              value={draft}
              onChange={setDraft}
              placeholder="Décrivez la procédure, le contexte, les contacts… tout ce que le successeur devra savoir."
              rows={4}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button leadingIcon={adaptIcon(ArrowRight02Icon, 18)} onClick={submitAnswer}>
                Répondre
              </Button>
              <Button
                variant="secondary"
                size="small"
                leadingIcon={adaptIcon(Attachment01Icon, 18)}
                onClick={() => pushToast('Fichier joint à la réponse (démo).', 'info')}
              >
                Joindre
              </Button>
              <Button
                variant="secondary"
                size="small"
                leadingIcon={adaptIcon(Mic01Icon, 18)}
                onClick={() => {
                  setDraft(
                    'Le 25 du mois je collecte les prévisions de chaque commercial, je pondère par probabilité, puis je passe la revue avec Ibrahim avant diffusion.',
                  )
                  pushToast('Enregistrement simulé transcrit en texte.', 'info')
                }}
              >
                Enregistrer (démo)
              </Button>
              <div className="flex-1" />
              {!usingReal && (
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    setCurrent((c) => c + 1)
                    setDraft('')
                  }}
                >
                  Passer
                </Button>
              )}
            </div>
          </Card>
        </>
      ) : (
        <Card className="mb-4">
          <div className="py-4 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <HugeIcon icon={CheckmarkCircle02Icon} size="lg" />
            </span>
            <h2 className="text-title-2-medium text-text-primary">Entretien terminé — merci !</h2>
            <p className="mt-1 text-body-2-regular text-text-secondary">
              Companion transforme vos réponses en mémoires candidates à valider.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => navigate(`/handovers/${handover.id}`)}>Voir le handover</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Latest extracted memory */}
      {usingReal && produced && (
        <Card
          title="Dernière mémoire extraite"
          actions={<span className="text-caption-1-medium text-text-tertiary">Créée dans la base réelle</span>}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
              <HugeIcon icon={AiChat02Icon} size="sm" className="text-foreground-icon-secondary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <KnowledgeTypeBadge type="procedure" />
                <p className="text-body-medium font-medium text-text-primary">{produced.title}</p>
                <span className="text-caption-1-medium text-text-tertiary tabular-nums">78 % de confiance</span>
              </div>
              <p className="mt-1.5 text-body-2-regular text-text-secondary">{produced.content}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="xs"
                  leadingIcon={adaptIcon(CheckmarkCircle02Icon, 16)}
                  onClick={async () => {
                    const mems = await api.memories({ q: produced.title.slice(0, 40) })
                    const target = mems?.find((m) => m.title === produced.title)
                    if (target) {
                      const ok = await api.verifyMemory(target.id)
                      pushToast(ok ? 'Mémoire confirmée et ajoutée au Company Brain.' : 'Validation impossible (backend indisponible).', ok ? 'success' : 'error')
                    } else {
                      pushToast('Mémoire introuvable pour validation.', 'error')
                    }
                  }}
                >
                  Confirmer (valide en base)
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
      {!usingReal && answers.length > 0 && (
        <Card
          title="Dernière mémoire extraite"
          actions={<span className="text-caption-1-medium text-text-tertiary">Nouvelle procédure candidate</span>}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
              <HugeIcon icon={AiChat02Icon} size="sm" className="text-foreground-icon-secondary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <KnowledgeTypeBadge type={answers[answers.length - 1].producedMemory?.type ?? 'procedure'} />
                <p className="text-body-medium font-medium text-text-primary">
                  {answers[answers.length - 1].producedMemory?.title ?? 'Réponse documentée'}
                </p>
                <span className="text-caption-1-medium text-text-tertiary tabular-nums">
                  {answers[answers.length - 1].producedMemory?.confidence ?? 80} % de confiance
                </span>
              </div>
              <p className="mt-1.5 text-body-2-regular text-text-secondary">{answers[answers.length - 1].answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="xs"
                  leadingIcon={adaptIcon(CheckmarkCircle02Icon, 16)}
                  onClick={() => pushToast('Mémoire confirmée et ajoutée au Company Brain.')}
                >
                  Confirmer
                </Button>
                <Button variant="secondary" size="xs" onClick={() => pushToast('Ouverture de la révision (démo).', 'info')}>
                  Réviser
                </Button>
                <Button variant="ghost" size="xs" onClick={() => pushToast('Mode édition (démo).', 'info')}>
                  Modifier
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Answered list */}
      <Card title="Questions traitées" className="mt-4" bodyClassName="p-0">
        <ul>
          {usingReal && (realGaps ?? []).map((g, i) => (
            <li key={g.id} className="flex items-start gap-3 border-b border-separator-border px-4 py-3 last:border-b-0">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-caption-2-semibold tabular-nums ${g.status !== 'open' ? 'bg-status-lime-background text-status-lime-text' : 'bg-background-secondary-default text-text-tertiary'}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-2-medium text-text-primary">{g.question}</p>
                {g.answer_text && <p className="truncate text-caption-1-medium text-text-tertiary">{g.answer_text}</p>}
              </div>
              {g.status !== 'open' ? (
                <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-emerald-500" />
              ) : (
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <span className="size-1.5 rounded-full bg-background-quaternary-default" />
                </span>
              )}
            </li>
          ))}
          {!usingReal && INTERVIEW_QUESTIONS.slice(0, answeredCount).map((q, i) => (
            <li key={q.id} className="flex items-start gap-3 border-b border-separator-border px-4 py-3 last:border-b-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-status-lime-background text-caption-2-semibold text-status-lime-text tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-2-medium text-text-primary">{q.prompt}</p>
                {q.answer && <p className="truncate text-caption-1-medium text-text-tertiary">{q.answer}</p>}
              </div>
              <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-emerald-500" />
            </li>
          ))}
          {!usingReal && INTERVIEW_QUESTIONS.slice(answeredCount).map((q, i) => (
            <li key={q.id} className="flex items-start gap-3 border-b border-separator-border px-4 py-3 last:border-b-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background-secondary-default text-caption-2-semibold text-text-tertiary tabular-nums">
                {answeredCount + i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-2-medium text-text-secondary">{q.prompt}</p>
              </div>
              <span className="flex size-6 shrink-0 items-center justify-center">
                <span className="size-1.5 rounded-full bg-background-quaternary-default" />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-background-secondary-default px-4 py-3">
        <PersonAvatar name={handover.employeeName} size="sm" />
        <p className="text-caption-1-medium text-text-secondary">
          Entretien asynchrone : {handover.employeeName} peut répondre quand il veut — Companion regroupe les
          réponses et construit le handover.
        </p>
      </div>
    </div>
  )
}
