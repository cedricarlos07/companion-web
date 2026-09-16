import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { FileDropZone } from '@/components/common/file-drop'
import {
  AiBrain01Icon,
  BotIcon,
  CheckmarkCircle02Icon,
  CloudIcon,
  Database01Icon,
  File01Icon,
  GoogleDriveIcon,
  GoogleGeminiIcon,
  HardDriveIcon,
  Mail01Icon,
  MicrosoftIcon,
  NotionIcon,
  ServerStack01Icon,
  ShieldUserIcon,
  SlackIcon,
  SparklesIcon,
  UserGroupIcon,
  WhatsappIcon,
} from '@/lib/icons'
import { useAppStore } from '@/store/app-store'

const STEPS = ['Organisation', 'Intelligence', 'Sources', 'Équipe', 'Terminé'] as const

const SECTORS = ['Services professionnels', 'Assurance', 'Fintech', 'Banque', 'Logistique', 'Distribution', 'BTP', 'ONG']
const COUNTRIES = ["Côte d'Ivoire", 'Sénégal', 'Cameroun', 'Bénin', 'Togo', 'Burkina Faso', 'Mali', 'Gabon']
const SIZES = ['20–50', '50–100', '100–250', '250–500']
const LANGS = ['Français', 'Anglais']

const PROVIDERS = [
  { id: 'ollama', name: 'Ollama', detail: 'Modèles locaux — vos données restent sur votre instance.', icon: ServerStack01Icon, local: true },
  { id: 'openai', name: 'OpenAI', detail: 'Clé API OpenAI.', icon: SparklesIcon, local: false },
  { id: 'anthropic', name: 'Anthropic', detail: 'Clé API Anthropic.', icon: CloudIcon, local: false },
  { id: 'gemini', name: 'Gemini', detail: 'Clé API Google.', icon: GoogleGeminiIcon, local: false },
  { id: 'compatible', name: 'OpenAI Compatible', detail: 'Tout point de terminaison compatible OpenAI.', icon: BotIcon, local: false },
]

const SOURCE_CARDS = [
  { id: 'local', name: 'Fichiers locaux', icon: HardDriveIcon, available: true },
  { id: 'drive', name: 'Google Drive', icon: GoogleDriveIcon, available: true },
  { id: 'gmail', name: 'Gmail', icon: Mail01Icon, available: true },
  { id: 'm365', name: 'Microsoft 365', icon: MicrosoftIcon, available: true },
  { id: 'notion', name: 'Notion', icon: NotionIcon, available: true },
  { id: 'slack', name: 'Slack', icon: SlackIcon, available: true },
  { id: 'whatsapp', name: 'WhatsApp Business', icon: WhatsappIcon, available: false },
  { id: 'crm', name: 'CRM', icon: Database01Icon, available: true },
  { id: 'erp', name: 'ERP', icon: File01Icon, available: false },
]

interface InviteRow {
  name: string
  email: string
  role: string
  department: string
}

