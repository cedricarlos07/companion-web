import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Modal } from '@/components/common/modal'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  ArrowRight02Icon,
  BotIcon,
  BoltIcon,
  FilterIcon,
  PlusSignIcon,
  WorkflowIcon,
} from '@/lib/icons'
import { AUTOMATIONS } from '@/data/workspace'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const EVENT_TEMPLATES = [
  'Le statut d\'un employé devient « En départ »',
  'Le risque de connaissance dépasse 80 %',
  'Un nouvel employé arrive',
  'Une nouvelle source est importée',
]
const THEN_TEMPLATES = [
  'Démarrer le Handover Agent',
  'Créer une tâche de capture de connaissance',
  'Générer un parcours d\'intégration',
  'Faire analyser la source par le Knowledge Agent',
]

export function AutomationsPage() {
  const { pushToast } = useAppStore()
  const [automations, setAutomations] = useState(AUTOMATIONS)
  const [realTriggers, setRealTriggers] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    api.request<{ triggers: Record<string, unknown>[] }>('/triggers').then((res) => {
      if (res?.triggers && res.triggers.length > 0) setRealTriggers(res.triggers)
    })
  }, [])
  const [builderOpen, setBuilderOpen] = useState(false)
  const [event, setEvent] = useState(EVENT_TEMPLATES[0])
  const [condition, setCondition] = useState('')
  const [action, setAction] = useState(THEN_TEMPLATES[0])

  function toggle(id: string) {
    setAutomations((list) =>
      list.map((a) =>
        a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a,
      ),
    )
  }

  function createAutomation() {
    setAutomations((list) => [
      {
        id: `auto-${Date.now()}`,
        event,
        condition: condition.trim() || undefined,
        action,
        agentName: action.includes('Handover')
          ? 'Handover Agent'
          : action.includes('intégration')
            ? 'Onboarding Agent'
            : 'Knowledge Agent',
        status: 'active',
        runs: 0,
        lastRun: '—',
      },
      ...list,
    ])
    setBuilderOpen(false)
    pushToast('Automatisation créée et activée.')
  }

  return (
    <div>
      <PageHeader
        title="Automatisations"
        subtitle="Définissez quand Companion doit agir."
        actions={
          <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => setBuilderOpen(true)}>
            Nouvelle automation
          </Button>
        }
      />

      {realTriggers.length > 0 && (
        <Card title="Triggers actifs (événements réels)" className="mb-4">
          <ul className="grid gap-2 sm:grid-cols-2">
            {realTriggers.map((t) => (
              <li key={String(t.id)} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                <HugeIcon icon={BoltIcon} size="xs" className="shrink-0 text-accent-500" />
                <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{String(t.event_type)}</span>
                <span className="shrink-0 text-caption-1-medium text-text-tertiary">{String(t.agent_key)}</span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-caption-2-medium ${t.enabled ? 'bg-status-lime-background text-status-lime-text' : 'bg-background-tertiary-default text-text-secondary'}`}>
                  {t.enabled ? 'ON' : 'OFF'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="space-y-3">
        {automations.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-2 py-1 text-caption-1-semibold text-text-secondary uppercase">
                <HugeIcon icon={BoltIcon} size="xs" />
                Quand
              </span>
              <span className="text-body-2-medium text-text-primary">{a.event}</span>
              {a.condition && (
                <>
                  <span className="flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-2 py-1 text-caption-1-semibold text-text-secondary uppercase">
                    <HugeIcon icon={FilterIcon} size="xs" />
                    Si
                  </span>
                  <span className="text-body-2-medium text-text-primary">{a.condition}</span>
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-accent-50 px-2 py-1 text-caption-1-semibold text-accent-700 uppercase">
                <HugeIcon icon={ArrowRight02Icon} size="xs" />
                Alors
              </span>
              <span className="text-body-2-medium text-text-primary">{a.action}</span>
              <span className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
                <HugeIcon icon={BotIcon} size="xs" />
                {a.agentName}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-separator-border pt-3">
              <p className="text-caption-1-medium text-text-tertiary">
                {a.runs} exécution{a.runs > 1 ? 's' : ''} · dernière : {a.lastRun}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'rounded-md px-1.5 py-1 text-caption-1-medium',
                    a.status === 'active'
                      ? 'bg-status-lime-background text-status-lime-text'
                      : 'bg-background-tertiary-default text-text-secondary',
                  )}
                >
                  {a.status === 'active' ? 'Active' : 'En pause'}
                </span>
                <Button variant="secondary" size="xs" onClick={() => toggle(a.id)}>
                  {a.status === 'active' ? 'Mettre en pause' : 'Activer'}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card className="mt-5">
        <div className="flex items-start gap-3">
          <HugeIcon icon={WorkflowIcon} size="md" className="mt-0.5 shrink-0 text-accent-500" />
          <p className="text-body-2-regular text-text-secondary">
            V1 : conditions simples Quand / Si / Alors. Les scénarios multi-étapes passeront par les agents
            eux-mêmes, pas par un graphique de nœuds.
          </p>
        </div>
      </Card>

      {/* Builder */}
      <Modal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title="Nouvelle automatisation"
        footer={
          <>
            <Button variant="secondary" size="small" onClick={() => setBuilderOpen(false)}>
              Annuler
            </Button>
            <Button size="small" onClick={createAutomation}>
              Créer l'automatisation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-caption-1-semibold text-text-secondary uppercase">
              <HugeIcon icon={BoltIcon} size="xs" /> Quand
            </p>
            <BuilderSelect
              ariaLabel="Événement déclencheur"
              value={event}
              onChange={setEvent}
              items={EVENT_TEMPLATES.map((e) => ({ id: e, label: e }))}
            />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-caption-1-semibold text-text-secondary uppercase">
              <HugeIcon icon={FilterIcon} size="xs" /> Si (optionnel)
            </p>
            <Input value={condition} onChange={setCondition} placeholder="ex. le rôle est critique" />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-caption-1-semibold text-accent-700 uppercase">
              <HugeIcon icon={ArrowRight02Icon} size="xs" /> Alors
            </p>
            <BuilderSelect
              ariaLabel="Action à déclencher"
              value={action}
              onChange={setAction}
              items={THEN_TEMPLATES.map((e) => ({ id: e, label: e }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function BuilderSelect({
  ariaLabel,
  value,
  onChange,
  items,
}: {
  ariaLabel: string
  value: string
  onChange: (v: string) => void
  items: { id: string; label: string }[]
}) {
  const current = items.find((i) => i.id === value)
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k))}
      items={items}
      className="w-full"
      renderValue={<span className="truncate text-body-medium">{current?.label}</span>}
    >
      {(item) => (
        <SelectItem key={item.id} id={item.id} textValue={item.label}>
          {item.label}
        </SelectItem>
      )}
    </Select>
  )
}
