import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Textarea } from '@/components/base/textarea/textarea'
import { CheckboxCard } from '@/components/base/checkbox/checkbox-card'
import { Checkbox as AriaCheckbox } from '@/components/base/checkbox/checkbox'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  BotIcon,
  Database01Icon,
  ShieldCheckIcon,
  SparklesIcon,
  CheckmarkCircle02Icon,
  ArrowLeft01Icon,
  ToolsIcon,
  WorkflowIcon,
} from '@/lib/icons'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'
import type { AutonomyLevel } from '@/types'

const STEPS = ['Identité', 'Accès mémoire', 'Compétences', 'Outils', 'Autonomie', 'Permissions'] as const

const AUTONOMY_OPTIONS: { id: AutonomyLevel; name: string; detail: string }[] = [
  { id: 'assistant', name: 'ASSISTANT', detail: 'Recommande des actions mais ne les exécute pas.' },
  { id: 'copilot', name: 'COPILOTE', detail: 'Prépare des actions et demande une validation lorsque nécessaire.' },
  { id: 'autopilot', name: 'PILOTE AUTO', detail: 'Exécute les actions pré-autorisées dans les limites définies.' },
]

const SKILLS = [
  'Contexte client',
  'Préparation d’emails',
  'Suivi de pipeline',
  'Préparation d’appels d’offres',
  'Extraction de connaissances',
  'Veille de procédures',
]

const TOOLS = ['CRM', 'Gmail', 'Calendar', 'Google Drive', 'Notion', 'Fichiers locaux']

const ACCESS_SCOPES = [
  { id: 'company', label: 'Entreprise entière' },
  { id: 'sales', label: 'Département Commercial' },
  { id: 'role-brain', label: 'Role Brain — Commercial' },
  { id: 'finance', label: 'Finance' },
  { id: 'hr', label: 'RH' },
]

const PERMISSIONS = [
  'Préparer un email',
  'Créer une tâche',
  'Mettre à jour le CRM',
  'Envoyer un email',
  'Supprimer des données',
  'Signer un contrat',
]

