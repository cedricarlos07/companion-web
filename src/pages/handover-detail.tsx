import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  DownloadIcon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'
import type { Employee } from '@/types'

interface RealHandover {
  id: string
  employee_name: string
  role_title: string | null
  role_id: string | null
  status: string
  readiness: number
  successor_employee_id: string | null
  successor_name: string | null
  human_pack: {
    summary: string[]
    sections: { key: string; title: string; items: string[] }[]
  } | null
  machine_pack: string | null
}

interface RealGap {
  id: string
  kind: string
  question: string
  detail: string | null
  status: string
  answer_text: string | null
  produced_memory_id: string | null
}

interface MemoryRow {
  id: string
  title: string
  scope: string
  status: string
}

/** Statuts mémoire distincts : candidate → verified → active (publiée au Role Brain). */
const MEMORY_STATUS: Record<string, { label: string; cls: string }> = {
  candidate: { label: 'Candidate', cls: 'bg-status-yellow-background text-status-yellow-text' },
  verified: { label: 'Validée', cls: 'bg-status-blue-background text-status-blue-text' },
  active: { label: 'Publiée · Role Brain', cls: 'bg-status-lime-background text-status-lime-text' },
  rejected: { label: 'Rejetée', cls: 'bg-status-rose-background text-status-rose-text' },
}

