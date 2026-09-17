import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import type { IconSvgElement } from '@hugeicons/react'
import { cx } from '@/utils/cx'
import {
  AiBrain01Icon, AlertCircleIcon, ApiIcon, ArrowRight02Icon, ArrowUpRightIcon, BotIcon,
  Building01Icon, ChartIcon, CloudIcon, CloudUploadIcon, Database01Icon, DocumentValidationIcon,
  FileEditIcon, GoogleDriveIcon, HandshakeIcon, HistoryIcon, HierarchyIcon, Key02Icon,
  MicrosoftIcon, NetworkIcon, PlugIcon, RocketIcon, ServerStack01Icon, Shield01Icon,
  ShieldAlertIcon, ShieldKeyIcon, ShieldUserIcon, TimeIcon, UserCircleIcon, UserRemoveIcon,
  WhatsappIcon,
} from '@/lib/icons'

import askImg from './assets/ask.png'
import riskImg from './assets/knowledge-risk.png'
import handoversImg from './assets/handovers.png'
import brainImg from './assets/brain.png'
import approvalsImg from './assets/approvals.png'

/* Surface marketing — companion.kamaloka.ai. Style bento (réf. lattice.com) :
 * chips d'icônes colorées, blobs de dégradé, bande sombre, apparitions au scroll. */

type Icon = IconSvgElement
type Tone = 'lime' | 'blue' | 'purple' | 'amber' | 'rose' | 'cyan'

const TONE_CHIP: Record<Tone, string> = {
  lime: 'bg-companion-300/50 text-lime-900',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-600',
  cyan: 'bg-cyan-100 text-cyan-700',
}

