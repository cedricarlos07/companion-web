import { useState } from 'react'
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
import { getOnboarding } from '@/data/continuity'
import { cx } from '@/utils/cx'

const SECTION_ICONS = {
  role: HierarchyIcon,
  customers: HandshakeIcon,
  procedures: FileValidationIcon,
  projects: Folder01Icon,
  people: UserGroupIcon,
  decisions: GavelIcon,
  tasks: TaskIcon,
  check: CheckmarkCircle02Icon,
  ask: AiChat02Icon,
} as const

export function OnboardingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const onboarding = id ? getOnboarding(id) : undefined
  const [doneSections, setDoneSections] = useState<string[]>(
    onboarding ? onboarding.sections.filter((s) => s.done).map((s) => s.id) : [],
  )

  if (!onboarding) {
    return (
      <EmptyState
        title="Parcours d'intégration introuvable."
        action={<Button onClick={() => navigate('/onboarding')}>Retour aux onboardings</Button>}
      />
    )
  }

  const progress = Math.round((doneSections.length / onboarding.sections.length) * 100)
  const firstName = onboarding.employeeName.split(' ')[0]

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
            <span className="text-text-secondary">{onboarding.employeeName}</span>
          </nav>
        }
        actions={
          <span className="flex items-center gap-2">
            <PersonAvatar name={onboarding.employeeName} size="sm" />
            <span className="text-caption-1-medium text-text-secondary">
              {onboarding.roleTitle} · arrive le {onboarding.startDate}
            </span>
          </span>
        }
      />

      <Card className="mb-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <ProgressRow label="Progression du parcours" value={progress} tone={progress >= 80 ? 'success' : 'default'} />
            <p className="mt-2 text-caption-1-medium text-text-tertiary">
              {doneSections.length} / {onboarding.sections.length} sections complétées · construit depuis le
              Role Brain, le handover de Moussa et le Company Brain.
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
        {onboarding.sections.map((s) => {
          const isDone = doneSections.includes(s.id)
          const Icon = SECTION_ICONS[s.icon]
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
                </div>
                <Button
                  variant={isDone ? 'secondary' : 'primary'}
                  size="xs"
                  onClick={() =>
                    setDoneSections((list) => (isDone ? list.filter((x) => x !== s.id) : [...list, s.id]))
                  }
                >
                  {isDone ? 'Réouvrir' : 'Marquer terminé'}
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
