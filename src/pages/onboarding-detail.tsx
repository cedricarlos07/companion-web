import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  AiBrain01Icon,
  AiChat02Icon,
  CheckmarkCircle02Icon,
  Folder01Icon,
  GavelIcon,
  HandshakeIcon,
  HierarchyIcon,
  TaskIcon,
  UserGroupIcon,
  FileValidationIcon,
  ArrowRight02Icon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const SECTION_ICONS: Record<string, typeof HierarchyIcon> = {
  role: HierarchyIcon,
  customers: HandshakeIcon,
  procedures: FileValidationIcon,
  projects: Folder01Icon,
  people: UserGroupIcon,
  decisions: GavelIcon,
  tasks: TaskIcon,
  check: CheckmarkCircle02Icon,
  ask: AiChat02Icon,
}

interface PlanSection {
  id: string
  phase: string
  title: string
  detail: string
  icon: string
  items: string[]
  from: string
}

interface Plan {
  employee?: string
  role?: string
  readiness?: number
  sections?: PlanSection[]
  generatedAt?: string
  doneItems?: string[]
}

interface OnboardingRow {
  id: string
  plan: Plan
  employee_name: string
  role_title: string | null
  employee_id: string
}

export function OnboardingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [row, setRow] = useState<OnboardingRow | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const res = await api.onboarding(id)
    if (res === null || !res.onboarding) {
      setNotFound(true)
      return
    }
    setRow(res.onboarding as unknown as OnboardingRow)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleStep(sectionId: string) {
    if (!id || busyKey) return
    const doneItems = row?.plan?.doneItems ?? []
    const isDone = doneItems.includes(sectionId)
    setBusyKey(sectionId)
    const res = await fetch(`/api/onboardings/${id}/progress`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: sectionId, done: !isDone }),
    })
    setBusyKey(null)
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      pushToast(body?.error ?? 'Progression impossible.', 'error')
      return
    }
    pushToast(isDone ? 'Section réouverte.' : 'Section terminée — progression enregistrée.', 'success')
    await load()
  }

  if (notFound) {
    return (
      <EmptyState
        title="Parcours d'intégration introuvable."
        action={<Button onClick={() => navigate('/onboarding')}>Retour aux onboardings</Button>}
      />
    )
  }
  if (!row) {
    return <EmptyState title="Chargement du parcours…" />
  }

  const plan = row.plan ?? {}
  const sections = plan.sections ?? []
  const doneItems = plan.doneItems ?? []
  const progress = sections.length > 0 ? Math.round((doneItems.length / sections.length) * 100) : 0
  const employeeName = row.employee_name || plan.employee || 'Employé'
  const firstName = employeeName.split(' ')[0]

  return (
    <div>
      <PageHeader
        title={`Bienvenue ${firstName}`}
        subtitle="Voici ce que vous devez savoir pour reprendre votre rôle."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate('/onboarding')} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Intégration
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{employeeName}</span>
          </nav>
        }
        actions={
          <span className="flex items-center gap-2">
            <PersonAvatar name={employeeName} size="sm" />
            <span className="text-caption-1-medium text-text-secondary">{row.role_title || plan.role}</span>
          </span>
        }
      />

      <Card className="mb-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <ProgressRow label="Progression du parcours" value={progress} tone={progress >= 80 ? 'success' : 'default'} />
            <p className="mt-2 text-caption-1-medium text-text-tertiary">
              {doneItems.length} / {sections.length} sections complétées · construit depuis le Role Brain,
              le handover du prédécesseur et le Company Brain.
            </p>
          </div>
          <Button
            variant="secondary"
            leadingIcon={adaptIcon(AiChat02Icon, 20)}
            onClick={() => navigate('/ask')}
          >
            Demander à Companion
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {sections.map((s) => {
          const isDone = doneItems.includes(s.id)
          const Icon = SECTION_ICONS[s.icon] ?? HierarchyIcon
          const busy = busyKey === s.id
          return (
            <div
              key={s.id}
              className={cx(
                'rounded-2xl border bg-background-primary-default p-4 shadow-card transition-colors',
                isDone ? 'border-emerald-200' : 'border-border-button-default',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cx(
                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                    isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-background-secondary-default text-foreground-icon-secondary',
                  )}
                >
                  <HugeIcon icon={isDone ? CheckmarkCircle02Icon : Icon} size="md" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-headline-medium text-text-primary">{s.title}</h2>
                    <span className="rounded-md bg-background-secondary-default px-1.5 py-0.5 text-caption-1-medium text-text-secondary">
                      {s.phase}
                    </span>
                    {isDone && (
                      <span className="rounded-md bg-status-lime-background px-1.5 py-0.5 text-caption-1-medium text-status-lime-text">
                        Terminé
                      </span>
                    )}
                  </div>
                  <p className="text-caption-1-medium text-text-secondary">{s.detail}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-body-2-regular text-text-primary">
                        <HugeIcon icon={ArrowRight02Icon} size="xs" className="mt-1 shrink-0 text-foreground-icon-quaternary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-caption-1-medium text-text-tertiary">Source : {s.from}</p>
                </div>
                <Button
                  variant={isDone ? 'secondary' : 'primary'}
                  size="xs"
                  disabled={busy}
                  onClick={() => void toggleStep(s.id)}
                >
                  {busy ? '…' : isDone ? 'Réouvrir' : 'Marquer terminé'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <Card className="mt-5">
        <div className="flex items-start gap-3">
          <HugeIcon icon={AiBrain01Icon} size="md" className="mt-0.5 shrink-0 text-accent-500" />
          <div>
            <p className="text-body-medium font-medium text-text-primary">Une question sur le poste ?</p>
            <p className="text-body-2-regular text-text-secondary">
              Toute la mémoire du rôle est disponible — demandez à Companion au lieu d'interrompre vos
              collègues.
            </p>
            <Button size="xs" className="mt-2" onClick={() => navigate('/ask')}>
              Ouvrir Ask Companion
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