/** Apparition douce au scroll (respecte prefers-reduced-motion). */
function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={cx(
        'transition-all duration-700 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

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

function Section({ id, soft, dark, children, className = '' }: { id?: string; soft?: boolean; dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={dark ? 'bg-brand-black text-white' : soft ? 'bg-background-secondary-default' : undefined}>
      <div className={cx('mx-auto max-w-6xl px-6 py-20', className)}>{children}</div>
    </section>
  )
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={cx('mb-4 inline-flex items-center gap-1.5 text-caption-1-medium uppercase tracking-[0.14em]', dark ? 'text-companion-300' : 'text-accent-600')}>
      {children}
    </span>
  )
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-title-2-medium text-text-primary">{title}</h2>
      {sub && <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">{sub}</p>}
    </Reveal>
  )
}

/** Carte avec chip d'icône colorée (façon Lattice). */
function Card({ icon, tone = 'blue', title, children, className = '' }: {
  icon?: Icon; tone?: Tone; title: string; children?: ReactNode; className?: string
}) {
  return (
    <div className={cx(
      'h-full rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
      className,
    )}>
      {icon && (
        <span className={cx('mb-3 flex size-11 items-center justify-center rounded-xl', TONE_CHIP[tone])}>
          <HugeIcon icon={icon} size="md" />
        </span>
      )}
      <h3 className="text-headline-medium text-text-primary">{title}</h3>
      {children && <p className="mt-1.5 text-body-2-regular text-text-secondary">{children}</p>}
    </div>
  )
}

/** Capture produit encadrée façon navigateur. */
function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border-button-default bg-background-primary-default shadow-card transition-shadow duration-300 hover:shadow-xl ${className}`}>
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
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${wide ? 'lg:col-span-2' : ''}`}>
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
    <div className={`flex flex-col rounded-2xl p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${highlight ? 'border-2 border-companion-400 bg-background-primary-default' : 'border border-border-button-default bg-background-primary-default'}`}>
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
        <Reveal>
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
        </Reveal>
        <Reveal delay={120}>
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
        </Reveal>
        <Reveal delay={240}>
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
        </Reveal>
      </div>
      <Reveal delay={150}>
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
      </Reveal>
    </>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      <Header />

      {/* 1 · Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-companion-300/25 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-24 size-[480px] rounded-full bg-accent-500/15 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 text-center">
          <Reveal>
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
          </Reveal>
          <Reveal delay={120}>
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { v: '100 %', l: 'réponses citées' },
                { v: '760+', l: 'intégrations' },
                { v: '~1 h', l: 'installation prête' },
                { v: '0', l: 'donnée qui sort' },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-border-button-default bg-background-primary-default/80 px-4 py-4 shadow-card">
                  <p className="text-title-3-semibold text-text-primary">{s.v}</p>
                  <p className="text-caption-1-medium text-text-tertiary">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={200} className="mx-auto mt-12 max-w-5xl">
            <Shot src={askImg} alt="Ask Companion — réponse citée avec niveau de confiance et sources" />
            <p className="mt-3 text-caption-1-medium text-text-tertiary">
              Ask Companion — chaque réponse cite ses sources. Contexte insuffisant ? Companion s'abstient.
            </p>
          </Reveal>
        </div>
      </section>

      {/* 2 · Le problème, brutalement */}
      <Section soft id="perdu">
        <SectionHead
          eyebrow="Le problème"
          title={<>Combien de votre entreprise disparaît<br />quand quelqu'un part ?</>}
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: UserCircleIcon, tone: 'rose' as Tone, t: 'Ses clients', d: 'leurs habitudes, leur historique, leur confiance.' },
            { icon: DocumentValidationIcon, tone: 'amber' as Tone, t: "Ses appels d'offres", d: 'la méthode exacte qui gagne les marchés.' },
            { icon: NetworkIcon, tone: 'purple' as Tone, t: 'Les exceptions', d: "ce qu'aucune procédure écrite ne couvre." },
            { icon: HistoryIcon, tone: 'cyan' as Tone, t: 'Ses contacts', d: 'qui appeler, quand, et comment.' },
            { icon: ShieldAlertIcon, tone: 'blue' as Tone, t: 'Ses erreurs', d: 'celles à ne plus jamais refaire.' },
          ].map((item, i) => (
            <Reveal key={item.t} delay={i * 90}>
              <div className="h-full rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <span className={cx('mb-2.5 flex size-10 items-center justify-center rounded-xl', TONE_CHIP[item.tone])}>
                  <HugeIcon icon={item.icon} size="md" />
                </span>
                <p className="text-body-2-semibold text-text-primary">{item.t}</p>
                <p className="mt-0.5 text-caption-1-medium text-text-secondary">{item.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200} className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-headline-medium text-text-primary">
            Une partie de tout ça n'existe nulle part ailleurs que dans sa tête.
          </p>
          <p className="mt-5 text-body-medium text-text-secondary">
            Companion transforme ce savoir invisible en actif durable pour l'entreprise.
          </p>
          <p className="mt-2 text-title-3-semibold text-text-primary">Avant le départ. Pas après.</p>
        </Reveal>
      </Section>

      {/* 3 · Le résultat, pas les features */}
      <Section>
        <SectionHead
          eyebrow="Le résultat"
          title="Companion vous permet de savoir :"
          sub="Cinq questions auxquelles la plupart des entreprises ne peuvent pas répondre en une réunion. Companion y répond en une recherche."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: UserCircleIcon, tone: 'blue' as Tone, t: 'Qui détient un savoir critique ?', d: 'Chaque connaissance est rattachée à son propriétaire — les dépendances deviennent visibles.' },
            { icon: ShieldAlertIcon, tone: 'rose' as Tone, t: 'Quel poste représente un risque ?', d: 'Un score par poste, calculé sur la couverture, la fraîcheur et la dépendance.' },
            { icon: FileEditIcon, tone: 'amber' as Tone, t: "Quelle procédure n'existe que dans une tête ?", d: 'Les procédures sans doublon ni documentation sont signalées automatiquement.' },
            { icon: RocketIcon, tone: 'lime' as Tone, t: 'Que doit apprendre un remplaçant, maintenant ?', d: 'Le plan J1 · J7 · J30 se construit depuis le poste, pas depuis des suppositions.' },
            { icon: HistoryIcon, tone: 'cyan' as Tone, t: 'Quelle décision a été prise, et pourquoi ?', d: "Chaque réponse cite sa source — jusqu'à la réunion d'origine." },
            { icon: BotIcon, tone: 'purple' as Tone, t: 'Vos agents IA peuvent-ils y accéder, en sécurité ?', d: 'Oui — avec vos permissions, jamais au-delà, et sous approbation pour toute action sensible.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={(i % 3) * 100}>
              <Card icon={c.icon} tone={c.tone} title={c.t}>{c.d}</Card>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150} className="mx-auto mt-12 max-w-5xl">
          <Shot src={brainImg} alt="Company Brain — connaissances typées, propriétaires, confiance, statut" />
        </Reveal>
      </Section>

      {/* 4 · Bento produit */}
      <Section soft id="produit">
        <SectionHead
          eyebrow="Le produit, en vrai"
          title="Captures réelles. Aucune maquette."
          sub="Ce que vous voyez ci-dessous tourne aujourd'hui sur une instance Companion."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <BentoShot wide src={riskImg} alt="Knowledge Risk — personnes critiques, dépendances, procédures sans doublon" title="Découvrez les personnes que votre entreprise ne peut pas se permettre de perdre.">
              Companion identifie les postes à dépendance critique, les procédures sans doublon et les
              connaissances détenues par une seule personne.
              <b className="font-semibold text-text-primary"> Vous voyez le risque avant qu'il ne devienne une urgence.</b>
            </BentoShot>
          </Reveal>
          <Reveal delay={120}>
            <Card icon={Database01Icon} tone="blue" title="Un cerveau d'entreprise traçable">
              Le socle vérifié : procédures, décisions, faits — chacun avec sa source, son propriétaire
              et son statut. Les contradictions sont signalées, jamais écrasées.
            </Card>
          </Reveal>
          <Reveal className="lg:col-span-2">
            <BentoShot wide src={handoversImg} alt="Transferts — readiness par poste, pack de handover" title="Quelqu'un part vendredi. Son remplaçant commence lundi.">
              Companion identifie ce que le collaborateur sait encore seul, mène l'entretien de passation,
              transforme ses réponses en connaissances vérifiables et génère automatiquement le pack du successeur.
              <b className="font-semibold text-text-primary"> Le départ d'un salarié ne doit plus effacer six années d'expérience.</b>
            </BentoShot>
          </Reveal>
          <Reveal delay={120}>
            <Card icon={RocketIcon} tone="lime" title="Arrêtez de faire recommencer chaque nouvel employé à zéro.">
              Companion assemble ce que le poste exige, ce que le prédécesseur a transmis, les procédures
              actives, les projets en cours, les personnes à connaître et les erreurs déjà commises.
              <b className="font-semibold text-text-primary"> J1. J7. J30. Le bon contexte, au bon moment.</b>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* 5 · Agents IA */}
      <Section id="agents">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
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
              <Card icon={ShieldKeyIcon} tone="blue" title="Permissions propagées">Un agent commercial ne voit jamais un dossier RH.</Card>
              <Card icon={DocumentValidationIcon} tone="lime" title="Approbations">L'agent propose, un humain approuve.</Card>
              <Card icon={FileEditIcon} tone="purple" title="Corrections">Chaque correction enrichit la mémoire.</Card>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <Shot src={approvalsImg} alt="Approbations — l'agent propose, l'humain approuve" />
          </Reveal>
        </div>
      </Section>

      {/* 6 · Bandeau signature de marque */}
      <Section dark className="!py-14">
        <Reveal className="text-center">
          <p className="text-caption-1-medium uppercase tracking-[0.2em] text-companion-300">Companion</p>
          <p
            className="mx-auto mt-4 max-w-3xl font-medium text-white"
            style={{ fontSize: 'clamp(30px,4.5vw,48px)', lineHeight: 1.15 }}
          >
            « Votre entreprise n'oublie plus. »
          </p>
          <p className="mx-auto mt-4 max-w-xl text-body-regular text-white/60">
            Les personnes passent. Le savoir reste — dans votre infrastructure, sous vos règles.
          </p>
        </Reveal>
      </Section>

      {/* 7 · Intégrations */}
      <Section soft>
        <SectionHead
          eyebrow="Intégrations"
          title="Companion apprend depuis les outils que vos équipes utilisent déjà."
          sub="Google Drive · Gmail · Microsoft 365 · Teams · SharePoint · WhatsApp Business · Odoo · Slack · Notion · HubSpot · Salesforce · et des centaines d'autres."
        />
        <Reveal delay={150}>
          <p className="mx-auto mt-6 max-w-2xl text-center text-title-3-semibold text-text-primary">
            Pas besoin de migrer votre entreprise vers Companion. Companion vient à elle.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: GoogleDriveIcon, tone: 'blue' as Tone, t: 'Google Workspace', d: 'Drive, Gmail, Docs — ingestion continue et sourcée.' },
            { icon: MicrosoftIcon, tone: 'cyan' as Tone, t: 'Microsoft 365', d: 'SharePoint, Teams, Outlook — le contexte de vos échanges.' },
            { icon: WhatsappIcon, tone: 'lime' as Tone, t: 'WhatsApp Business', d: 'Les décisions prises dans les discussions deviennent de la mémoire.' },
            { icon: PlugIcon, tone: 'purple' as Tone, t: 'Odoo, Slack, Notion, CRM…', d: 'Vos processus et vos espaces de travail, déjà connectés.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <Card icon={c.icon} tone={c.tone} title={c.t}>{c.d}</Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 8 · Self-hosted — bande sombre */}
      <Section dark>
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow dark>Self-hosted</Eyebrow>
          <h2 className="text-title-2-medium text-white">
            Votre mémoire d'entreprise n'a rien à faire<br />dans le cloud de quelqu'un d'autre.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ServerStack01Icon, t: 'Votre VPS', d: 'Le déploiement le plus courant — opérationnel en une heure.' },
            { icon: CloudIcon, t: 'Votre cloud privé', d: 'AWS, Azure, GCP ou OVH — dans votre périmètre.' },
            { icon: Database01Icon, t: 'Votre datacenter', d: 'On-premise complet, sans dépendance réseau sortante.' },
            { icon: Building01Icon, t: 'Votre infrastructure', d: 'Là où vos autres outils critiques vivent déjà.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">
                <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-companion-300/20 text-companion-300">
                  <HugeIcon icon={c.icon} size="md" />
                </span>
                <p className="text-body-2-semibold text-white">Installé {c.t.toLowerCase()}</p>
                <p className="mt-0.5 text-caption-1-medium text-white/60">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150} className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-body-medium text-white/70">Vos documents, conversations et mémoires restent chez vous.</p>
          <p className="mt-3 text-title-3-semibold text-companion-300">
            KamaLoka fournit le logiciel. Vous gardez les données.
          </p>
          <p className="mt-5 text-caption-1-medium text-white/50">
            IA locale disponible · Licence hors-ligne · Sauvegardes contrôlées · Aucun accès permanent requis par KamaLoka
          </p>
        </Reveal>
      </Section>

      {/* 9 · ROI */}
      <Section>
        <SectionHead
          eyebrow="ROI"
          title="Le prix d'un départ est souvent supérieur au prix de Companion."
          sub="Si un responsable quitte l'entreprise avec plusieurs années de décisions, des relations clients, des procédures informelles et des méthodes jamais documentées, le coût ne se mesure pas seulement en salaire."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { icon: TimeIcon, tone: 'amber' as Tone, t: 'Temps perdu', d: "à chercher ce que quelqu'un savait." },
            { icon: AlertCircleIcon, tone: 'rose' as Tone, t: 'Erreurs répétées', d: 'les mêmes pièges, redécouverts.' },
            { icon: UserCircleIcon, tone: 'purple' as Tone, t: 'Clients frustrés', d: 'qui repartent expliquer leur dossier.' },
            { icon: RocketIcon, tone: 'blue' as Tone, t: 'Onboarding plus long', d: 'des mois pour refaire ce qui existait.' },
            { icon: HierarchyIcon, tone: 'cyan' as Tone, t: 'Projets ralentis', d: "en attente d'une réponse introuvable." },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <Card icon={c.icon} tone={c.tone} title={c.t}>{c.d}</Card>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <p className="mt-10 text-center text-title-3-semibold text-text-primary">
            Companion transforme ce risque en actif transmissible.
          </p>
        </Reveal>
      </Section>

      {/* 10 · Tarifs */}
      <Section soft id="tarifs">
        <SectionHead
          eyebrow="Tarifs"
          title="Choisissez comment vous voulez commencer."
          sub="Chaque offre est une licence annuelle installée dans votre infrastructure. Aucun frais caché, aucune donnée qui sort."
        />
        <Pricing />
      </Section>

      {/* 11 · Sécurité */}
      <Section>
        <SectionHead
          eyebrow="Sécurité · Audit · Permissions"
          title={<>Conçu pour les exigences<br />des banques et des institutions.</>}
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Shield01Icon, tone: 'lime' as Tone, t: 'Permissions par rôle', d: "Chaque rôle ne voit que son périmètre — jusqu'à la dernière réponse." },
            { icon: HistoryIcon, tone: 'blue' as Tone, t: "Journal d'audit", d: "Connexions, validations, actions d'agents, exports : tout est tracé." },
            { icon: CloudUploadIcon, tone: 'purple' as Tone, t: 'Sauvegardes', d: 'Export complet, restauration testée — vos données ne dépendent de personne.' },
            { icon: Key02Icon, tone: 'amber' as Tone, t: 'Aucune télémétrie', d: 'Rien ne remonte sans votre accord. La licence se vérifie hors-ligne.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 90}>
              <Card icon={c.icon} tone={c.tone} title={c.t}>{c.d}</Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 12 · Pour les équipes techniques */}
      <Section soft>
        <SectionHead
          eyebrow="Pour les équipes techniques"
          title="La mémoire d'entreprise, accessible à vos outils."
          sub="Vos assistants et vos agents maison interrogent la mémoire de l'entreprise avec les permissions et l'audit de Companion — sans jamais contourner les droits de chacun."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: BotIcon, tone: 'purple' as Tone, t: 'Protocole standard', d: 'Vos assistants (Claude, Cursor, agents maison) se connectent au protocole MCP ouvert.' },
            { icon: ApiIcon, tone: 'blue' as Tone, t: 'API & webhooks', d: 'REST authentifié, webhooks signés : poussez des documents, recevez les événements.' },
            { icon: ShieldKeyIcon, tone: 'lime' as Tone, t: 'Accès contrôlés', d: 'Clients à portée limitée — scopes, outils autorisés, expiration, révocation immédiate.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 100}>
              <Card icon={c.icon} tone={c.tone} title={c.t}>{c.d}</Card>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <p className="mt-8 text-center text-caption-1-medium text-text-tertiary">
            Documentation complète : <a href="/docs" className="text-accent-600 no-underline">docs.companion.kamaloka.ai</a>
          </p>
        </Reveal>
      </Section>

      {/* 13 · CTA final */}
      <Section dark>
        <Reveal className="mx-auto max-w-3xl text-center">
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
        </Reveal>
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