export function SetupPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [step, setStep] = useState(0)

  // Step 1
  const [name, setName] = useState('Kamaloka AI')
  const [sector, setSector] = useState('Services professionnels')
  const [country, setCountry] = useState("Côte d'Ivoire")
  const [size, setSize] = useState('50–100')
  const [lang, setLang] = useState('Français')
  const step1Valid = name.trim().length > 1

  // Step 2
  const [provider, setProvider] = useState('ollama')

  // Step 3
  const [selectedSources, setSelectedSources] = useState<string[]>(['local', 'drive', 'gmail'])

  // Step 4
  const [invites, setInvites] = useState<InviteRow[]>([
    { name: '', email: '', role: 'Employé', department: '' },
  ])

  function toggleSource(id: string) {
    setSelectedSources((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function next() {
    if (step === 0 && !step1Valid) return
    if (step === 3) {
      const valid = invites.filter((i) => i.email.includes('@'))
      if (valid.length > 0) pushToast(`${valid.length} invitation(s) prête(s) à être envoyée(s).`)
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full">
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {/* Stepper */}
        <ol className="mb-8 flex items-center gap-2" aria-label="Progression de la configuration">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cx(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-caption-1-semibold',
                  i < step
                    ? 'bg-accent-500 text-white'
                    : i === step
                      ? 'border-2 border-accent-500 text-accent-600'
                      : 'border border-border-button-default text-text-tertiary',
                )}
                aria-current={i === step ? 'step' : undefined}
              >
                {i < step ? <HugeIcon icon={CheckmarkCircle02Icon} size="xs" /> : i + 1}
              </span>
              <span
                className={cx(
                  'hidden text-body-2-medium sm:block',
                  i === step ? 'text-text-primary' : 'text-text-tertiary',
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-separator-border" aria-hidden />}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
          {step === 0 && (
            <section>
              <h1 className="text-title-2-medium text-text-primary">Votre organisation</h1>
              <p className="mt-1 mb-6 text-body-2-regular text-text-secondary">
                Companion adapte sa mémoire au contexte de votre entreprise.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input label="Nom de l'entreprise" value={name} onChange={setName} />
                </div>
                <WizardSelect
                  label="Secteur"
                  value={sector}
                  onChange={setSector}
                  items={SECTORS.map((s) => ({ id: s, label: s }))}
                />
                <WizardSelect
                  label="Pays"
                  value={country}
                  onChange={setCountry}
                  items={COUNTRIES.map((s) => ({ id: s, label: s }))}
                />
                <WizardSelect
                  label="Nombre d'employés"
                  value={size}
                  onChange={setSize}
                  items={SIZES.map((s) => ({ id: s, label: s }))}
                />
                <WizardSelect
                  label="Langue principale"
                  value={lang}
                  onChange={setLang}
                  items={LANGS.map((s) => ({ id: s, label: s }))}
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="text-title-2-medium text-text-primary">Fournisseur d'intelligence</h1>
              <p className="mt-1 mb-2 text-body-2-regular text-text-secondary">
                Choisissez le moteur d'analyse de votre mémoire.
              </p>
              <p className="mb-5 flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-3 py-2 text-caption-1-medium text-text-secondary">
                <HugeIcon icon={ShieldUserIcon} size="xs" className="shrink-0 text-emerald-600" />
                Vos identifiants de fournisseur restent dans votre instance Companion.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    aria-pressed={provider === p.id}
                    className={cx(
                      'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                      provider === p.id
                        ? 'border-accent-500 bg-accent-50/50 ring-1 ring-accent-500'
                        : 'border-border-button-default hover:bg-background-primary-hover',
                    )}
                  >
                    <HugeIcon icon={p.icon} size="md" className="mt-0.5 shrink-0 text-foreground-icon-secondary" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-body-medium font-medium text-text-primary">{p.name}</span>
                        {p.local && (
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-caption-2-semibold text-emerald-700">
                            Local
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-caption-1-medium text-text-secondary">{p.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-title-2-medium text-text-primary">Sources de connaissances</h1>
              <p className="mt-1 mb-6 text-body-2-regular text-text-secondary">
                Sélectionnez les sources à connecter. Vous pourrez en ajouter d'autres plus tard.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {SOURCE_CARDS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!s.available}
                    onClick={() => toggleSource(s.id)}
                    aria-pressed={selectedSources.includes(s.id)}
                    className={cx(
                      'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors',
                      !s.available && 'cursor-not-allowed opacity-55',
                      selectedSources.includes(s.id)
                        ? 'border-accent-500 bg-accent-50/50'
                        : 'border-border-button-default hover:bg-background-primary-hover',
                    )}
                  >
                    <HugeIcon icon={s.icon} size="sm" className="shrink-0 text-foreground-icon-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-2-medium text-text-primary">{s.name}</span>
                      {!s.available && (
                        <span className="block text-caption-2-medium text-text-tertiary">Bientôt disponible</span>
                      )}
                    </span>
                    {selectedSources.includes(s.id) && (
                      <HugeIcon icon={CheckmarkCircle02Icon} size="xs" className="shrink-0 text-accent-600" />
                    )}
                  </button>
                ))}
              </div>
              {selectedSources.includes('local') && (
                <div className="mt-5">
                  <p className="mb-2 text-body-2-medium text-text-primary">Premiers documents à importer</p>
                  <FileDropZone
                    hint="Procédures, comptes-rendus et notes internes"
                    onComplete={(name) => pushToast(`${name} ajouté à l'analyse.`)}
                  />
                </div>
              )}
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="text-title-2-medium text-text-primary">Votre équipe</h1>
              <p className="mt-1 mb-6 text-body-2-regular text-text-secondary">
                Invitez vos collaborateurs. Companion construira progressivement leur mémoire de poste.
              </p>
              <div className="space-y-3">
                {invites.map((row, i) => (
                  <div
                    key={i}
                    className="grid items-end gap-2 rounded-xl border border-border-button-default p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
                  >
                    <Input
                      label="Nom"
                      value={row.name}
                      onChange={(v) =>
                        setInvites((list) => list.map((r, j) => (j === i ? { ...r, name: v } : r)))
                      }
                      placeholder="Awa Traoré"
                    />
                    <Input
                      label="Email"
                      value={row.email}
                      onChange={(v) =>
                        setInvites((list) => list.map((r, j) => (j === i ? { ...r, email: v } : r)))
                      }
                      placeholder="awa@kamaloka.ci"
                    />
                    <WizardSelect
                      label="Rôle"
                      value={row.role}
                      onChange={(v) => setInvites((list) => list.map((r, j) => (j === i ? { ...r, role: v } : r)))}
                      items={['Administrateur', 'Manager', 'Employé'].map((s) => ({ id: s, label: s }))}
                    />
                    <div className="pb-1">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setInvites((l) => l.filter((_, j) => j !== i))}
                        disabled={invites.length === 1}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="small"
                className="mt-3"
                leadingIcon={adaptIcon(UserGroupIcon, 18)}
                onClick={() =>
                  setInvites((l) => [...l, { name: '', email: '', role: 'Employé', department: '' }])
                }
              >
                Ajouter un collaborateur
              </Button>
            </section>
          )}

          {step === 4 && (
            <section className="py-6 text-center">
              <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-companion-300 shadow-sm">
                <HugeIcon icon={AiBrain01Icon} size="lg" className="text-brand-black" />
              </span>
              <h1 className="text-title-1-medium text-text-primary">
                Votre mémoire d'entreprise est prête.
              </h1>
              <p className="mx-auto mt-2 max-w-md text-body-medium text-text-secondary">
                {name} · {selectedSources.length} source(s) connectée(s) · fournisseur{' '}
                {PROVIDERS.find((p) => p.id === provider)?.name}.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button onClick={() => navigate('/home')}>Entrer dans Companion</Button>
              </div>
            </section>
          )}
        </div>

        {step < 4 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => (step === 0 ? navigate('/login') : setStep((s) => s - 1))}
            >
              {step === 0 ? 'Annuler' : 'Retour'}
            </Button>
            <Button onClick={next} disabled={step === 0 && !step1Valid}>
              {step === 3 ? 'Finaliser' : 'Continuer'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Labeled select wrapper used by the wizard. */
function WizardSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  items: { id: string; label: string }[]
}) {
  const current = items.find((i) => i.id === value)
  return (
    <div>
      <p className="mb-1 text-body-2-medium text-text-primary">{label}</p>
      <Select
        aria-label={label}
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
    </div>
  )
}
