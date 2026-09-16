import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { useAppStore } from '@/store/app-store'
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
import { formatNumber } from '@/lib/format'
import { cx } from '@/utils/cx'

const TABS = [
  { id: 'pending', label: 'En attente' },
  { id: 'approved', label: 'Approuvées' },
  { id: 'rejected', label: 'Rejetées' },
  { id: 'history', label: 'Historique' },
]

export function ApprovalsPage() {
  const { approvals, decideApproval, pushToast } = useAppStore()

  function decide(id: string, decision: 'approved' | 'rejected') {
    decideApproval(id, decision)
    pushToast(decision === 'approved' ? 'Action approuvée — l\'agent peut l\'exécuter.' : 'Demande rejetée — l\'agent en a été informé.', decision === 'approved' ? 'success' : 'info')
  }

  const pending = approvals.filter((a) => a.status === 'pending')
  const approved = approvals.filter((a) => a.status === 'approved')
  const rejected = approvals.filter((a) => a.status === 'rejected')

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

      <Tabs defaultSelectedKey="pending">
        <TabList aria-label="Statut des approbations">
          {TABS.map((t) => (
            <Tab key={t.id} id={t.id}>
              {t.label}
            </Tab>
          ))}
        </TabList>

        <TabPanel id="pending" className="pt-4">
          {pending.length === 0 ? (
            <EmptyState
              title="Aucune demande en attente."
              detail="Les agents travaillent dans les limites autorisées."
            />
          ) : (
            <div className="space-y-4">
              {pending.map((a) => (
                <ApprovalCard key={a.id} id={a.id} onDecide={decide} />
              ))}
            </div>
          )}
        </TabPanel>

        {(['approved', 'rejected'] as const).map((status) => (
          <TabPanel key={status} id={status} className="pt-4">
            {(status === 'approved' ? approved : rejected).length === 0 ? (
              <EmptyState
                title={status === 'approved' ? 'Aucune approbation pour le moment.' : 'Aucun rejet pour le moment.'}
              />
            ) : (
              <div className="space-y-4">
                {(status === 'approved' ? approved : rejected).map((a) => (
                  <ApprovalCard key={a.id} id={a.id} onDecide={decide} />
                ))}
              </div>
            )}
          </TabPanel>
        ))}

        <TabPanel id="history" className="pt-4">
          <Card>
            <ul className="space-y-2.5">
              {approvals.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-body-2-regular">
                  <span className="text-caption-1-medium text-text-tertiary">{a.requestedAt}</span>
                  <span className="min-w-0 flex-1 truncate text-text-primary">
                    {a.agentName} — {a.title}
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
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}

function ApprovalCard({
  id,
  onDecide,
}: {
  id: string
  onDecide: (id: string, decision: 'approved' | 'rejected') => void
}) {
  const { approvals, pushToast } = useAppStore()
  const approval = approvals.find((a) => a.id === id)
  if (!approval) return null
  const isPending = approval.status === 'pending'

  return (
    <Card
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-caption-1-semibold text-text-tertiary uppercase">
            <HugeIcon icon={BotIcon} size="xs" />
            {approval.agentName}
          </span>
          <span
            className={cx(
              'rounded px-1.5 py-0.5 text-caption-2-semibold',
              approval.kind === 'action'
                ? 'bg-accent-100 text-accent-700'
                : 'bg-purple-100 text-purple-700',
            )}
          >
            {approval.kind === 'action' ? "DEMANDE D'ACTION" : 'MISE À JOUR MÉMOIRE'}
          </span>
          <span
            className={cx(
              'rounded-md px-1.5 py-0.5 text-caption-1-medium',
              approval.status === 'pending'
                ? 'bg-status-yellow-background text-status-yellow-text'
                : approval.status === 'approved'
                  ? 'bg-status-lime-background text-status-lime-text'
                  : 'bg-status-rose-background text-status-rose-text',
            )}
          >
            {approval.status === 'pending' ? 'En attente' : approval.status === 'approved' ? 'Approuvée' : 'Rejetée'}
          </span>
        </div>
      }
    >
      <p className="text-headline-medium text-text-primary">{approval.title}</p>
      <p className="mt-1 text-body-2-regular text-text-secondary">
        <span className="font-medium text-text-tertiary">Raison : </span>
        {approval.reason}
      </p>

      {approval.emailPreview && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border-button-default">
          <div className="flex items-center gap-2 border-b border-separator-border bg-background-secondary-default px-3.5 py-2">
            <HugeIcon icon={Mail01Icon} size="xs" className="text-foreground-icon-tertiary" />
            <span className="text-caption-1-medium text-text-secondary">
              À : <span className="text-text-primary">{approval.emailPreview.to}</span> · Objet :{' '}
              <span className="text-text-primary">{approval.emailPreview.subject}</span>
            </span>
          </div>
          <p className="px-3.5 py-3 text-body-2-regular text-text-primary">{approval.emailPreview.body}</p>
        </div>
      )}

      {approval.memoryChange && (
        <div className="mt-3 rounded-xl border border-border-button-default p-3.5">
          <p className="text-caption-1-medium text-text-tertiary">{approval.memoryChange.label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-body-2-medium text-text-primary line-through">
              {approval.memoryChange.from}
            </span>
            <HugeIcon icon={ArrowRight02Icon} size="sm" className="text-accent-500" />
            <span className="rounded-lg bg-accent-50 px-2.5 py-1.5 text-body-2-medium font-medium text-accent-700">
              {approval.memoryChange.to}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
            <HugeIcon icon={ShieldCheckIcon} size="xs" />
            Preuve : {approval.memoryChange.evidence}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-separator-border pt-4">
        <span className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
          <HugeIcon icon={Database01Icon} size="xs" />
          {formatNumber(approval.sources)} sources consultées · demandé {approval.requestedAt}
        </span>
        <div className="flex-1" />
        {isPending ? (
          <>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={adaptIcon(Cancel01Icon, 18)}
              onClick={() => onDecide(approval.id, 'rejected')}
            >
              Rejeter
            </Button>
            <Button
              variant="secondary"
              size="small"
              leadingIcon={adaptIcon(PencilEdit01Icon, 18)}
              onClick={() => pushToast('Modification de la demande (démo).', 'info')}
            >
              Modifier
            </Button>
            <Button
              size="small"
              leadingIcon={adaptIcon(CheckmarkCircle02Icon, 18)}
              onClick={() => onDecide(approval.id, 'approved')}
            >
              Approuver
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
