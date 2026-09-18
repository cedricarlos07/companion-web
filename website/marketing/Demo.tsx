import { useState, type FormEvent } from 'react'
import { Button, ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import logoDark from './assets/logos/logo-dark.png'
import {
  AiBrain01Icon, ArrowLeft01Icon, ArrowRight02Icon, Calendar01Icon, CheckmarkCircle02Icon,
  HandshakeIcon, Search01Icon, RocketIcon, ShieldUserIcon,
} from '@/lib/icons'

/* Page « Demander une démo » — formulaire court, qualifiant, orienté problème métier.
 * Les leads partent dans le Control Center (POST /v1/demo-requests). */

const DEMO_SCHEDULING_URL = 'https://cal.com/team/kamaloka/demo'

const FONCTIONS = ['Direction générale', 'RH', 'DSI', 'Opérations', 'Commercial', 'Autre']
const TAILLES = ['1–25', '26–100', '101–300', '301–1 000', '1 000+']
const PROBLEMES = [
  'Départs de collaborateurs clés',
  'Savoir dispersé',
  'Onboarding trop long',
  'Procédures mal documentées',
  "Recherche d'information",
  'Agents IA',
  'Autre',
]
const OUTILS = ['Google Workspace', 'Microsoft 365', 'WhatsApp Business', 'Odoo', 'Slack', 'Notion', 'Autre']
const DEPLOIEMENTS = ['Self-hosted', 'Cloud privé', 'On-premise', 'Je ne sais pas encore']

function LabeledSelect({ label, value, onChange, items, required }: {
  label: string; value: string; onChange: (v: string) => void; items: string[]; required?: boolean
}) {
  const current = items.find((i) => i === value)
  return (
    <div>
      <p className="mb-1 text-body-2-medium text-text-primary">
        {label} {required && <span className="text-text-error-primary">*</span>}
      </p>
      <Select
        aria-label={label}
        selectedKey={value || null}
        onSelectionChange={(k) => onChange(String(k ?? ''))}
        placeholder="Sélectionner…"
        className="w-full"
      >
        <SelectItem id="">Sélectionner…</SelectItem>
        {items.map((i) => <SelectItem key={i} id={i}>{i}</SelectItem>)}
      </Select>
      {!current && <span />}
    </div>
  )
}

function ProofPoint({ icon, children }: { icon: Parameters<typeof HugeIcon>[0]['icon']; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <HugeIcon icon={icon} size="sm" className="mt-0.5 shrink-0 text-accent-600" />
      <span className="text-body-2-regular text-text-secondary">{children}</span>
    </li>
  )
}

function IcsDownload() {
  // Rendez-vous proposé : demain 10:00, 30 minutes — modifiable ensuite.
  const start = new Date(Date.now() + 86_400_000)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start.getTime() + 1_800_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KamaLoka//Companion Demo//FR', 'BEGIN:VEVENT',
    `UID:demo-${Date.now()}@kamaloka.ai`,
    `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    'SUMMARY:Démo Companion — KamaLoka',
    'DESCRIPTION:Démonstration personnalisée de 30 minutes. Un membre de KamaLoka vous contactera pour confirmer.',
    'LOCATION:Visioconférence',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const download = () => {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'demo-companion.ics'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <Button variant="secondary" size="medium" leadingIcon={adaptIcon(Calendar01Icon, 20)} onClick={download}>
      Ajouter le rendez-vous à mon agenda
    </Button>
  )
}

export function DemoPage() {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', company: '', company_website: '',
    role: '', companySize: '', problem: '', tools: '', deployment: '', message: '',
    offer: new URLSearchParams(location.search).get('objet') ?? new URLSearchParams(location.search).get('offre') ?? 'demo',
  })
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim() || !form.company.trim()) return setError('Nom et entreprise sont requis.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Vérifiez votre email professionnel.')
    if (form.phone.replace(/\D/g, '').length < 6) return setError('Vérifiez votre numéro de téléphone / WhatsApp.')
    if (!form.role || !form.companySize || !form.problem) return setError('Complétez les champs obligatoires.')
    setBusy(true)
    try {
      const res = await fetch('/v1/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null) as { error?: string } | null
        setError(d?.error ?? 'Envoi impossible pour le moment — réessayez.')
        return
      }
      setDone(true)
      window.scrollTo({ top: 0 })
    } finally {
      setBusy(false)
    }
  }

  const TITRES: Record<string, string> = {
    pilote: 'Lancez votre pilote Companion de 30 jours.',
    risk: 'Évaluez le Knowledge Risk de votre organisation.',
    business: 'Déployez Companion dans toute votre entreprise.',
    enterprise: 'Construisons votre déploiement Enterprise.',
  }
  const titre = TITRES[form.offer] ?? 'Voyez ce que votre entreprise risque de perdre.'
  const chipLabel: Record<string, string> = {
    pilote: 'Pilote 30 jours', risk: 'Évaluation de risque', business: 'Business',
    enterprise: 'Enterprise',
  }
  const chipText = chipLabel[form.offer] ?? 'Démo personnalisée · 30 min'
  const ctaLabel = form.offer === 'pilote' ? 'Lancer mon pilote Companion' : 'Demander ma démo Companion'

  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      <header className="border-b border-separator-border bg-background-primary-default">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-3">
          <a href="/landing" className="flex items-center gap-2.5 no-underline">
            <span className="flex size-10 items-center justify-center rounded-xl bg-companion-300 shadow-card">
              <HugeIcon icon={AiBrain01Icon} size="md" className="text-brand-black" />
            </span>
            <span className="text-headline-semibold text-text-primary">
              COMPANION <span className="text-text-tertiary">· by KamaLoka</span>
            </span>
          </a>
          <span className="flex-1" />
          <ButtonLink variant="ghost" size="small" leadingIcon={adaptIcon(ArrowLeft01Icon, 18)} href="/landing">
            Retour au site
          </ButtonLink>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14">
        {done ? (
          <div className="mx-auto max-w-2xl text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-companion-300 shadow-card">
              <HugeIcon icon={CheckmarkCircle02Icon} size="lg" className="text-brand-black" />
            </span>
            <h1 className="mt-6 text-title-2-medium text-text-primary">Votre demande est bien reçue.</h1>
            <p className="mx-auto mt-3 max-w-xl text-body-medium text-text-secondary">
              Un membre de KamaLoka vous contactera pour préparer une démonstration adaptée à votre organisation.
              Vous pouvez déjà réserver votre créneau :
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <ButtonLink variant="primary" size="medium" leadingIcon={adaptIcon(Calendar01Icon, 20)} href={DEMO_SCHEDULING_URL} target="_blank" rel="noreferrer">
                Choisir directement un créneau
              </ButtonLink>
              <IcsDownload />
            </div>
            <p className="mt-6 text-caption-1-medium text-text-tertiary">
              Une question avant la démo ? <a href="mailto:contact@kamaloka.ai" className="text-accent-600 no-underline">contact@kamaloka.ai</a>
            </p>
            <div className="mt-8">
              <ButtonLink variant="ghost" size="small" leadingIcon={adaptIcon(ArrowLeft01Icon, 18)} href="/landing">Retour au site</ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <div className="mx-auto max-w-3xl text-center">
              <Chip variant="subtle" color="lime">{chipText}</Chip>
              <h1 className="mt-5 font-medium tracking-tight text-text-primary" style={{ fontSize: 'clamp(30px,4vw,42px)', lineHeight: 1.12 }}>
                {titre}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
                En 30 minutes, découvrez comment Companion capture le savoir de vos équipes, détecte les
                dépendances critiques et prépare les passations avant qu'il ne soit trop tard.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
              {/* Formulaire */}
              <form onSubmit={submit} noValidate
                className="rounded-2xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Prénom et nom *" value={form.fullName} onChange={set('fullName')} placeholder="Ex. Awa Koné" autoComplete="name" />
                  <Input label="Email professionnel *" type="email" value={form.email} onChange={set('email')} placeholder="awa@entreprise.com" autoComplete="email" />
                  <Input label="Téléphone / WhatsApp *" type="tel" value={form.phone} onChange={set('phone')} placeholder="+225 …" autoComplete="tel" />
                  <Input label="Entreprise *" value={form.company} onChange={set('company')} placeholder="Nom de votre organisation" autoComplete="organization" />
                  <LabeledSelect label="Fonction" required value={form.role} onChange={set('role')} items={FONCTIONS} />
                  <LabeledSelect label="Taille de l'entreprise" required value={form.companySize} onChange={set('companySize')} items={TAILLES} />
                  <LabeledSelect label="Quel problème voulez-vous résoudre ?" required value={form.problem} onChange={set('problem')} items={PROBLEMES} />
                  <LabeledSelect label="Quels outils utilisez-vous ?" value={form.tools} onChange={set('tools')} items={OUTILS} />
                  <LabeledSelect label="Mode de déploiement souhaité" value={form.deployment} onChange={set('deployment')} items={DEPLOIEMENTS} />
                  {/* Honeypot anti-spam — masqué des humains */}
                  <div className="hidden" aria-hidden>
                    <Input label="Site web de l'entreprise" value={form.company_website} onChange={set('company_website')} />
                  </div>
                </div>
                <div className="mt-4">
                  <Input label="Message facultatif" value={form.message} onChange={set('message')}
                    placeholder="Parlez-nous du poste, service ou problème que vous voulez sécuriser." />
                </div>
                {error && (
                  <p role="alert" className="mt-3 text-body-2-medium text-text-error-primary">{error}</p>
                )}
                <div className="mt-5">
                  <Button type="submit" size="medium" disabled={busy}
                    leadingIcon={adaptIcon(ArrowRight02Icon, 20)}>
                    {busy ? 'Envoi…' : ctaLabel}
                  </Button>
                  <p className="mt-3 text-caption-1-medium text-text-tertiary">
                    Démo personnalisée de 30 min · Aucun engagement · Vos données ne sont pas nécessaires pour la démonstration.
                  </p>
                </div>
              </form>

              {/* Réassurance */}
              <aside className="space-y-4">
                <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
                  <h2 className="text-headline-medium text-text-primary">Pendant la démo, nous vous montrons concrètement :</h2>
                  <ul className="mt-4 space-y-3">
                    <ProofPoint icon={Search01Icon}>comment identifier une <b className="font-semibold text-text-primary">personne critique</b>,</ProofPoint>
                    <ProofPoint icon={AiBrain01Icon}>interroger la <b className="font-semibold text-text-primary">mémoire de l'entreprise</b> avec sources,</ProofPoint>
                    <ProofPoint icon={HandshakeIcon}>préparer un <b className="font-semibold text-text-primary">départ</b>,</ProofPoint>
                    <ProofPoint icon={RocketIcon}>générer un <b className="font-semibold text-text-primary">onboarding</b>,</ProofPoint>
                    <ProofPoint icon={ShieldUserIcon}>faire agir un <b className="font-semibold text-text-primary">agent sous approbation humaine</b>.</ProofPoint>
                  </ul>
                </div>
                <div className="rounded-2xl border border-border-button-default bg-background-secondary-default p-5">
                  <p className="text-body-2-medium text-text-primary">Pilote accompagné — 350 000 FCFA (30 jours)</p>
                  <p className="mt-1 text-body-2-regular text-text-secondary">
                    Sur vos vrais cas : Knowledge Risk mesuré, premier handover assisté, premier onboarding
                    généré. Montant déduit des frais de déploiement si vous passez en Business.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-separator-border px-6 py-6 text-center text-caption-1-medium text-text-tertiary">
        KamaLoka AI Technologies · <a href="/landing" className="text-accent-600 no-underline">Site produit</a> · <a href="/docs" className="text-accent-600 no-underline">Documentation</a>
      </footer>
    </div>
  )
}