export function NewAgentPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [access, setAccess] = useState<Record<string, boolean>>({
    company: true,
    sales: true,
    'role-brain': true,
    finance: false,
    hr: false,
  })
  const [skills, setSkills] = useState<string[]>(['Contexte client', 'Préparation d’emails'])
  const [tools, setTools] = useState<string[]>(['CRM', 'Gmail'])
  const [autonomy, setAutonomy] = useState<AutonomyLevel>('copilot')
  const [perms, setPerms] = useState<Record<string, 'automatic' | 'approval' | 'blocked'>>({
    'Préparer un email': 'automatic',
    'Créer une tâche': 'automatic',
    'Mettre à jour le CRM': 'automatic',
    'Envoyer un email': 'approval',
    'Supprimer des données': 'blocked',
    'Signer un contrat': 'blocked',
  })

  const step1Valid = name.trim().length > 1

  function create() {
    pushToast(`${name || 'Nouvel agent'} créé — statut : inactif jusqu'à sa première tâche.`)
    navigate('/agents')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Créer un agent" subtitle="Un agent hérite de la mémoire autorisée — jamais plus." />

      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-1.5" aria-label="Étapes de création">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cx(
                'rounded-full border px-3 py-1 text-caption-1-medium transition-colors',
                i === step
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : i < step
                    ? 'border-border-button-default text-text-secondary'
                    : 'border-border-button-default text-text-tertiary',
              )}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        {step === 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={BotIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Identité de l'agent</h2>
            </div>
            <Input label="Nom de l'agent" value={name} onChange={setName} placeholder="ex. Support Agent" />
            <Input
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Ce que fait l'agent au quotidien"
            />
            <Textarea
              label="Objectif"
              value={goal}
              onChange={setGoal}
              placeholder="ex. Assister l'équipe support avec la mémoire des procédures validées"
              rows={3}
            />
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={Database01Icon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Accès à la mémoire</h2>
            </div>
            <p className="text-body-2-regular text-text-secondary">
              L'agent ne verra que les périmètres autorisés ci-dessous.
            </p>
            {ACCESS_SCOPES.map((s) => (
              <CheckboxCard
                key={s.id}
                title={s.label}
                isSelected={access[s.id]}
                onChange={(v) => setAccess((a) => ({ ...a, [s.id]: v }))}
              />
            ))}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={SparklesIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Compétences</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SKILLS.map((s) => (
                <label key={s} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <AriaCheckbox
                    isSelected={skills.includes(s)}
                    onChange={(v) => setSkills((list) => (v ? [...list, s] : list.filter((x) => x !== s)))}
                    aria-label={s}
                  />
                  <span className="text-body-2-medium text-text-primary">{s}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={ToolsIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Outils</h2>
            </div>
            <p className="text-body-2-regular text-text-secondary">
              Chaque outil est une intégration réelle — l'agent ne peut pas en utiliser d'autres.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOOLS.map((t) => (
                <label key={t} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <AriaCheckbox
                    isSelected={tools.includes(t)}
                    onChange={(v) => setTools((list) => (v ? [...list, t] : list.filter((x) => x !== t)))}
                    aria-label={t}
                  />
                  <span className="text-body-2-medium text-text-primary">{t}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={WorkflowIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Autonomie</h2>
            </div>
            {AUTONOMY_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setAutonomy(o.id)}
                aria-pressed={autonomy === o.id}
                className={cx(
                  'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                  autonomy === o.id
                    ? 'border-accent-500 bg-accent-50/50 ring-1 ring-accent-500'
                    : 'border-border-button-default hover:bg-background-primary-hover',
                )}
              >
                <span
                  className={cx(
                    'mt-0.5 rounded-md px-1.5 py-0.5 text-caption-2-semibold',
                    o.id === 'autopilot'
                      ? 'bg-purple-100 text-purple-700'
                      : o.id === 'copilot'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-background-tertiary-default text-text-secondary',
                  )}
                >
                  {o.name}
                </span>
                <span className="min-w-0 flex-1 text-body-2-regular text-text-secondary">{o.detail}</span>
                {autonomy === o.id && <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="shrink-0 text-accent-600" />}
              </button>
            ))}
          </section>
        )}

        {step === 5 && (
          <section className="space-y-2">
            <div className="mb-3 flex items-center gap-2.5">
              <HugeIcon icon={ShieldCheckIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Permissions d'action</h2>
            </div>
            {PERMISSIONS.map((p) => (
              <div
                key={p}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border-button-default px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1 text-body-2-medium text-text-primary">{p}</span>
                <div className="flex gap-1">
                  {(['automatic', 'approval', 'blocked'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPerms((m) => ({ ...m, [p]: mode }))}
                      aria-pressed={perms[p] === mode}
                      className={cx(
                        'rounded-md px-2 py-1 text-caption-1-medium transition-colors',
                        perms[p] === mode
                          ? mode === 'automatic'
                            ? 'bg-status-lime-background text-status-lime-text'
                            : mode === 'approval'
                              ? 'bg-status-yellow-background text-status-yellow-text'
                              : 'bg-status-rose-background text-status-rose-text'
                          : 'text-text-tertiary hover:bg-background-primary-hover',
                      )}
                    >
                      {mode === 'automatic' ? 'Automatique' : mode === 'approval' ? 'Validation' : 'Bloqué'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          leadingIcon={adaptIcon(ArrowLeft01Icon, 20)}
          onClick={() => (step === 0 ? navigate('/agents') : setStep((s) => s - 1))}
        >
          {step === 0 ? 'Annuler' : 'Retour'}
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !step1Valid}>
            Continuer
          </Button>
        ) : (
          <Button onClick={create}>Créer l'agent</Button>
        )}
      </div>
    </div>
  )
}
