import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { Textarea } from '@/components/base/textarea/textarea'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
} from '@/lib/icons'
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

interface RealHandover {
  id: string
  employee_name: string
}

/** Entretien de connaissances — les gaps détectés par le Handover Agent
 *  deviennent les questions ; chaque réponse crée un candidat mémoire en base. */
export function InterviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [handover, setHandover] = useState<RealHandover | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [gaps, setGaps] = useState<RealGap[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [produced, setProduced] = useState<{ id: string; title: string; content: string } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const res = await api.handover(id)
    if (res === null || !res.handover) {
      setNotFound(true)
      return
    }
    setHandover(res.handover as unknown as RealHandover)
    setGaps((res.gaps ?? []) as unknown as RealGap[])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const openGaps = gaps.filter((g) => g.status === 'open')
  const answeredGaps = gaps.filter((g) => g.status !== 'open')
  const currentReal = openGaps[0]

  async function submitAnswer() {
    if (draft.trim().length < 5) {
      pushToast('Décrivez la réponse en quelques mots (5 caractères minimum).', 'info')
      return
    }
    if (!currentReal || !handover) return
    setBusy(true)
    const res = await api.answerInterview(handover.id, currentReal.id, draft.trim())
    if (res === null) {
      pushToast('Enregistrement impossible — backend indisponible.', 'error')
      setBusy(false)
      return
    }
    const memory = res.memory as { id?: string; title?: string; content?: string } | null
    if (memory?.id) {
      setProduced({ id: memory.id, title: String(memory.title ?? ''), content: String(memory.content ?? '') })
      pushToast('Réponse enregistrée — mémoire candidate créée en base.', 'success')
    }
    setDraft('')
    await load()
    setBusy(false)
  }

  async function verifyProduced() {
    if (!produced) return
    const ok = await api.verifyMemory(produced.id)
    pushToast(
      ok ? 'Mémoire confirmée et ajoutée au Company Brain.' : 'Validation impossible (backend indisponible).',
      ok ? 'success' : 'error',
    )
  }

  if (notFound) {
    return (
      <EmptyState
        title="Transfert introuvable."
        action={<Button onClick={() => navigate('/handovers')}>Retour aux transferts</Button>}
      />
    )
  }
  if (!handover) {
    return <EmptyState title="Chargement de l'entretien…" />
  }

  const totalQuestions = gaps.length
  const answeredCount = answeredGaps.length

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Compléter le transfert de connaissances"
        subtitle={`${handover.employee_name} · entretien mené par Companion`}
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate(`/handovers/${handover.id}`)} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Handover {handover.employee_name}
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">Entretien</span>
          </nav>
        }
        actions={<span className="rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-caption-1-medium text-text-secondary tabular-nums">{answeredCount} / {totalQuestions} questions</span>}
      />

      <div className="mb-4">
        <ProgressRow label="Progression" value={totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0} />
      </div>

      {currentReal ? (
        <>
          <Card className="mb-4">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                <HugeIcon icon={SparklesIcon} size="sm" />
              </span>
              <div className="min-w-0">
                <p className="text-caption-1-medium text-text-tertiary">
                  Companion · question {answeredCount + 1} sur {totalQuestions}
                </p>
                <p className="mt-1 text-body-medium leading-relaxed text-text-primary">{currentReal.question}</p>
                {currentReal.detail && (
                  <p className="mt-1 text-caption-1-regular text-text-tertiary">{currentReal.detail}</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <Textarea
              label="Votre réponse"
              value={draft}
              onChange={setDraft}
              placeholder="Décrivez la procédure, le contexte, les contacts… tout ce que le successeur devra savoir."
              rows={4}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button leadingIcon={adaptIcon(ArrowRight02Icon, 18)} disabled={busy} onClick={() => void submitAnswer()}>
                {busy ? 'Enregistrement…' : 'Répondre'}
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <Card className="mb-4">
          <div className="py-4 text-center">
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-status-lime-background text-status-lime-text">
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

      {produced && (
        <Card
          title="Dernière mémoire extraite"
          actions={<span className="text-caption-1-medium text-text-tertiary">Candidate — en attente de validation</span>}
          className="mt-4"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
              <HugeIcon icon={SparklesIcon} size="sm" className="text-foreground-icon-secondary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-medium font-medium text-text-primary">{produced.title}</p>
              <p className="mt-1 text-body-2-regular text-text-secondary">{produced.content}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="xs"
                  leadingIcon={adaptIcon(CheckmarkCircle02Icon, 16)}
                  onClick={() => void verifyProduced()}
                >
                  Confirmer (valide en base)
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card title="Questions traitées" className="mt-4" bodyClassName="p-0">
        <ul>
          {gaps.map((g, i) => (
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
        </ul>
      </Card>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-background-secondary-default px-4 py-3">
        <PersonAvatar name={handover.employee_name} size="sm" />
        <p className="text-caption-1-medium text-text-secondary">
          Entretien asynchrone : {handover.employee_name} peut répondre quand il veut — Companion regroupe les
          réponses et construit le handover.
        </p>
      </div>
    </div>
  )
}
