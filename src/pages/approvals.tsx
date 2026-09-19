import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import type { Approval } from '@/types'
import { Button } from '@/components/base/buttons/button'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  ArrowRight02Icon,
  BotIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CheckmarkBadge01Icon,
  Database01Icon,
  Mail01Icon,
  PencilEdit01Icon,
  ShieldCheckIcon,
} from '@/lib/icons'
import { cx } from '@/utils/cx'

const TABS = [
  { id: 'pending', label: 'En attente' },
  { id: 'approved', label: 'Approuvées' },
  { id: 'rejected', label: 'Rejetées' },
  { id: 'history', label: 'Historique' },
]

/** Ligne `approvals` de PostgreSQL (mappercamelCase local à la page). */
interface ApprovalRow {
  id: string
  action: string
  tool: string
  risk_level: string
  preview: Record<string, unknown> | null
  reason: string
  sources: string[] | null
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  decided_at: string | null
  decided_by: string | null
  agent_name: string
  run_id: string | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR')
}

function humanize(action: string): string {
  return action.replace(/_/g, ' ')
}

export function ApprovalsPage() {
  const { pushToast, setApprovals } = useAppStore()
  const [rows, setRows] = useState<ApprovalRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const data = await api.request<{ approvals: ApprovalRow[] }>('/approvals?status=all')
    if (data === null) {
      setError('Impossible de charger les approbations — backend indisponible.')
      setRows([])
      return
    }
    setRows(data.approvals ?? [])
    // Hydrate le store global : badge sidebar + sections dashboards.
    setApprovals(
      (data.approvals ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        title: humanize(r.action),
        agentName: r.agent_name,
        reason: r.reason,
        kind: r.tool === 'update_memory' ? 'memory' : 'action',
        sources: (r.sources ?? []).length,
        requestedAt: fmtDate(r.requested_at),
      })) as Approval[],
    )
  }, [setApprovals])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(row: ApprovalRow, decision: 'approved' | 'rejected') {
    if (busyId) return
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/approvals/${row.id}/${decision === 'approved' ? 'approve' : 'reject'}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        pushToast(body?.error ?? `Décision impossible (${res.status}).`, 'error')
        return
      }
      pushToast(
        decision === 'approved'
          ? 'Action approuvée — le workflow reprend avec votre validation.'
          : 'Demande rejetée — l\'agent en a été informé.',
        decision === 'approved' ? 'success' : 'info',
      )
      await load()
    } catch {
      pushToast('Erreur réseau — la décision n\'a pas été enregistrée.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const pending = (rows ?? []).filter((a) => a.status === 'pending')
  const approved = (rows ?? []).filter((a) => a.status === 'approved')
  const rejected = (rows ?? []).filter((a) => a.status === 'rejected')

  return (
    <div>
      <PageHeader
        title="Approbations"
        subtitle="Aucune action sensible n'est exécutée sans votre décision."
        actions={
          <span className="flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-caption-1-medium text-text-secondary">
            <HugeIcon icon={CheckmarkBadge01Icon} size="xs" className="text-accent-500" />
            {pending.length} en attente
          </span>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <Tabs defaultSelectedKey="pending">
        <TabList aria-label="Statut des approbations">
          {TABS.map((t) => (
            <Tab key={t.id} id={t.id}>
              {t.label}
            </Tab>
          ))}
        </TabList>

        <TabPanel id="pending" className="pt-4">
          {rows === null ? (
            <Card>
              <p className="text-body-2-medium text-text-tertiary">Chargement des approbations…</p>
            </Card>
          ) : pending.length === 0 ? (
            <EmptyState
              title="Aucune demande en attente."
              detail="Les agents travaillent dans les limites autorisées."
            />
          ) : (
            <div className="space-y-4">
              {pending.map((row) => (
                <ApprovalCard key={row.id} row={row} busy={busyId === row.id} onDecide={decide} />
              ))}
            </div>
          )}
        </TabPanel>

        {(['approved', 'rejected'] as const).map((status) => (
          <TabPanel key={status} id={status} className="pt-4">
            {rows === null ? (
              <Card>
                <p className="text-body-2-medium text-text-tertiary">Chargement…</p>
              </Card>
            ) : (status === 'approved' ? approved : rejected).length === 0 ? (
              <EmptyState
                title={status === 'approved' ? 'Aucune approbation pour le moment.' : 'Aucun rejet pour le moment.'}
              />
            ) : (
              <div className="space-y-4">
                {(status === 'approved' ? approved : rejected).map((row) => (
                  <ApprovalCard key={row.id} row={row} busy={busyId === row.id} onDecide={decide} />
                ))}
              </div>
            )}
          </TabPanel>
        ))}

        <TabPanel id="history" className="pt-4">
          <Card>
            {rows === null || rows.length === 0 ? (
              <p className="text-body-2-medium text-text-tertiary">Aucun évènement.</p>
            ) : (
              <ul className="space-y-2.5">
                {rows.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-body-2-regular">
                    <span className="text-caption-1-medium text-text-tertiary">{fmtDate(a.requested_at)}</span>
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      {a.agent_name} — {humanize(a.action)}
                    </span>
                    <span
                      className={cx(
                        'rounded-md px-1.5 py-0.5 text-caption-1-medium',
                        a.status === 'pending'
                          ? 'bg-status-yellow-background text-status-yellow-text'
                          : a.status === 'approved'
                            ? 'bg-status-lime-background text-status-lime-text'
                            : 'bg-status-rose-background text-status-rose-text',
                      )}
                    >
                      {a.status === 'pending' ? 'En attente' : a.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-status-yellow-background text-status-yellow-text' },
  approved: { label: 'Approuvée', className: 'bg-status-lime-background text-status-lime-text' },
  rejected: { label: 'Rejetée', className: 'bg-status-rose-background text-status-rose-text' },
}

function ApprovalCard({
  row,
  busy,
  onDecide,
}: {
  row: ApprovalRow
  busy: boolean
  onDecide: (row: ApprovalRow, decision: 'approved' | 'rejected') => void
}) {
  const { pushToast } = useAppStore()
  const status = STATUS_CHIP[row.status] ?? STATUS_CHIP.pending
  const preview = row.preview ?? {}
  const email = preview as { to?: string; subject?: string; body?: string }
  const change = preview as { from?: string; to?: string; label?: string; evidence?: string }
  const isEmail = Boolean(email.to && email.subject)
  const isMemoryChange = !isEmail && Boolean(change.from && change.to)
  const otherEntries = Object.entries(preview).filter(([k]) =>
    isEmail ? !['to', 'subject', 'body'].includes(k) : isMemoryChange ? !['from', 'to', 'label', 'evidence'].includes(k) : true,
  )

  return (
    <Card
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-caption-1-semibold text-text-tertiary uppercase">
            <HugeIcon icon={BotIcon} size="xs" />
            {row.agent_name}
          </span>
          <span
            className={cx(
              'rounded px-1.5 py-0.5 text-caption-2-semibold',
              row.risk_level === 'high'
                ? 'bg-status-rose-background text-status-rose-text'
                : row.risk_level === 'medium'
                  ? 'bg-status-yellow-background text-status-yellow-text'
                  : 'bg-status-lime-background text-status-lime-text',
            )}
          >
            {row.tool}
          </span>
          <span className={cx('rounded-md px-1.5 py-0.5 text-caption-1-medium', status.className)}>
            {status.label}
          </span>
        </div>
      }
    >
      <p className="text-headline-medium text-text-primary">{humanize(row.action)}</p>
      <p className="mt-1 text-body-2-regular text-text-secondary">
        <span className="font-medium text-text-tertiary">Raison : </span>
        {row.reason}
      </p>

      {isEmail && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border-button-default">
          <div className="flex items-center gap-2 border-b border-separator-border bg-background-secondary-default px-3.5 py-2">
            <HugeIcon icon={Mail01Icon} size="xs" className="text-foreground-icon-tertiary" />
            <span className="text-caption-1-medium text-text-secondary">
              À : <span className="text-text-primary">{email.to}</span> · Objet :{' '}
              <span className="text-text-primary">{email.subject}</span>
            </span>
          </div>
          <p className="px-3.5 py-3 text-body-2-regular text-text-primary">{email.body}</p>
        </div>
      )}

      {isMemoryChange && (
        <div className="mt-3 rounded-xl border border-border-button-default p-3.5">
          <p className="text-caption-1-medium text-text-tertiary">{change.label ?? 'Mise à jour mémoire'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-body-2-medium text-text-primary line-through">
              {change.from}
            </span>
            <HugeIcon icon={ArrowRight02Icon} size="sm" className="text-accent-500" />
            <span className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-body-2-medium font-medium text-accent-700">
              {change.to}
            </span>
          </div>
          {change.evidence && (
            <p className="mt-2 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
              <HugeIcon icon={ShieldCheckIcon} size="xs" />
              Preuve : {change.evidence}
            </p>
          )}
        </div>
      )}

      {otherEntries.length > 0 && (
        <dl className="mt-3 space-y-1 rounded-xl border border-border-button-default p-3">
          {otherEntries.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-caption-1-medium text-text-tertiary">{k}</dt>
              <dd className="max-w-[70%] truncate text-body-2-medium text-text-primary">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-separator-border pt-4">
        <span className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
          <HugeIcon icon={Database01Icon} size="xs" />
          {(row.sources ?? []).length} sources consultées · demandé {fmtDate(row.requested_at)}
          {row.decided_by && <> · décidée par {row.decided_by}</>}
        </span>
        <div className="flex-1" />
        {row.status === 'pending' ? (
          <>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={adaptIcon(Cancel01Icon, 18)}
              disabled={busy}
              onClick={() => onDecide(row, 'rejected')}
            >
              Rejeter
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={adaptIcon(PencilEdit01Icon, 18)}
              onClick={() => pushToast('Modification de la demande : disponible avec l\'édition d\'actions.', 'info')}
            >
              Modifier
            </Button>
            <Button
              size="small"
              leadingIcon={adaptIcon(CheckmarkCircle02Icon, 18)}
              disabled={busy}
              onClick={() => onDecide(row, 'approved')}
            >
              {busy ? 'Enregistrement…' : 'Approuver'}
            </Button>
          </>
        ) : (
          <p className="text-caption-1-medium text-text-tertiary">
            Décision enregistrée — visible dans le journal d'activité.
          </p>
        )}
      </div>
    </Card>
  )
}
