import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import type { IconSvgElement } from '@hugeicons/react'
import {
  AiBrain01Icon, ArrowRight02Icon, ArrowUpRightIcon, BotIcon, ChartIcon, CloudUploadIcon,
  Database01Icon, DocumentValidationIcon, FileEditIcon, GoogleDriveIcon,
  HandshakeIcon, HistoryIcon, Key02Icon, MicrosoftIcon, NetworkIcon,
  RocketIcon, ServerStack01Icon, Shield01Icon, ShieldAlertIcon, ShieldKeyIcon,
  ShieldUserIcon, UserCircleIcon, UserRemoveIcon, WhatsappIcon,
} from '@/lib/icons'

import askImg from './assets/ask.png'
import riskImg from './assets/knowledge-risk.png'
import handoversImg from './assets/handovers.png'
import brainImg from './assets/brain.png'
import approvalsImg from './assets/approvals.png'

/* Surface marketing — companion.kamaloka.ai. Style bento (réf. lattice.com).
 * Positionnement : ce que l'entreprise perd aujourd'hui, ce que ça coûte,
 * et comment Companion l'empêche. Jargon technique confiné en fin de page. */

type Icon = IconSvgElement

export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl'
  return (
    <span className={`${box} flex items-center justify-center bg-companion-300 shadow-card`}>
      <HugeIcon icon={AiBrain01Icon} size={size === 'lg' ? 'lg' : 'md'} className="text-brand-black" />
    </span>
  )
}

function Header() {
  const links: [string, string][] = [
    ['#perdu', 'Le problème'],
    ['#produit', 'Le produit'],
    ['#tarifs', 'Tarifs'],
    ['/docs', 'Documentation'],
  ]
  return (
    <header className="sticky top-0 z-20 border-b border-separator-border bg-background-primary-default/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <BrandMark />
          <span className="text-headline-semibold text-text-primary">
            COMPANION <span className="text-text-tertiary">· by KamaLoka</span>
          </span>
        </a>
        <div className="ml-4 hidden items-center gap-5 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-body-2-medium text-text-secondary no-underline hover:text-text-primary">
              {label}
            </a>
          ))}
        </div>
        <span className="flex-1" />
        <ButtonLink variant="secondary" size="small" href="/portal/login">Espace client</ButtonLink>
        <ButtonLink variant="primary" size="small" leadingIcon={adaptIcon(ArrowUpRightIcon, 18)} href="/demo">
          Demander une démonstration
        </ButtonLink>
      </nav>
    </header>
  )
}

function Section({ id, soft, dark, children }: { id?: string; soft?: boolean; dark?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={dark ? 'bg-brand-black' : soft ? 'bg-background-secondary-default' : undefined}>
      <div className="mx-auto max-w-6xl px-6 py-20">{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center gap-1.5 text-caption-1-medium uppercase tracking-[0.14em] text-accent-600">
      {children}
    </span>
  )
}

function Card({ icon, title, children, className = '' }: { icon?: Icon; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card ${className}`}>
      {icon && <HugeIcon icon={icon} size="lg" className="mb-3 text-foreground-icon-secondary" />}
      <h3 className="text-headline-medium text-text-primary">{title}</h3>
      <p className="mt-1.5 text-body-2-regular text-text-secondary">{children}</p>
    </div>
  )
}

/** Capture produit encadrée façon navigateur. */
function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border-button-default bg-background-primary-default shadow-card ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-separator-border bg-background-secondary-default px-3.5 py-2">
        <span className="size-2.5 rounded-full bg-rose-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 flex-1 truncate rounded-md bg-background-primary-default px-2.5 py-1 text-caption-2-medium text-text-tertiary">
          companion.votreentreprise.com
        </span>
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  )
}

function BentoShot({ src, alt, title, children, wide = false }: {
  src: string; alt: string; title: string; children: ReactNode; wide?: boolean
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="p-5 pb-4">
        <h3 className="text-headline-medium text-text-primary">{title}</h3>
        <p className="mt-1 text-body-2-regular text-text-secondary">{children}</p>
      </div>
      <div className="mt-auto px-5 pb-5">
        <img src={src} alt={alt} loading="lazy" className="block w-full rounded-xl border border-separator-border" />
      </div>
    </div>
  )
}

/* ------------------------------- Tarifs ---------------------------------- */

function PriceCard({ chip, name, price, unit, pitch, features, note, cta, href, highlight }: {
  chip: string; name: string; price: string; unit: string; pitch: string
  features: string[]; note?: ReactNode; cta: string; href: string; highlight?: boolean
}) {
  return (
    <div className={`flex flex-col rounded-2xl p-6 shadow-card ${highlight ? 'border-2 border-companion-400 bg-background-primary-default' : 'border border-border-button-default bg-background-primary-default'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-headline-semibold text-text-primary">{name}</h3>
        {highlight && <Chip variant="subtle" color="lime">Recommandé</Chip>}
      </div>
      <p className="mt-1 text-caption-1-medium text-text-tertiary">{chip}</p>
      <p className="mt-4 text-title-1-semibold text-text-primary">{price}</p>
      <p className="text-caption-1-medium text-text-tertiary">{unit}</p>
      <p className="mt-3 text-body-2-regular text-text-secondary">{pitch}</p>
      <ul className="mt-4 space-y-1.5 border-t border-separator-border pt-4">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-body-2-regular text-text-secondary">
            <HugeIcon icon={DocumentValidationIcon} size="xs" className="mt-0.5 shrink-0 text-emerald-600" />
            {f}
          </li>
        ))}
      </ul>
      {note && (
        <p className="mt-4 rounded-xl bg-lime-100/70 px-3.5 py-2.5 text-caption-1-medium text-lime-800">{note}</p>
      )}
      <div className="mt-5 flex-1" />
      <ButtonLink variant={highlight ? 'primary' : 'secondary'} size="medium" className="w-full justify-center" href={href}>
        {cta}
      </ButtonLink>
    </div>
  )
}

