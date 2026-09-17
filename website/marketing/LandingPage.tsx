import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import type { IconSvgElement } from '@hugeicons/react'
import {
  AiBrain01Icon, ArrowRight02Icon, ArrowUpRightIcon, BotIcon, CheckmarkCircle02Icon, CloudUploadIcon,
  Database01Icon, DocumentValidationIcon, FileEditIcon, Folder01Icon, GoogleDriveIcon, HandshakeIcon,
  HistoryIcon, Key02Icon, MicrosoftIcon, NotionIcon, RocketIcon,
  Search01Icon, SentIcon, ServerStack01Icon, Shield01Icon, ShieldAlertIcon, ShieldCheckIcon,
  ShieldKeyIcon, ShieldUserIcon, SlackIcon, SourceCodeIcon, UserCheckIcon, UserCircleIcon,
  WhatsappIcon,
} from '@/lib/icons'

/* Surface marketing — companion.kamaloka.ai. Sections bento, design system Companion. */

type Icon = IconSvgElement

/* --------------------------------- primitives ----------------------------- */

export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl'
  return (
    <span className={`${box} flex items-center justify-center bg-companion-300 shadow-card`}>
      <HugeIcon icon={AiBrain01Icon} size={size === 'lg' ? 'lg' : 'md'} className="text-brand-black" />
    </span>
  )
}

const CELL = 'relative overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default shadow-card'

function Cell({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`${CELL} ${className}`}>{children}</div>
}

function Header() {
  const links: [string, string][] = [
    ['#produit', 'Produit'],
    ['#agents', 'Agents'],
    ['#offres', 'Offres'],
    ['/docs', 'Documentation'],
  ]
  return (
    <header className="sticky top-0 z-20 border-b border-separator-border bg-background-primary-default/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <BrandMark />
          <span className="text-headline-semibold text-text-primary">
            COMPANION <span className="hidden text-text-tertiary sm:inline">· by KamaLoka</span>
          </span>
        </a>
        <div className="ml-4 hidden items-center gap-5 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-body-2-medium text-text-secondary no-underline hover:text-text-primary">{label}</a>
          ))}
        </div>
        <span className="flex-1" />
        <ButtonLink variant="secondary" size="small" href="/portal/login">Espace client</ButtonLink>
        <ButtonLink variant="primary" size="small" leadingIcon={adaptIcon(ArrowUpRightIcon, 18)} href="#demo">Demander une démo</ButtonLink>
      </nav>
    </header>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border-button-default bg-background-primary-default px-3 py-1 text-caption-1-semibold uppercase tracking-[0.12em] text-accent-600 shadow-card">
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-display-4-medium tracking-tight text-text-primary md:text-display-3-medium">{title}</h2>
      {lead && <p className="mt-4 text-body-medium text-text-secondary">{lead}</p>}
    </div>
  )
}

/* ------------------------------- mockups visuels -------------------------- */

function ChatMock() {
  return (
    <div className="mt-6 space-y-3">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent-500 px-4 py-3 text-body-2-medium text-white shadow-card">
        Comment traite-t-on un rejet R03 supérieur à 500 000 FCFA ?
      </div>
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-separator-border bg-background-secondary-default px-4 py-3">
        <p className="text-body-2-regular text-text-secondary">
          Vérifier le dossier dans le registre, puis escalader au chef de recouvrement sous 24 h avec la pièce
          de rejet jointe. Un R03 &gt; 500 000 F exige une contre-vérification bancaire avant relance.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip variant="caption" color="soft">SOP-042</Chip>
          <Chip variant="caption" color="soft">Cas #1287</Chip>
          <Chip variant="caption" color="lime">Validé · Direction</Chip>
        </div>
      </div>
      <p className="flex items-center gap-1.5 pl-1 text-caption-1-medium text-emerald-700">
        <HugeIcon icon={CheckmarkCircle02Icon} size="xs" />
        Sources citées — et si le contexte manque, Companion s'abstient au lieu d'inventer.
      </p>
    </div>
  )
}

