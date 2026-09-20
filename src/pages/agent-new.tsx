import { useEffect, useMemo, useState } from 'react'
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
  MoneyIcon,
} from '@/lib/icons'
import { api, type AgentCatalog } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const STEPS = ['Identité', 'Accès mémoire', 'Compétences', 'Outils', 'Autonomie', 'Budget'] as const

const AUTONOMY_OPTIONS: { id: string; name: string; detail: string }[] = [
  { id: 'assistant', name: 'ASSISTANT', detail: 'Recommande des actions mais ne les exécute pas.' },
  { id: 'copilot', name: 'COPILOTE', detail: 'Prépare des actions et demande une validation lorsque nécessaire.' },
  { id: 'autopilot', name: 'PILOTE AUTO', detail: 'Exécute les actions pré-autorisées dans les limites définies.' },
]

const MIN_TOKENS = 1000
const MAX_TOKENS = 2_000_000

export function NewAgentPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [scopes, setScopes] = useState<string[]>(['company'])
  const [skills, setSkills] = useState<string[]>([])
  const [tools, setTools] = useState<string[]>(['search_memory'])
  const [autonomy, setAutonomy] = useState('copilot')
  const [maxTokens, setMaxTokens] = useState('20000')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.agentCatalog().then((c) => {
      if (!c) setCatalogError('Catalogue indisponible — impossible de charger les skills et outils réels.')
      else setCatalog(c)
    })
  }, [])

  const scopeOptions = useMemo(
    () =>
      catalog
        ? [...catalog.memoryScopes.global, ...catalog.memoryScopes.departments, ...catalog.memoryScopes.roles]
        : [],
    [catalog],
  )
  const skillOptions = catalog?.skills ?? []
  const toolOptions = catalog?.tools ?? []

  const step1Valid = name.trim().length > 1 && goal.trim().length >= 4
  const budgetValid = Number.isFinite(Number(maxTokens)) && Number(maxTokens) >= MIN_TOKENS && Number(maxTokens) <= MAX_TOKENS
  const canCreate = step1Valid && budgetValid && !submitting

  async function create() {
    if (!canCreate) return
    setError(null)
    setSubmitting(true)
    const res = await api.createAgent({
      name: name.trim(),
      description: description.trim() || undefined,
      goal: goal.trim(),
      autonomy,
      memoryScopes: scopes,
      allowedSkills: skills,
      allowedTools: tools,
      maxRunTokens: Math.floor(Number(maxTokens)),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    pushToast(`${res.data.agent.name} créé — statut : inactif jusqu'à sa première tâche.`, 'success')
    navigate(`/agents/${res.data.agent.id}`)
  }

  const catalogueAttente = (
    <p className="text-body-2-medium text-text-tertiary">Chargement du catalogue réel…</p>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Créer un agent" subtitle="Un agent hérite de la mémoire autorisée — jamais plus." />

      {catalogError && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {catalogError}
        </div>
      )}

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
              L'agent ne verra que les périmètres autorisés ci-dessous — les périmètres réels de votre
              organisation.
            </p>
            {catalog === null ? (
              catalogueAttente
            ) : (
              scopeOptions.map((s) => (
                <CheckboxCard
                  key={s.id}
                  title={s.label}
                  isSelected={scopes.includes(s.id)}
                  onChange={(v) => setScopes((list) => (v ? [...list, s.id] : list.filter((x) => x !== s.id)))}
                />
              ))
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={SparklesIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Compétences</h2>
            </div>
            <p className="text-body-2-regular text-text-secondary">
              Chaque compétence est un workflow réel — une compétence non cochée ne pourra jamais être
              exécutée par cet agent.
            </p>
            {catalog === null ? (
              catalogueAttente
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {skillOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <AriaCheckbox
                      isSelected={skills.includes(s.id)}
                      onChange={(v) => setSkills((list) => (v ? [...list, s.id] : list.filter((x) => x !== s.id)))}
                      aria-label={s.label}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-body-2-medium text-text-primary">{s.label}</span>
                      <span className="block truncate text-caption-1-medium text-text-tertiary">{s.id}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={ToolsIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Outils</h2>
            </div>
            <p className="text-body-2-regular text-text-secondary">
              Chaque outil est policy-gated : même autorisé, un outil à risque exige une validation
              humaine. L'agent ne peut pas en utiliser d'autres.
            </p>
            {catalog === null ? (
              catalogueAttente
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {toolOptions.map((t) => (
                  <label key={t.id} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <AriaCheckbox
                      isSelected={tools.includes(t.id)}
                      onChange={(v) => setTools((list) => (v ? [...list, t.id] : list.filter((x) => x !== t.id)))}
                      aria-label={t.label}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-body-2-medium text-text-primary">{t.label}</span>
                      <span className="block truncate text-caption-1-medium text-text-tertiary">{t.id}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
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
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <HugeIcon icon={MoneyIcon} size="md" className="text-accent-500" />
              <h2 className="text-headline-medium text-text-primary">Budget &amp; garde-fous</h2>
            </div>
            <Input
              label="Budget maximum par run (tokens)"
              value={maxTokens}
              onChange={setMaxTokens}
              placeholder={`entre ${MIN_TOKENS.toLocaleString('fr-FR')} et ${MAX_TOKENS.toLocaleString('fr-FR')}`}
            />
            {!budgetValid && (
              <p className="text-caption-1-medium text-text-error-primary">
                Le budget doit être un entier entre {MIN_TOKENS.toLocaleString('fr-FR')} et{' '}
                {MAX_TOKENS.toLocaleString('fr-FR')}.
              </p>
            )}
            <div className="rounded-xl bg-background-secondary-default p-3.5">
              <p className="flex items-center gap-2 text-caption-1-semibold text-text-secondary">
                <HugeIcon icon={ShieldCheckIcon} size="xs" />
                Garde-fous non négociables
              </p>
              <ul className="mt-1.5 space-y-1 text-caption-1-medium text-text-tertiary">
                <li>· Un plafond quotidien de tokens s'applique en plus du budget par run.</li>
                <li>· Les outils à risque passent toujours par la validation humaine (policy layer).</li>
                <li>· L'agent ne peut jamais élargir ses propres permissions.</li>
              </ul>
            </div>
          </section>
        )}
      </Card>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

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
          <Button onClick={() => void create()} disabled={!canCreate}>
            {submitting ? 'Création…' : 'Créer l\'agent'}
          </Button>
        )}
      </div>
    </div>
  )
}
