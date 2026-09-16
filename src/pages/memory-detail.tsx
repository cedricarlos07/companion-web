import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '@/components/common/stat-card'
import {
  ConfidenceBadge,
  KnowledgeStatusBadge,
  KnowledgeTypeBadge,
  memoryStatusMeta,
} from '@/components/common/badges'
import { EvidenceCard, SourceReference } from '@/components/common/memory-bits'
import { PersonAvatar } from '@/components/common/person-avatar'
import { EmptyState } from '@/components/common/states'
import { Modal } from '@/components/common/modal'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { getMemory } from '@/data/memories'
import { api } from '@/services/api'
import {
  Alert02Icon,
  ArchiveIcon,
  CheckmarkCircle02Icon,
  PencilEdit01Icon,
  AlertCircleIcon,
  HistoryIcon,
  PlusSignIcon,
} from '@/lib/icons'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'
import type { Evidence, HistoryEvent, Memory } from '@/types'

const HISTORY_ICONS: Record<HistoryEvent['kind'], typeof CheckmarkCircle02Icon> = {
  created: PlusSignIcon,
  confirmed: CheckmarkCircle02Icon,
  modified: PencilEdit01Icon,
  archived: ArchiveIcon,
  version: HistoryIcon,
}

const HISTORY_LABELS: Record<HistoryEvent['kind'], string> = {
  created: 'Créée',
  confirmed: 'Confirmée',
  modified: 'Modifiée',
  archived: 'Archivée',
  version: 'Version mise à jour',
}

const RELATED_META: Record<string, string> = {
  memory: 'Connaissance',
  person: 'Personne',
  client: 'Client',
  role: 'Rôle',
  project: 'Projet',
}