function RiskGauge() {
  return (
    <div className="mt-6 flex items-center gap-5">
      <div
        className="relative grid size-28 shrink-0 place-items-center rounded-full"
        style={{ background: 'conic-gradient(var(--color-amber-500) 0 49%, var(--color-background-tertiary-default) 49% 100%)' }}
      >
        <div className="grid size-20 place-items-center rounded-full bg-background-primary-default">
          <span className="text-title-2-semibold text-text-primary tabular-nums">49</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {([
          ['Personne clé', 78, 'bg-rose-500'],
          ['Couverture rôles', 62, 'bg-amber-500'],
          ['Handover prêt', 84, 'bg-emerald-500'],
        ] as [string, number, string][]).map(([label, v, c]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-caption-1-medium text-text-secondary">
              <span>{label}</span><span className="tabular-nums">{v} %</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
              <div className={`h-full rounded-full ${c}`} style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HandoverMock() {
  const steps: [Icon, string, string][] = [
    [Search01Icon, 'Analyse', 'Manques détectés'],
    [UserCheckIcon, 'Entretien', '12 questions posées'],
    [SentIcon, 'Pack prêt', 'Humain + machine'],
  ]
  return (
    <ol className="mt-6">
      {steps.map(([icon, title, detail], i) => (
        <li key={title} className="relative flex gap-3 pb-5 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-full w-px bg-separator-border" />}
          <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full bg-companion-300 text-brand-black shadow-card">
            <HugeIcon icon={icon} size="xs" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-body-2-semibold text-text-primary">{title}</p>
            <p className="text-caption-1-medium text-text-tertiary">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function OnboardingMock() {
  const phases: [string, string, number][] = [
    ['J1', 'Contexte & outils', 100],
    ['J7', 'Processus du poste', 64],
    ['J30', 'Autonomie complète', 22],
  ]
  return (
    <div className="mt-6 space-y-3">
      {phases.map(([j, label, pct]) => (
        <div key={j} className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background-secondary-default text-caption-1-bold text-text-primary">{j}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-2-medium text-text-primary">{label}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="text-caption-1-semibold text-text-tertiary tabular-nums">{pct} %</span>
        </div>
      ))}
      <p className="flex items-center gap-1.5 pt-1 text-caption-1-medium text-text-tertiary">
        <HugeIcon icon={RocketIcon} size="xs" /> Plan généré depuis le Role Brain du poste — readiness 96 %.
      </p>
    </div>
  )
}

function ApprovalMock() {
  return (
    <div className="mt-6 rounded-2xl border border-separator-border bg-background-secondary-default p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-accent-500 text-white"><HugeIcon icon={BotIcon} size="xs" /></span>
        <p className="text-body-2-semibold text-text-primary">Relance client — Orange CI</p>
        <Chip variant="caption" color="yellow">Approbation requise</Chip>
      </div>
      <p className="mt-2 text-caption-1-medium text-text-secondary">
        Brouillon d'email préparé depuis 4 mémoires validées. Envoi bloqué tant qu'un humain n'a pas approuvé.
      </p>
      <div className="mt-3 flex gap-2">
        <span className="rounded-lg bg-button-primary px-3 py-1.5 text-caption-1-semibold text-white">Approuver</span>
        <span className="rounded-lg border border-border-button-default bg-background-primary-default px-3 py-1.5 text-caption-1-semibold text-text-secondary">Rejeter</span>
      </div>
    </div>
  )
}

function CodeMock() {
  return (
    <pre className="mt-6 overflow-x-auto rounded-2xl bg-brand-black p-4 text-caption-1-medium leading-relaxed text-blue-100"><code>{`const r = await mcp.callTool({
  name: "search_memory",
  arguments: { query: "procédure R03" },
})
// → réponses sourcées, permissions appliquées`}</code></pre>
  )
}

const APPS: [Icon, string][] = [
  [GoogleDriveIcon, 'Google Drive'],
  [MicrosoftIcon, 'Microsoft 365'],
  [WhatsappIcon, 'WhatsApp'],
  [SlackIcon, 'Slack'],
  [NotionIcon, 'Notion'],
]

/* ---------------------------------- page ---------------------------------- */

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-4xl rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--color-companion-300), transparent)' }}
        />
        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 text-center md:pt-28">
          <Chip variant="subtle" color="lime">Self-hosted · vos données restent chez vous</Chip>
          <h1 className="mt-6 text-display-2-medium tracking-tight text-text-primary md:text-display-1-medium">
            Votre entreprise<br />n'oublie plus.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-headline-regular text-text-secondary">
            Capturez le savoir de vos équipes, réduisez la dépendance aux personnes clés et transmettez
            instantanément le contexte aux nouveaux collaborateurs et aux agents IA.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" leadingIcon={adaptIcon(ArrowRight02Icon, 20)} href="#demo">Demander une démo</ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="#demo">Commencer un pilote</ButtonLink>
          </div>
          <p className="mt-7 text-body-2-medium text-text-tertiary">
            Déjà client ? <a href="/portal/login" className="font-semibold text-accent-600 no-underline hover:underline">Télécharger Companion</a>
          </p>
        </div>
      </section>

      {/* Bento produit */}
      <section id="produit" className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Le produit"
            title={<>Une mémoire organisée,<br />pas un tas de documents.</>}
            lead="Companion transforme vos sources en connaissances vérifiées et sourcées, mesure ce que votre entreprise risque d'oublier, et transmet automatiquement."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-6">
            <Cell className="p-6 md:col-span-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={AiBrain01Icon} size="sm" className="text-foreground-icon-secondary" /></span>
                <h3 className="text-headline-semibold text-text-primary">Ask Companion</h3>
                <Chip variant="caption" color="blue">citations systématiques</Chip>
              </div>
              <p className="mt-2 max-w-lg text-body-2-regular text-text-secondary">La bonne réponse, avec sa source et son niveau de validation.</p>
              <ChatMock />
            </Cell>

            <Cell className="p-6 md:col-span-2">
              <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={ShieldAlertIcon} size="sm" className="text-foreground-icon-secondary" /></span>
              <h3 className="mt-3 text-headline-semibold text-text-primary">Knowledge Risk</h3>
              <p className="mt-1 text-body-2-regular text-text-secondary">Le risque de perte de savoir, mesuré.</p>
              <RiskGauge />
            </Cell>

            <Cell className="p-6 md:col-span-2">
              <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={HandshakeIcon} size="sm" className="text-foreground-icon-secondary" /></span>
              <h3 className="mt-3 text-headline-semibold text-text-primary">Handover assisté</h3>
              <p className="mt-1 text-body-2-regular text-text-secondary">Ce que le partant seul sait, capturé avant le départ.</p>
              <HandoverMock />
            </Cell>

            <Cell className="p-6 md:col-span-2">
              <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={RocketIcon} size="sm" className="text-foreground-icon-secondary" /></span>
              <h3 className="mt-3 text-headline-semibold text-text-primary">Onboarding J1 · J7 · J30</h3>
              <p className="mt-1 text-body-2-regular text-text-secondary">Les arrivées deviennent rapides.</p>
              <OnboardingMock />
            </Cell>

            <Cell className="p-6 md:col-span-2">
              <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={BotIcon} size="sm" className="text-foreground-icon-secondary" /></span>
              <h3 className="mt-3 text-headline-semibold text-text-primary">Agents sous garde-fous</h3>
              <p className="mt-1 text-body-2-regular text-text-secondary">Ils préparent, un humain approuve.</p>
              <ApprovalMock />
            </Cell>

            <Cell className="p-6 md:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-headline-semibold text-text-primary">Connecté à vos outils</h3>
                  <p className="mt-1 text-body-2-regular text-text-secondary">Plus de 760 applications, ingestion continue et sourcée.</p>
                </div>
                <Chip variant="caption" color="soft">+756 apps</Chip>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-2.5">
                {APPS.map(([icon, label]) => (
                  <span key={label} title={label} className="grid aspect-square place-items-center rounded-2xl border border-border-button-default bg-background-secondary-default shadow-card">
                    <HugeIcon icon={icon} size="md" className="text-foreground-icon-primary" />
                  </span>
                ))}
              </div>
              <p className="mt-3 text-caption-1-medium text-text-tertiary">Odoo, Gmail, SharePoint, Teams… et tout le reste via API.</p>
            </Cell>

            <Cell className="p-6 md:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-headline-semibold text-text-primary">Vos données restent chez vous</h3>
                  <p className="mt-1 text-body-2-regular text-text-secondary">
                    Installé dans votre VPS, cloud privé ou infrastructure interne. IA locale possible. Licence
                    vérifiée hors-ligne — aucune dépendance quotidienne à KamaLoka.
                  </p>
                </div>
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-companion-300 text-brand-black shadow-card">
                  <HugeIcon icon={ShieldCheckIcon} size="lg" />
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {([
                  [ServerStack01Icon, 'On-premise'],
                  [ShieldUserIcon, 'IA locale'],
                  [Key02Icon, 'Licence offline'],
                ] as [Icon, string][]).map(([icon, label]) => (
                  <span key={label} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border-button-default bg-background-secondary-default px-2 py-3 text-center shadow-card">
                    <HugeIcon icon={icon} size="sm" className="text-foreground-icon-secondary" />
                    <span className="text-caption-1-semibold text-text-primary">{label}</span>
                  </span>
                ))}
              </div>
            </Cell>
          </div>
        </div>
      </section>

      {/* Flux */}
      <section className="border-y border-separator-border bg-background-secondary-default px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Comment ça marche" title="De vos sources à la transmission" />
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-6">
            {([
              [Folder01Icon, 'Sources', 'Drive, email, fichiers'],
              [Database01Icon, 'Company Brain', 'Connaissances validées'],
              [UserCircleIcon, 'Role Brain', 'Savoir du poste'],
              [ShieldAlertIcon, 'Risk', 'Dépendances mesurées'],
              [HandshakeIcon, 'Handover', 'Transmission complète'],
              [RocketIcon, 'Onboarding', 'J1 · J7 · J30'],
            ] as [Icon, string, string][]).map(([icon, title, detail]) => (
              <Cell key={title} className="p-4 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-xl bg-background-primary-default shadow-card">
                  <HugeIcon icon={icon} size="sm" className="text-foreground-icon-secondary" />
                </span>
                <p className="mt-2.5 text-body-2-semibold text-text-primary">{title}</p>
                <p className="text-caption-1-medium text-text-tertiary">{detail}</p>
              </Cell>
            ))}
          </div>
        </div>
      </section>

      {/* Agents + MCP + sécurité */}
      <section id="agents" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            eyebrow="Pour vos équipes — et vos agents"
            title="Le contexte de l'entreprise, servi aux humains et aux IA"
            lead="Les mêmes permissions, le même audit, que la question vienne d'un collaborateur ou d'un agent externe."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Cell className="p-6">
              <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={SourceCodeIcon} size="sm" className="text-foreground-icon-secondary" /></span>
              <h3 className="mt-3 text-headline-semibold text-text-primary">Serveur MCP standard</h3>
              <p className="mt-1 text-body-2-regular text-text-secondary">
                Claude, Cursor ou vos agents maison interrogent la mémoire avec scopes, outils autorisés,
                expiration et révocation. Toute demande hors périmètre : refus journalisé.
              </p>
              <CodeMock />
            </Cell>
            <Cell className="p-6">
              <span className="grid size-9 place-items-center rounded-xl bg-background-secondary-default"><HugeIcon icon={ShieldKeyIcon} size="sm" className="text-foreground-icon-secondary" /></span>
              <h3 className="mt-3 text-headline-semibold text-text-primary">Sécurité niveau institution</h3>
              <ul className="mt-4 space-y-3">
                {([
                  [Shield01Icon, "Permissions par rôle, appliquées jusqu'au retrieval"],
                  [HistoryIcon, "Journal d'audit complet : qui, quoi, quelles sources"],
                  [CloudUploadIcon, 'Sauvegardes et restauration testées'],
                  [FileEditIcon, 'Corrections humaines conservées, jamais écrasées'],
                  [DocumentValidationIcon, 'Approbations requises pour toute action externe'],
                ] as [Icon, string][]).map(([icon, text]) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-background-secondary-default">
                      <HugeIcon icon={icon} size="xs" className="text-foreground-icon-secondary" />
                    </span>
                    <span className="text-body-2-regular text-text-secondary">{text}</span>
                  </li>
                ))}
              </ul>
            </Cell>
          </div>
        </div>
      </section>

      {/* Offres */}
      <section id="offres" className="border-y border-separator-border bg-background-secondary-default px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <SectionHead eyebrow="Offres" title="Une licence annuelle. Vos données, votre instance." />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {([
              ['Pilot', '30 jours', 'Offert', ["Jusqu'à 25 utilisateurs", 'Découverte agents & intégrations', 'Knowledge Risk initial', 'Sur votre infrastructure'], false],
              ['Business', 'par an', '2 400 000 FCFA', ["Jusqu'à 100 utilisateurs", '20 agents · 15 intégrations', 'Handover & onboarding complets', 'Support prioritaire'], true],
              ['Enterprise', 'sur devis', 'Sur mesure', ['Utilisateurs illimités', 'SSO & branding personnalisé', 'Multi-instances', 'Accompagnement dédié'], false],
            ] as [string, string, string, string[], boolean][]).map(([name, period, price, features, highlight]) => (
              <Cell key={name} className={`flex flex-col p-6 ${highlight ? 'ring-2 ring-accent-500' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-headline-semibold text-text-primary">{name}</h3>
                  {highlight && <Chip variant="caption" color="lime">Recommandé</Chip>}
                </div>
                <p className="mt-1 text-caption-1-medium text-text-tertiary">{period}</p>
                <p className="mt-4 text-display-4-semibold text-text-primary">{price}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-body-2-regular text-text-secondary">
                      <HugeIcon icon={CheckmarkCircle02Icon} size="xs" className="mt-0.5 shrink-0 text-emerald-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <ButtonLink variant={highlight ? 'primary' : 'secondary'} size="small" className="w-full justify-center" href="#demo">
                    {name === 'Pilot' ? 'Commencer le pilote' : 'En parler'}
                  </ButtonLink>
                </div>
              </Cell>
            ))}
          </div>
          <p className="mt-5 text-center text-caption-1-medium text-text-tertiary">
            Installation accompagnée : 750 000 FCFA (Business) · Paiement annuel ≈ 2 mois offerts vs mensuel ·
            Consommation IA en BYOK : facturée directement par vos fournisseurs.
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section id="demo" className="bg-brand-black">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <div className="flex justify-center"><BrandMark size="lg" /></div>
          <h2 className="mt-6 text-display-4-medium tracking-tight text-white md:text-display-3-medium">
            Arrêtez de perdre<br />ce que vos équipes savent.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-white/70">
            Un pilote de 30 jours sur vos vrais cas : Knowledge Risk mesuré, premier handover assisté, premier
            onboarding généré. Vous voyez la valeur avant d'engager l'installation.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" href="mailto:contact@kamaloka.ai?subject=Démo%20Companion">Demander une démo</ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="mailto:contact@kamaloka.ai?subject=Pilote%20Companion%2030j">Commencer un pilote</ButtonLink>
          </div>
          <p className="mt-7 text-caption-1-medium text-white/50">
            Déjà client ? <a href="/portal/login" className="font-semibold text-white no-underline hover:underline">Espace client — téléchargements & licences</a>
          </p>
        </div>
      </section>

      <footer className="border-t border-separator-border px-6 py-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span className="text-caption-1-medium text-text-tertiary">
            <span className="font-semibold text-text-secondary">KamaLoka AI Technologies</span> · Companion — la mémoire opérationnelle d'entreprise
          </span>
          <span className="flex gap-4 text-caption-1-medium text-text-secondary">
            <a href="/docs" className="no-underline hover:text-text-primary">Documentation</a>
            <a href="/portal/login" className="no-underline hover:text-text-primary">Portail client</a>
            <a href="mailto:contact@kamaloka.ai" className="no-underline hover:text-text-primary">contact@kamaloka.ai</a>
          </span>
        </div>
      </footer>
    </div>
  )
}