function Pricing() {
  return (
    <>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        <PriceCard
          chip="30 jours · 1 département"
          name="Pilote"
          price="350 000 FCFA"
          unit="paiement unique"
          pitch="Pour prouver Companion sur vos propres données avant un déploiement complet."
          features={[
            "jusqu'à 25 collaborateurs", '3 agents', '3 intégrations',
            'Company Brain · Role Brain', 'Knowledge Risk', '1 scénario de Handover · Onboarding',
            'installation accompagnée', 'rapport de fin de pilote',
          ]}
          note="Les 350 000 FCFA sont déduits des frais de déploiement si vous passez en Business dans les 30 jours."
          cta="Lancer un pilote"
          href="/demo?objet=pilote"
        />
        <PriceCard
          highlight
          chip="Toute l'entreprise"
          name="Business"
          price="2 400 000 FCFA / an"
          unit="ou 250 000 FCFA / mois — annuel = 600 000 FCFA d'économie"
          pitch="La mémoire opérationnelle de toute votre entreprise, installée chez vous."
          features={[
            "jusqu'à 100 collaborateurs", '20 agents · 15 intégrations',
            'Company Brain · Role Brain · Employee Memory', 'Knowledge Risk · Handover · Onboarding',
            'MCP · Audit · Sauvegardes', 'BYOK · mises à jour · support standard',
          ]}
          note={<>Mise en production : <b>750 000 FCFA une fois</b> — installation, configuration, première intégration, import initial, formation administrateur.</>}
          cta="Choisir Business"
          href="/demo?objet=business"
        />
        <PriceCard
          chip="Groupes, banques, institutions, environnements sensibles"
          name="Enterprise"
          price="dès 7 500 000 FCFA / an"
          unit="sur devis"
          pitch="Pour 300+ collaborateurs, plusieurs entités et des exigences de sécurité renforcées."
          features={[
            '300+ collaborateurs · plusieurs entités', 'agents personnalisés · intégrations sur mesure',
            'SSO · audit avancé · SLA', 'on-premise / private cloud · options air-gapped',
            'accompagnement DSI · support prioritaire',
          ]}
          cta="Parler à KamaLoka"
          href="/demo?objet=enterprise"
        />
      </div>
      {/* Upsell Managed */}
      <div className="mt-6 rounded-2xl border border-border-button-default bg-background-primary-default p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-headline-semibold text-text-primary">Vous ne voulez rien administrer ?</h3>
            <p className="mt-1 text-body-2-regular text-text-secondary">
              <b className="font-semibold text-text-primary">Companion Managed</b> — nous gérons l'infrastructure,
              les sauvegardes, les mises à jour, le monitoring et la disponibilité de votre instance privée.
            </p>
          </div>
          <span className="text-title-2-semibold text-text-primary">+ 150 000 FCFA / mois</span>
        </div>
      </div>
    </>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      <Header />

      {/* 1 · Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-accent-100/60 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 text-center">
          <p className="text-headline-medium text-text-secondary">Votre meilleur employé peut partir demain.</p>
          <h1
            className="mx-auto mt-3 max-w-3xl font-medium tracking-tight text-text-primary"
            style={{ fontSize: 'clamp(38px,5.5vw,58px)', lineHeight: 1.08 }}
          >
            Son savoir ne doit pas partir avec lui.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-body-medium text-text-secondary">
            Companion capture ce que votre entreprise sait, détecte ce qu'elle risque de perdre et transmet
            automatiquement le contexte aux collaborateurs et agents IA qui en ont besoin.
          </p>
          <p className="mt-4 text-caption-1-medium text-text-tertiary">
            Self-hosted. Vos données restent dans votre infrastructure.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" leadingIcon={adaptIcon(ChartIcon, 20)} href="/demo?objet=risk">
              Évaluer le risque de mon entreprise
            </ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="/demo">Demander une démonstration</ButtonLink>
          </div>
          <p className="mt-6 text-caption-1-medium text-text-tertiary">
            Départs · Turnover · Procédures oubliées · Décisions perdues · Dépendance aux personnes clés
          </p>
          <div className="mx-auto mt-12 max-w-5xl">
            <Shot src={askImg} alt="Ask Companion — réponse citée avec niveau de confiance et sources" />
            <p className="mt-3 text-caption-1-medium text-text-tertiary">
              Ask Companion — chaque réponse cite ses sources. Contexte insuffisant ? Companion s'abstient.
            </p>
          </div>
        </div>
      </section>

      {/* 2 · Le problème, brutalement */}
      <Section soft id="perdu">
        <div className="mx-auto max-w-3xl">
          <Eyebrow>Le problème</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">
            Combien de votre entreprise disparaît quand quelqu'un part ?
          </h2>
          <p className="mt-6 text-body-medium text-text-secondary">Un commercial quitte l'entreprise.</p>
          <ul className="mt-4 space-y-2.5">
            {[
              'Ses clients connaissent ses habitudes.',
              'Il sait comment répondre aux appels d\'offres.',
              'Il connaît les exceptions.',
              'Il sait qui appeler.',
              'Il connaît les erreurs à ne plus refaire.',
            ].map((l) => (
              <li key={l} className="flex items-start gap-2.5 text-body-regular text-text-secondary">
                <HugeIcon icon={UserRemoveIcon} size="xs" className="mt-1 shrink-0 text-rose-400" />
                {l}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-headline-medium text-text-primary">
            Une partie de tout ça n'existe nulle part ailleurs que dans sa tête.
          </p>
          <p className="mt-6 text-body-medium text-text-secondary">
            Companion transforme ce savoir invisible en actif durable pour l'entreprise.
          </p>
          <p className="mt-2 text-title-3-semibold text-text-primary">Avant le départ. Pas après.</p>
        </div>
      </Section>

      {/* 3 · Le résultat, pas les features */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Le résultat</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Companion vous permet de savoir :</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon={UserCircleIcon} title="Qui détient un savoir critique ?" />
          <Card icon={ShieldAlertIcon} title="Quel poste représente un risque ?" />
          <Card icon={FileEditIcon} title="Quelle procédure n'existe que dans la tête d'une personne ?" />
          <Card icon={RocketIcon} title="Qu'est-ce qu'un remplaçant doit apprendre immédiatement ?" />
          <Card icon={HistoryIcon} title="Quelle décision a été prise, pourquoi, et à partir de quelle source ?">
            Chaque connaissance garde sa provenance — jusqu'à la réunion d'origine.
          </Card>
          <Card icon={BotIcon} title="Vos agents IA peuvent-ils y accéder, en sécurité ?">
            Oui — avec vos permissions, pas au-delà.
          </Card>
        </div>
        <div className="mx-auto mt-12 max-w-5xl">
          <Shot src={brainImg} alt="Company Brain — connaissances typées, propriétaires, confiance, statut" />
        </div>
      </Section>

      {/* 4 · Bento produit */}
      <Section soft id="produit">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Le produit, en vrai</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Captures réelles. Aucune maquette.</h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <BentoShot wide src={riskImg} alt="Knowledge Risk — personnes critiques, dépendances, procédures sans doublon" title="Découvrez les personnes que votre entreprise ne peut pas se permettre de perdre.">
            Companion identifie les postes à dépendance critique, les procédures sans doublon et les
            connaissances détenues par une seule personne.
            <b className="font-semibold text-text-primary"> Vous voyez le risque avant qu'il ne devienne une urgence.</b>
          </BentoShot>
          <Card icon={Database01Icon} title="Un cerveau d'entreprise traçable">
            Le socle vérifié : procédures, décisions, faits — chacun avec sa source, son propriétaire
            et son statut. Les contradictions sont signalées, jamais écrasées.
          </Card>
          <BentoShot wide src={handoversImg} alt="Transferts — readiness par poste, pack de handover" title="Quelqu'un part vendredi. Son remplaçant commence lundi.">
            Companion identifie ce que le collaborateur sait encore seul, mène l'entretien de passation,
            transforme ses réponses en connaissances vérifiables et génère automatiquement le pack du successeur.
            <b className="font-semibold text-text-primary"> Le départ d'un salarié ne doit plus effacer six années d'expérience.</b>
          </BentoShot>
          <Card icon={RocketIcon} title="Arrêtez de faire recommencer chaque nouvel employé à zéro.">
            Companion assemble ce que le poste exige, ce que le prédécesseur a transmis, les procédures
            actives, les projets en cours, les personnes à connaître et les erreurs déjà commises.
            <b className="font-semibold text-text-primary"> J1. J7. J30. Le bon contexte, au bon moment.</b>
          </Card>
        </div>
      </Section>

      {/* 5 · Agents IA */}
      <Section id="agents">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Agents IA</Eyebrow>
            <h2 className="text-title-2-medium text-text-primary">
              Des agents qui connaissent<br />réellement votre entreprise.
            </h2>
            <p className="mt-4 text-body-medium text-text-secondary">
              Pas un chatbot générique. Les agents Companion travaillent avec vos procédures, vos décisions,
              vos clients, vos rôles, vos permissions et votre historique. Ils peuvent préparer une relance,
              analyser un risque, préparer un handover ou lancer un workflow.
            </p>
            <p className="mt-4 text-title-3-semibold text-text-primary">
              Une action sensible ? Elle attend votre approbation.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Card icon={ShieldKeyIcon} title="Permissions propagées">Un agent commercial ne voit jamais un dossier RH.</Card>
              <Card icon={DocumentValidationIcon} title="Approbations">L'agent propose, un humain approuve.</Card>
              <Card icon={FileEditIcon} title="Corrections">Chaque correction enrichit la mémoire.</Card>
            </div>
          </div>
          <Shot src={approvalsImg} alt="Approbations — l'agent propose, l'humain approuve" />
        </div>
      </Section>

      {/* 6 · Intégrations */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Intégrations</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">
            Companion apprend depuis les outils que vos équipes utilisent déjà.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Google Drive · Gmail · Microsoft 365 · Teams · SharePoint · WhatsApp Business · Odoo · Slack ·
            Notion · HubSpot · Salesforce · et des centaines d'autres.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-title-3-semibold text-text-primary">
            Pas besoin de migrer votre entreprise vers Companion. Companion vient à elle.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={GoogleDriveIcon} title="Google Workspace">Drive, Gmail, Docs — ingestion continue et sourcée.</Card>
          <Card icon={MicrosoftIcon} title="Microsoft 365">SharePoint, Teams, Outlook — le contexte de vos échanges.</Card>
          <Card icon={WhatsappIcon} title="WhatsApp Business">Les décisions prises dans les discussions deviennent de la mémoire.</Card>
          <Card icon={NetworkIcon} title="Odoo, Slack, Notion, CRM…">Vos processus et vos espaces de travail, déjà connectés.</Card>
        </div>
      </Section>

      {/* 7 · Self-hosted */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Self-hosted</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">
            Votre mémoire d'entreprise n'a rien à faire dans le cloud de quelqu'un d'autre.
          </h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['dans votre VPS', 'dans votre cloud privé', 'dans votre datacenter', 'sur votre infrastructure interne'].map((l) => (
            <div key={l} className="flex items-center gap-2.5 rounded-xl border border-border-button-default bg-background-primary-default px-4 py-3.5 shadow-card">
              <HugeIcon icon={ServerStack01Icon} size="sm" className="shrink-0 text-foreground-icon-secondary" />
              <span className="text-body-2-semibold text-text-primary">{l}</span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-body-medium text-text-secondary">
          Vos documents, conversations et mémoires restent chez vous.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-title-3-semibold text-text-primary">
          KamaLoka fournit le logiciel. Vous gardez les données.
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-center text-caption-1-medium text-text-tertiary">
          IA locale disponible · Licence hors-ligne · Sauvegardes contrôlées · Aucun accès permanent requis par KamaLoka
        </p>
      </Section>

      {/* 8 · ROI */}
      <Section soft>
        <div className="mx-auto max-w-3xl">
          <Eyebrow>ROI</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">
            Le prix d'un départ est souvent supérieur au prix de Companion.
          </h2>
          <p className="mt-5 text-body-medium text-text-secondary">
            Si un responsable quitte l'entreprise avec plusieurs années de décisions, des relations clients,
            des procédures informelles, des exceptions connues de lui seul et des méthodes jamais documentées,
            le coût ne se mesure pas seulement en salaire.
          </p>
          <p className="mt-4 text-body-medium text-text-secondary">Il se mesure en :</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {['temps perdu', 'erreurs répétées', 'clients frustrés', 'onboarding plus long', 'projets ralentis'].map((l) => (
              <div key={l} className="rounded-xl border border-border-button-default bg-background-primary-default px-4 py-3.5 text-center shadow-card">
                <span className="text-body-2-semibold text-text-primary">{l}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-title-3-semibold text-text-primary">
            Companion transforme ce risque en actif transmissible.
          </p>
        </div>
      </Section>

      {/* 9 · Tarifs */}
      <Section id="tarifs">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Tarifs</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Choisissez comment vous voulez commencer.</h2>
        </div>
        <Pricing />
      </Section>

      {/* 10 · Sécurité */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Sécurité · Audit · Permissions</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Conçu pour les exigences<br />des banques et des institutions.</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={Shield01Icon} title="Permissions par rôle">Chaque rôle ne voit que son périmètre — jusqu'à la dernière réponse.</Card>
          <Card icon={HistoryIcon} title="Journal d'audit">Connexions, validations, actions d'agents, exports : tout est tracé.</Card>
          <Card icon={CloudUploadIcon} title="Sauvegardes">Export complet, restauration testée — vos données ne dépendent de personne.</Card>
          <Card icon={Key02Icon} title="Aucune télémétrie">Rien ne remonte sans votre accord. La licence se vérifie hors-ligne.</Card>
        </div>
      </Section>

      {/* 11 · Pour les équipes techniques */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Pour les équipes techniques</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">La mémoire d'entreprise, accessible à vos outils.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Serveur MCP standard, API REST, webhooks signés : vos assistants et vos agents maison interrogent
            la mémoire avec les permissions et l'audit de Companion. Clients à portée limitée, révocables à tout moment.
          </p>
          <p className="mt-4 text-caption-1-medium text-text-tertiary">
            Détails : <a href="/docs" className="text-accent-600 no-underline">documentation développeurs</a>
          </p>
        </div>
      </Section>

      {/* 12 · CTA final */}
      <Section dark>
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex justify-center"><BrandMark size="lg" /></div>
          <h2 className="mt-6 font-medium text-white" style={{ fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.12 }}>
            Si une personne clé partait demain,<br />que perdriez-vous ?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-white/70">
            Découvrez-le avant son départ.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" leadingIcon={adaptIcon(ChartIcon, 20)} href="/demo?objet=risk">
              Évaluer mon Knowledge Risk
            </ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="/demo">
              Demander une démo de 30 min
            </ButtonLink>
          </div>
          <p className="mt-6 text-caption-1-medium text-white/50">
            Pilote accompagné à partir de <b className="text-white">350 000 FCFA</b>.
          </p>
        </div>
      </Section>

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