export function MemoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const mockMemory = id ? getMemory(id) : undefined
  const [status, setStatus] = useState(mockMemory?.status)
  const [reportOpen, setReportOpen] = useState(false)

  // Mémoire réelle (UUID) quand l'id n'est pas un id de démo.
  const [real, setReal] = useState<Awaited<ReturnType<typeof api.memory>> | null>(null)
  useEffect(() => {
    if (mockMemory || !id) return
    api.memory(id).then((res) => {
      if (res?.memory) {
        setReal(res)
        setStatus(String(res.memory.status) as typeof status)
      }
    })
  }, [id, mockMemory])

  const evidence: { excerpt: string | null; location: string | null; document_title: string | null; mime_type: string | null }[] =
    real?.evidence ?? []

  function verify() {
    setStatus('verified')
    if (real) {
      api.verifyMemory(String(real.memory.id)).then((ok) => {
        pushToast(ok ? 'Mémoire vérifiée en base.' : 'Vérification impossible (backend indisponible).', ok ? 'success' : 'error')
      })
    } else {
      pushToast('Mémoire vérifiée.')
    }
  }

  function deprecate() {
    setStatus('deprecated')
    if (real) {
      api.setMemoryStatus(String(real.memory.id), 'deprecated', 'marquée obsolète').then((ok) => {
        pushToast(ok ? 'Mémoire marquée obsolète.' : 'Action impossible (backend indisponible).', ok ? 'info' : 'error')
      })
    } else {
      pushToast('Mémoire marquée obsolète.', 'info')
    }
  }

  if (!mockMemory && !real) {
    return (
      <EmptyState
        title="Connaissance introuvable."
        detail="Elle a peut-être été archivée ou l'adresse est incorrecte."
        action={<Button onClick={() => navigate('/brain')}>Retour au Company Brain</Button>}
      />
    )
  }

  const memory: Memory = mockMemory ?? {
    id: String(real!.memory.id),
    type: String(real!.memory.type) as Memory['type'],
    title: String(real!.memory.title),
    content: String(real!.memory.content),
    scope: String(real!.memory.scope),
    roleTitle: String(real!.memory.role_title ?? ''),
    ownerId: String(real!.memory.employee_id ?? ''),
    ownerName: String(real!.memory.employee_name ?? real!.memory.contributor ?? ''),
    confidence: Number(real!.memory.confidence),
    importance: Number(real!.memory.importance),
    status: status ?? (String(real!.memory.status) as Memory['status']),
    updated: String(real!.memory.updated_at ?? ''),
    validFrom: String(real!.memory.valid_from ?? ''),
    evidence: [],
    history: (real!.versions ?? []).map((v) => ({
      id: `v${v.version}`,
      kind: v.version === 1 ? ('created' as const) : ('modified' as const),
      date: v.created_at.slice(0, 16).replace('T', ' '),
      actor: v.changed_by,
      detail: v.change_reason,
    })),
    related: (real!.related ?? []).map((r) => ({
      id: String(r.id),
      kind: 'memory' as const,
      label: r.title,
      meta: r.kind,
      href: `/brain/${r.id}`,
    })),
    contributor: String(real!.memory.contributor ?? ''),
    observedDate: String(real!.memory.created_at ?? '').slice(0, 10),
    confirmations: Number(real!.memory.version ?? 1),
    humanValidated: Boolean(real!.memory.human_validated),
  }

  // Preuves : mock Evidence ou lignes réelles converties.
  const evidenceList: Evidence[] = mockMemory
    ? mockMemory.evidence
    : evidence.map((e, i) => ({
        id: `ev-${i}`,
        kind: e.mime_type === 'pdf' ? 'document' : e.mime_type === 'paste' ? 'note' : 'document',
        title: e.document_title ?? 'Source importée',
        date: e.location ?? '',
        author: 'Import',
      }))

  return (
    <div>
      <nav
        className="mb-4 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary"
        aria-label="Fil d'ariane"
      >
        <button
          type="button"
          onClick={() => navigate('/brain')}
          className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary"
        >
          Company Brain
        </button>
        <span aria-hidden>/</span>
        <span className="text-text-secondary">{memory.title}</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <KnowledgeTypeBadge type={memory.type} />
              <KnowledgeStatusBadge status={status ?? memory.status} />
              <ConfidenceBadge value={memory.confidence} />
            </div>
            <h1 className="text-title-1-medium text-text-primary">{memory.title}</h1>
            <p className="mt-3 text-body-medium leading-relaxed text-text-primary">{memory.content}</p>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-separator-border pt-5 sm:grid-cols-3">
              {[
                { label: 'Périmètre', value: memory.scope },
                { label: 'Rôle', value: memory.roleTitle },
                { label: 'Importance', value: `${memory.importance} / 100` },
                { label: 'Valable depuis', value: memory.validFrom },
                { label: 'Contributeur', value: memory.contributor },
                { label: 'Observée le', value: memory.observedDate },
                { label: 'Confirmations', value: `${memory.confirmations}` },
                { label: 'Validation humaine', value: memory.humanValidated ? 'Oui' : 'En attente' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-caption-1-medium text-text-tertiary">{item.label}</dt>
                  <dd className="mt-0.5 text-body-2-medium text-text-primary">{item.value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-caption-1-medium text-text-tertiary">Propriétaire</dt>
                <dd className="mt-0.5 flex items-center gap-2 text-body-2-medium text-text-primary">
                  <PersonAvatar name={memory.ownerName} size="xs" />
                  {memory.ownerName}
                </dd>
              </div>
            </dl>
          </div>

          <Card title="Preuves">
            <div className="grid gap-2 sm:grid-cols-2">
              {evidenceList.map((e, i) => (
                <EvidenceCard key={e.id} evidence={e} index={i} />
              ))}
            </div>
            <p className="mt-3 text-caption-1-medium text-text-tertiary">
              Chaque affirmation est traçable jusqu'à sa source d'origine.
            </p>
          </Card>

          <Card title="Connaissances liées">
            <div className="grid gap-2 sm:grid-cols-2">
              {memory.related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => (r.href ? navigate(r.href) : navigate('/brain'))}
                  className="flex items-center gap-3 rounded-xl border border-border-button-default p-3 text-left hover:bg-background-primary-hover"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default text-caption-1-semibold text-text-secondary">
                    {(RELATED_META[r.kind] ?? '•')[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body-2-medium text-text-primary">{r.label}</span>
                    <span className="block text-caption-1-medium text-text-tertiary">
                      {RELATED_META[r.kind] ?? r.kind}
                      {r.meta ? ` · ${r.meta}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card title="Actions">
            <div className="space-y-2">
              <Button
                className="w-full justify-center"
                leadingIcon={adaptIcon(CheckmarkCircle02Icon, 20)}
                onClick={verify}
                disabled={status === 'verified'}
              >
                Vérifier
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                leadingIcon={adaptIcon(PencilEdit01Icon, 20)}
                onClick={() => pushToast('Modification enregistrée.')}
              >
                Modifier
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                leadingIcon={adaptIcon(ArchiveIcon, 20)}
                onClick={deprecate}
              >
                Déprécier
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-center"
                leadingIcon={adaptIcon(Alert02Icon, 20)}
                onClick={() => setReportOpen(true)}
              >
                Signaler un conflit
              </Button>
            </div>
          </Card>

          <Card title="Historique">
            <ol className="relative space-y-4 pl-1">
              {memory.history.map((h, i) => {
                const Icon = HISTORY_ICONS[h.kind]
                return (
                  <li key={h.id} className="relative flex gap-3">
                    {i < memory.history.length - 1 && (
                      <span
                        className="absolute top-7 left-[13px] h-full w-px bg-separator-border"
                        aria-hidden
                      />
                    )}
                    <span
                      className={cx(
                        'z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background-primary-default',
                        i === 0 ? 'border-accent-200 bg-accent-50' : 'border-border-button-default',
                      )}
                    >
                      <HugeIcon
                        icon={Icon}
                        size="xs"
                        className={i === 0 ? 'text-accent-600' : 'text-foreground-icon-tertiary'}
                      />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-body-2-medium text-text-primary">{HISTORY_LABELS[h.kind]}</p>
                      <p className="text-caption-1-medium text-text-tertiary">
                        {h.actor} · {h.date}
                      </p>
                      {h.detail && (
                        <p className="mt-0.5 text-caption-1-regular text-text-secondary">{h.detail}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>

          <Card title="Sources d'origine">
            <div className="space-y-1">
              {evidenceList.slice(0, 4).map((e, i) => (
                <SourceReference key={e.id} index={i + 1} title={e.title} meta={e.date} />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Signaler un conflit"
        footer={
          <>
            <Button variant="secondary" size="small" onClick={() => setReportOpen(false)}>
              Annuler
            </Button>
            <Button
              size="small"
              onClick={() => {
                setReportOpen(false)
                pushToast('Signalement envoyé — un administrateur va comparer les sources.', 'info')
              }}
            >
              Envoyer le signalement
            </Button>
          </>
        }
      >
        <p className="text-body-2-regular text-text-secondary">
          Companion comparera cette connaissance avec les autres sources et proposera une résolution.
          Les deux versions resteront consultables jusqu'à la décision.
        </p>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-background-secondary-default p-3">
          <HugeIcon icon={AlertCircleIcon} size="sm" className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-caption-1-regular text-text-secondary">
            Cette mémoire est actuellement « {memoryStatusMeta(status ?? memory.status).label} ». Un conflit
            signalé passera en révision sans supprimer les données.
          </p>
        </div>
      </Modal>
    </div>
  )
}
