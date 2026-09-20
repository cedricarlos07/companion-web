import { useCallback, useEffect, useState } from 'react'
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
import { Input } from '@/components/base/input/input'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
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

type MemoryDetail = NonNullable<Awaited<ReturnType<typeof api.memory>>>

export function MemoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [detail, setDetail] = useState<MemoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const res = await api.memory(id)
    setDetail(res)
    setStatus(res ? String(res.memory.status) : null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function verify() {
    if (!detail || actionPending) return
    setActionPending(true)
    const res = await api.verifyMemory(String(detail.memory.id))
    setActionPending(false)
    if (res === null) {
      pushToast('Vérification impossible — backend indisponible.', 'error')
      return
    }
    setStatus('verified')
    pushToast('Mémoire vérifiée en base.', 'success')
  }

  async function deprecate() {
    if (!detail || actionPending) return
    setActionPending(true)
    const res = await api.setMemoryStatus(String(detail.memory.id), 'deprecated', 'marquée obsolète')
    setActionPending(false)
    if (res === null) {
      pushToast('Action impossible — backend indisponible.', 'error')
      return
    }
    setStatus('deprecated')
    pushToast('Mémoire marquée obsolète.', 'info')
  }

  async function reportConflict() {
    if (!detail || actionPending) return
    if (reportReason.trim().length < 5) {
      pushToast('Décrivez le conflit en quelques mots.', 'error')
      return
    }
    setActionPending(true)
    const res = await api.setMemoryStatus(String(detail.memory.id), 'contradicted', reportReason.trim())
    setActionPending(false)
    if (res === null) {
      pushToast('Signalement impossible — backend indisponible.', 'error')
      return
    }
    setReportOpen(false)
    setReportReason('')
    setStatus('contradicted')
    pushToast('Conflit signalé — le Knowledge Agent va proposer une résolution.', 'info')
  }

  if (loading) {
    return <Card><p className="text-body-2-medium text-text-tertiary">Chargement de la connaissance…</p></Card>
  }

  if (!detail) {
    return (
      <EmptyState
        title="Connaissance introuvable."
        detail="Elle a peut-être été archivée ou l'adresse est incorrecte."
        action={<Button onClick={() => navigate('/brain')}>Retour au Company Brain</Button>}
      />
    )
  }

  const m = detail.memory
  const memory: Memory = {
    id: String(m.id),
    type: String(m.type) as Memory['type'],
    title: String(m.title),
    content: String(m.content),
    scope: String(m.scope),
    roleTitle: String(m.role_title ?? ''),
    ownerId: String(m.employee_id ?? ''),
    ownerName: String(m.employee_name ?? m.contributor ?? ''),
    confidence: Number(m.confidence),
    importance: Number(m.importance),
    status: (status ?? String(m.status)) as Memory['status'],
    updated: String(m.updated_at ?? ''),
    validFrom: String(m.valid_from ?? ''),
    evidence: [],
    history: (detail.versions ?? []).map((v) => ({
      id: `v${v.version}`,
      kind: v.version === 1 ? ('created' as const) : ('modified' as const),
      date: v.created_at.slice(0, 16).replace('T', ' '),
      actor: v.changed_by,
      detail: v.change_reason,
    })),
    related: (detail.related ?? []).map((r) => ({
      id: String(r.id),
      kind: 'memory' as const,
      label: r.title,
      meta: r.kind,
      href: `/brain/${r.id}`,
    })),
    contributor: String(m.contributor ?? ''),
    observedDate: String(m.created_at ?? '').slice(0, 10),
    confirmations: Number(m.version ?? 1),
    humanValidated: Boolean(m.human_validated),
  }

  // Preuves réelles : extraits des documents sources.
  const evidenceList = (detail.evidence ?? []).map((e, i) => ({
    id: `ev-${i}`,
    kind: (e.mime_type === 'pdf' ? 'document' : 'note') as Evidence['kind'],
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
              <KnowledgeStatusBadge status={memory.status} />
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
            {evidenceList.length === 0 ? (
              <p className="text-body-2-medium text-text-secondary">Aucun extrait source rattaché.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {evidenceList.map((e, i) => (
                  <EvidenceCard key={e.id} evidence={e} index={i} />
                ))}
              </div>
            )}
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
                onClick={() => void verify()}
                disabled={actionPending || memory.status === 'verified'}
              >
                Vérifier
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center"
                leadingIcon={adaptIcon(ArchiveIcon, 20)}
                onClick={() => void deprecate()}
                disabled={actionPending}
              >
                Déprécier
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-center"
                leadingIcon={adaptIcon(Alert02Icon, 20)}
                onClick={() => setReportOpen(true)}
                disabled={actionPending}
              >
                Signaler un conflit
              </Button>
            </div>
            <p className="mt-3 text-caption-1-regular text-text-tertiary">
              L'édition de contenu passe par une nouvelle version sourcée — importez la source
              corrigée et Companion produira la révision.
            </p>
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
              {memory.history.length === 0 && (
                <li className="text-body-2-medium text-text-secondary">Aucune version enregistrée.</li>
              )}
            </ol>
          </Card>

          <Card title="Sources d'origine">
            <div className="space-y-1">
              {evidenceList.slice(0, 4).map((e, i) => (
                <SourceReference key={e.id} index={i + 1} title={e.title} meta={e.date} />
              ))}
              {evidenceList.length === 0 && (
                <p className="text-body-2-medium text-text-secondary">Source : {memory.contributor || 'import'}</p>
              )}
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
            <Button size="small" disabled={actionPending} onClick={() => void reportConflict()}>
              {actionPending ? 'Envoi…' : 'Envoyer le signalement'}
            </Button>
          </>
        }
      >
        <Input
          label="Nature du conflit"
          value={reportReason}
          onChange={setReportReason}
          placeholder="ex. une source plus récente dit le contraire"
        />
        <p className="mt-3 text-body-2-regular text-text-secondary">
          La mémoire passe en statut « contradictoire » et le Knowledge Agent comparera les sources pour
          proposer une résolution. Les deux versions restent consultables jusqu'à la décision.
        </p>
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-background-secondary-default p-3">
          <HugeIcon icon={AlertCircleIcon} size="sm" className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-caption-1-regular text-text-secondary">
            Cette mémoire est actuellement « {memoryStatusMeta(memory.status).label} ». Le signalement ne
            supprime aucune donnée.
          </p>
        </div>
      </Modal>
    </div>
  )
}
