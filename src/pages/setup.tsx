import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import {
  AiBrain01Icon,
  Building01Icon,
  CheckmarkCircle02Icon,
  ServerStack01Icon,
  UserGroupIcon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'

const SECTORS = ['Services professionnels', 'Assurance', 'Fintech', 'Banque', 'Logistique', 'Distribution', 'BTP', 'ONG']
const COUNTRIES = ["Côte d'Ivoire", 'Sénégal', 'Cameroun', 'Bénin', 'Togo', 'Burkina Faso', 'Mali', 'Gabon']

const STEPS = ['Organisation', 'Équipe', 'Terminé'] as const

interface InviteRow {
  name: string
  email: string
  role: string
}

/**
 * Assistant de premier démarrage — instance VIERGE (aucune donnée de démo).
 * Crée l'organisation, le département/rôle initiaux et le compte propriétaire
 * via POST /api/setup (idempotent : refuse si une organisation existe déjà),
 * ouvre la session, puis envoie les invitations de l'équipe (réelles).
 */
export function SetupPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadySetup, setAlreadySetup] = useState(false)
  const [codeRequired, setCodeRequired] = useState(false)
  const [setupCode, setSetupCode] = useState('')

  // Étape 1 — organisation + compte propriétaire
  const [name, setName] = useState('')
  const [sector, setSector] = useState(SECTORS[0])
  const [country, setCountry] = useState("Côte d'Ivoire")
  const [departmentName, setDepartmentName] = useState('')
  const [roleName, setRoleName] = useState('')
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const step1Valid =
    name.trim().length > 1 &&
    ownerFirstName.trim().length > 0 &&
    ownerEmail.includes('@') &&
    ownerPassword.length >= 8

  // Étape 2 — invitations (réelles : POST /invitations)
  const [invites, setInvites] = useState<InviteRow[]>([{ name: '', email: '', role: 'Employé' }])

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((d: { needsSetup?: boolean; codeRequired?: boolean }) => {
        setAlreadySetup(d.needsSetup === false)
        setCodeRequired(d.codeRequired === true)
      })
      .catch(() => undefined)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)

    if (step === 0) {
      // 1. Organisation + owner
      setBusy(true)
      const res = await fetch('/api/setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: name.trim(),
          sector,
          country,
          departmentName: departmentName.trim() || undefined,
          roleName: roleName.trim() || undefined,
          ownerFirstName: ownerFirstName.trim(),
          ownerLastName: ownerLastName.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerPassword,
          setupCode: setupCode.trim() || undefined,
        }),
      })
      if (res.status === 409) {
        setBusy(false)
        setAlreadySetup(true)
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null
        setBusy(false)
        setError(err?.error ?? 'Échec de la configuration de l\u2019instance.')
        return
      }
      // 2. Session owner
      const session = await api.login(ownerEmail.trim(), ownerPassword)
      setBusy(false)
      if (!session) {
        pushToast('Organisation créée — connectez-vous avec votre compte.', 'info')
        navigate('/login')
        return
      }
      setStep(1)
      return
    }

    // Étape 2 : invitations réelles (les échecs sont signalés, sans bloquer)
    setBusy(true)
    let ok = 0
    let failed = 0
    const roleMap: Record<string, string> = { Employé: 'employee', Manager: 'manager', Admin: 'admin', Auditeur: 'auditor' }
    for (const inv of invites) {
      if (!inv.email.includes('@')) continue
      const created = await api.createInvitation(inv.email.trim(), roleMap[inv.role] ?? 'employee')
      created.ok ? ok++ : failed++
    }
    setBusy(false)
    if (failed > 0) pushToast(`${ok} invitation(s) envoyée(s), ${failed} en échec.`, failed > ok ? 'error' : 'success')
    setStep(2)
  }

  if (alreadySetup) {
    return (
      <div className="flex min-h-screen flex-col bg-background-full">
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="max-w-md text-center">
            <HugeIcon icon={CheckmarkCircle02Icon} size="lg" className="mx-auto text-status-lime-text" />
            <h1 className="mt-4 text-title-1-medium text-text-primary">Instance déjà configurée</h1>
            <p className="mt-2 text-body-medium text-text-secondary">
              Cette instance Companion a déjà une organisation. Connectez-vous pour continuer.
            </p>
            <Button className="mt-6" onClick={() => navigate('/login')}>Se connecter</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full">
      <div className="flex flex-1 items-start justify-center px-4 py-12">
        <form onSubmit={(e) => void submit(e)} className="w-full max-w-xl" noValidate>
          <div className="mb-8 text-center">
            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-black">
              <HugeIcon icon={AiBrain01Icon} size="md" className="text-companion-300" />
            </span>
            <h1 className="text-title-1-medium text-text-primary">Configurer votre Companion</h1>
            <p className="mt-1.5 text-body-medium text-text-secondary">
              Votre instance est vierge — créez votre organisation et votre compte administrateur.
            </p>
          </div>

          <ol className="mb-6 flex justify-center gap-1.5" aria-label="Étapes">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={cx(
                  'rounded-full border px-3 py-1 text-caption-1-medium',
                  i === step ? 'border-accent-500 bg-accent-50 text-accent-700' : i < step ? 'border-border-button-default text-text-secondary' : 'border-border-button-default text-text-tertiary',
                )}
              >
                {i + 1}. {s}
              </li>
            ))}
          </ol>

          {error && (
            <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
            {step === 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <HugeIcon icon={Building01Icon} size="md" className="text-accent-500" />
                  <h2 className="text-headline-medium text-text-primary">Votre organisation</h2>
                </div>
                <Input label="Nom de l'entreprise" value={name} onChange={setName} placeholder="ex. ACME Industries" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    aria-label="Secteur"
                    selectedKey={sector}
                    onSelectionChange={(k) => setSector(String(k))}
                    items={SECTORS.map((x) => ({ id: x, label: x }))}
                    renderValue={<span>{sector}</span>}
                  >
                    {SECTORS.map((x) => (
                      <SelectItem key={x} id={x} textValue={x}>{x}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    aria-label="Pays"
                    selectedKey={country}
                    onSelectionChange={(k) => setCountry(String(k))}
                    items={COUNTRIES.map((x) => ({ id: x, label: x }))}
                    renderValue={<span>{country}</span>}
                  >
                    {COUNTRIES.map((x) => (
                      <SelectItem key={x} id={x} textValue={x}>{x}</SelectItem>
                    ))}
                  </Select>
                </div>
                <p className="pt-2 text-caption-1-semibold text-text-secondary">Structure initiale (modifiable ensuite)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Premier département" value={departmentName} onChange={setDepartmentName} placeholder="ex. Direction" />
                  <Input label="Premier rôle" value={roleName} onChange={setRoleName} placeholder="ex. Directeur Général" />
                </div>
                <p className="pt-2 text-caption-1-semibold text-text-secondary">Votre compte administrateur</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Prénom" value={ownerFirstName} onChange={setOwnerFirstName} placeholder="Ange" />
                  <Input label="Nom" value={ownerLastName} onChange={setOwnerLastName} placeholder="Niamké" />
                </div>
                <Input label="Email administrateur" type="email" value={ownerEmail} onChange={setOwnerEmail} placeholder="admin@entreprise.ci" autoComplete="email" />
                <Input label="Mot de passe (8 caractères minimum)" type="password" value={ownerPassword} onChange={setOwnerPassword} placeholder="••••••••" autoComplete="new-password" />
                {codeRequired && (
                  <Input label="Code d'installation" value={setupCode} onChange={setSetupCode} placeholder="Fourni par le script d'installation" autoComplete="off" />
                )}
              </section>
            )}

            {step === 1 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <HugeIcon icon={UserGroupIcon} size="md" className="text-accent-500" />
                  <h2 className="text-headline-medium text-text-primary">Inviter votre équipe</h2>
                </div>
                <p className="text-body-2-regular text-text-secondary">
                  Chaque invité reçoit un lien d'activation (mot de passe défini à la première
                  connexion). Vous pourrez en ajouter d'autres à tout moment.
                </p>
                {invites.map((inv, i) => (
                  <div key={i} className="grid items-end gap-2 rounded-xl border border-border-button-default p-3 sm:grid-cols-[1fr_1fr_140px_40px]">
                    <Input label="Nom" value={inv.name} onChange={(v) => setInvites((l) => l.map((r, j) => (j === i ? { ...r, name: v } : r)))} placeholder="Awa Traoré" />
                    <Input label="Email" type="email" value={inv.email} onChange={(v) => setInvites((l) => l.map((r, j) => (j === i ? { ...r, email: v } : r)))} placeholder="awa@entreprise.ci" />
                    <Select
                      aria-label="Rôle"
                      selectedKey={inv.role}
                      onSelectionChange={(k) => setInvites((l) => l.map((r, j) => (j === i ? { ...r, role: String(k) } : r)))}
                      items={['Employé', 'Manager', 'Admin', 'Auditeur'].map((x) => ({ id: x, label: x }))}
                      renderValue={<span>{inv.role}</span>}
                    >
                      {['Employé', 'Manager', 'Admin', 'Auditeur'].map((x) => (
                        <SelectItem key={x} id={x} textValue={x}>{x}</SelectItem>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`Retirer l'invitation ${i + 1}`}
                      onClick={() => setInvites((l) => l.filter((_, j) => j !== i))}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  onClick={() => setInvites((l) => [...l, { name: '', email: '', role: 'Employé' }])}
                >
                  + Ajouter une ligne
                </Button>
              </section>
            )}

            {step === 2 && (
              <section className="py-8 text-center">
                <HugeIcon icon={CheckmarkCircle02Icon} size="lg" className="mx-auto text-emerald-500" />
                <h2 className="mt-4 text-title-1-medium text-text-primary">Companion est prêt</h2>
                <p className="mx-auto mt-2 max-w-md text-body-medium text-text-secondary">
                  Votre organisation est créée et vous êtes connecté. Importez vos premiers
                  documents pour alimenter la mémoire, puis explorez les modules.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => navigate('/sources/new')}>Importer mes premiers documents</Button>
                  <Button variant="secondary" onClick={() => navigate('/home')}>Aller à l'accueil</Button>
                </div>
              </section>
            )}
          </div>

          {step < 2 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
                <HugeIcon icon={ServerStack01Icon} size="xs" />
                Instance auto-hébergée — vos données restent ici.
              </span>
              {step === 0 ? (
                <Button type="submit" disabled={!step1Valid || busy}>
                  {busy ? 'Création…' : 'Créer mon organisation'}
                </Button>
              ) : (
                <Button type="submit" disabled={busy}>
                  {busy ? 'Finalisation…' : 'Terminer'}
                </Button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