export function HandoverDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()

  const [data, setData] = useState<{
    handover: RealHandover
    gaps: RealGap[]
    uniqueKnowledge: { id: string; title: string; type: string; confidence: number }[]
  } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [successorPick, setSuccessorPick] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<MemoryRow[]>([])
  const [journal, setJournal] = useState<{ created_at: string; action: string; actor_name: string | null }[] | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    const res = await api.handover(id)
    if (res === null || !res.handover) {
      setNotFound(true)
      setData(null)
      return
    }
    setData(res as unknown as { handover: RealHandover; gaps: RealGap[]; uniqueKnowledge: typeof res.uniqueKnowledge })
    const emps = await api.employees()
    if (emps) setEmployees(emps)
    // Candidats mémoire produits par l'entretien.
    const producedIds = (res.gaps ?? []).map((g) => g.produced_memory_id).filter((x): x is string => Boolean(x))
    if (producedIds.length > 0) {
      const mems = await api.memories()
      setCandidates((mems ?? []).filter((m) => producedIds.includes(m.id)))
    } else {
      setCandidates([])
    }
    const events = await api.audit('handover')
    setJournal(events as typeof journal)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function act(key: string, fn: () => Promise<unknown>, successMsg: string) {
    if (busy) return
    setBusy(key)
    try {
      const res = await fn()
      if (res === null) {
        pushToast('Opération impossible — backend indisponible.', 'error')
        return
      }
      pushToast(successMsg, 'success')
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (notFound) {
    return (
      <EmptyState
        title="Transfert introuvable."
        action={<Button onClick={() => navigate('/handovers')}>Retour aux transferts</Button>}
      />
    )
  }
  if (!data) {
    return <EmptyState title={error ?? 'Chargement du transfert…'} />
  }

  const h = data.handover
  const openGaps = data.gaps.filter((g) => g.status === 'open')
  const currentSuccessor = h.successor_name ?? employees.find((e) => e.id === h.successor_employee_id)

  return (
    <div>
      <PageHeader
        title="Handover"
        subtitle={`${h.employee_name} · ${h.role_title ?? ''}`}
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate('/handovers')} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Transferts
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{h.employee_name}</span>
          </nav>
        }
        actions={
          <Button
            variant="secondary"
            leadingIcon={adaptIcon(DownloadIcon, 20)}
            onClick={() => {
              if (h.machine_pack) {
                const blob = new Blob([h.machine_pack], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `machine-context-pack-${h.id.slice(0, 8)}.md`
                a.click()
                URL.revokeObjectURL(url)
                pushToast('Machine Context Pack téléchargé.', 'success')
              } else {
                pushToast('Générez d\'abord le pack.', 'info')
              }
            }}
          >
            Exporter
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            <PersonAvatar name={h.employee_name} size="lg" />
            <div className="text-center">
              <p className="text-headline-medium text-text-primary">
                {h.status === 'ready' ? 'Handover prêt' : 'Handover en cours'}
              </p>
              <p className="text-caption-1-medium text-text-secondary">{h.role_title ?? ''}</p>
            </div>
            <ScoreRing value={h.readiness} size={116} tone={h.readiness >= 90 ? 'success' : 'warning'} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card title={`Lacunes détectées (${data.gaps.length})`}>
            <ul className="space-y-2">
              {data.gaps.map((g) => (
                <li key={g.id} className="flex items-start gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <HugeIcon
                    icon={g.status !== 'open' ? CheckmarkCircle02Icon : Alert02Icon}
                    size="sm"
                    className={g.status !== 'open' ? 'mt-0.5 shrink-0 text-emerald-500' : 'mt-0.5 shrink-0 text-amber-500'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-2-medium text-text-primary">{g.question}</p>
                    {g.answer_text && (
                      <p className="mt-0.5 text-caption-1-regular text-text-secondary">Réponse : {g.answer_text}</p>
                    )}
                    {g.detail && !g.answer_text && (
                      <p className="text-caption-1-medium text-text-tertiary">{g.detail}</p>
                    )}
                  </div>
                  {g.status === 'open' && (
                    <Button variant="secondary" size="xs" onClick={() => navigate(`/handovers/${h.id}/interview`)}>
                      Interroger
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {openGaps.length > 0 && (
              <Button size="xs" className="mt-3" onClick={() => navigate(`/handovers/${h.id}/interview`)}>
                Poursuivre l'entretien ({openGaps.length} en attente)
              </Button>
            )}
          </Card>

          {data.uniqueKnowledge.length > 0 && (
            <Card title={`Connaissances uniques (${data.uniqueKnowledge.length})`}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.uniqueKnowledge.slice(0, 8).map((u) => (
                  <li key={u.id} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <HugeIcon icon={Alert02Icon} size="xs" className="shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{u.title}</span>
                    <span className="text-caption-1-semibold text-text-secondary tabular-nums">{u.confidence} %</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Candidats mémoire produits par l'entretien — états distincts */}
      <Card title={`Mémoires issues du handover (${candidates.length})`} className="mb-5">
        {candidates.length === 0 ? (
          <p className="text-body-2-medium text-text-tertiary">
            Aucune mémoire candidate — répondez aux lacunes lors de l'entretien pour créer des connaissances.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {candidates.map((m) => {
              const meta = MEMORY_STATUS[m.status] ?? MEMORY_STATUS.candidate
              const promoted = m.scope === 'role'
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-2-medium text-text-primary">{m.title}</p>
                    <p className="text-caption-1-medium text-text-tertiary">
                      scope : {m.scope}
                      {promoted ? ' · Role Brain' : ''}
                    </p>
                  </div>
                  <span className={cx('rounded-md px-1.5 py-0.5 text-caption-1-medium', meta.cls)}>{meta.label}</span>
                  {m.status !== 'verified' && m.status !== 'active' && (
                    <Button
                      variant="secondary"
                      size="xs"
                      disabled={busy === `verify-${m.id}`}
                      onClick={() => act(`verify-${m.id}`, () => api.verifyMemory(m.id), 'Mémoire validée.')}
                    >
                      Valider
                    </Button>
                  )}
                  {m.status === 'verified' && h.role_id && !promoted && (
                    <Button
                      size="xs"
                      disabled={busy === `promote-${m.id}`}
                      onClick={() => act(`promote-${m.id}`, () => api.promoteMemory(m.id, h.role_id as string), 'Publiée dans le Role Brain.')}
                    >
                      Publier au Role Brain
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Successeur */}
      <Card title="Successeur" className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          {currentSuccessor ? (
            <div className="flex items-center gap-2.5">
              <PersonAvatar name={String(currentSuccessor)} size="sm" />
              <span className="text-body-2-medium text-text-primary">
                Successeur : <span className="font-medium">{String(currentSuccessor)}</span>
              </span>
            </div>
          ) : (
            <span className="text-body-2-medium text-text-secondary">Aucun successeur assigné.</span>
          )}
          <div className="flex-1" />
          <select
            aria-label="Choisir le successeur"
            value={successorPick}
            onChange={(e) => setSuccessorPick(e.target.value)}
            className="rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-2-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <option value="">Choisir un successeur…</option>
            {employees
              .filter((e) => e.id !== h.employee_name && e.status === 'active')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
          </select>
          <Button
            size="small"
            disabled={!successorPick || busy === 'successor'}
            onClick={() =>
              act('successor', () => api.assignSuccessor(h.id, successorPick), 'Successeur assigné — audité.')
            }
          >
            {busy === 'successor' ? 'Affectation…' : 'Affecter'}
          </Button>
        </div>
      </Card>

      {/* Pack généré */}
      {h.human_pack ? (
        <div className="space-y-4">
          {(h.human_pack.sections ?? []).map((s) => (
            <Card key={s.key} title={s.title}>
              <ul className="space-y-2">
                {s.items.length === 0 && <li className="text-caption-1-medium text-text-tertiary">—</li>}
                {s.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-body-2-regular text-text-primary">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-medium text-text-primary">
                Prochaine étape : générer l'onboarding du successeur à partir de ce pack.
              </p>
              <Button
                onClick={async () => {
                  const successorId = h.successor_employee_id ?? successorPick
                  if (!successorId) {
                    pushToast('Assignez d\'abord un successeur.', 'info')
                    return
                  }
                  const res = await api.generateOnboarding(successorId, h.id)
                  pushToast(res ? 'Onboarding généré (J1 / J7 / J30).' : 'Génération impossible (backend indisponible).', res ? 'success' : 'error')
                  if (res) navigate('/onboarding')
                }}
              >
                Créer l'onboarding
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-body-medium text-text-primary">Handover Pack</p>
              <p className="text-caption-1-medium text-text-secondary">
                Répondez aux questions ouvertes ({openGaps.length}) puis générez le pack : résumé,
                procédures, clients, décisions et contexte machine pour les agents.
              </p>
            </div>
            <Button
              disabled={busy === 'pack'}
              onClick={() => act('pack', () => api.generatePack(h.id), 'Handover Pack généré — prêt pour le successeur.')}
            >
              {busy === 'pack' ? 'Génération…' : 'Générer le Handover Pack'}
            </Button>
          </div>
        </Card>
      )}

      {/* Journal d'activité réel */}
      <Card title="Journal d'activité" className="mt-5">
        {journal === null ? (
          <p className="text-body-2-medium text-text-tertiary">Chargement du journal…</p>
        ) : journal.length === 0 ? (
          <p className="text-body-2-medium text-text-tertiary">Aucun évènement enregistré.</p>
        ) : (
          <ul className="space-y-2">
            {journal.slice(0, 12).map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2.5 text-body-2-regular">
                <span className="text-caption-1-medium text-text-tertiary">{fmtDate(e.created_at)}</span>
                <span className="rounded bg-background-secondary-default px-1.5 py-0.5 text-caption-1-medium text-text-secondary">
                  {e.action}
                </span>
                <span className="text-caption-1-medium text-text-tertiary">{e.actor_name ?? 'système'}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR')
}
