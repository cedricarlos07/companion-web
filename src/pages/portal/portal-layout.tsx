import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { Chip } from '@/components/base/badges/chip'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  Home01Icon,
  CheckmarkBadge01Icon,
  DownloadIcon,
  ServerStack01Icon,
  File01Icon,
  Message01Icon,
  LogoutIcon,
} from '@/lib/icons'
import { PORTAL_CUSTOMER } from '@/data/portal'

const NAV = [
  { to: '/portal', label: 'Accueil', icon: Home01Icon, end: true },
  { to: '/portal/license', label: 'Licence', icon: CheckmarkBadge01Icon, end: false },
  { to: '/portal/downloads', label: 'Téléchargements', icon: DownloadIcon, end: false },
  { to: '/portal/instances', label: 'Instances', icon: ServerStack01Icon, end: false },
  { to: '/portal/invoices', label: 'Factures', icon: File01Icon, end: false },
  { to: '/portal/support', label: 'Support', icon: Message01Icon, end: false },
]

/**
 * Portail Client KamaLoka (portal.companion.kamaloka.ai).
 *
 * Espace post-vente réservé aux clients abonnés : licence, téléchargements,
 * instances, factures, support. Surface volontairement séparée de Companion —
 * les employés travaillent dans l'application, le DSI / les achats gèrent la
 * relation avec KamaLoka ici. Aucune donnée métier ne transite par ce portail.
 */
export function PortalLayout() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col bg-background-full">
      <header className="sticky top-0 z-20 border-b border-separator-border bg-background-primary-default">
        <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center gap-3 px-6">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-black text-caption-1-bold text-companion-300">
            K
          </span>
          <span className="text-headline-semibold text-text-primary">KamaLoka</span>
          <Chip variant="subtle" color="lime">Portail client</Chip>
          <div className="flex-1" />
          <span className="hidden text-body-2-medium text-text-secondary sm:inline">
            {PORTAL_CUSTOMER.name}
          </span>
          <button
            type="button"
            onClick={() => navigate('/login')}
            aria-label="Se déconnecter du portail client"
            className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <HugeIcon icon={LogoutIcon} size="sm" />
          </button>
        </div>
        <nav
          className="mx-auto flex w-full max-w-[1080px] gap-1 overflow-x-auto px-6"
          aria-label="Navigation du portail client"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-body-2-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                  isActive
                    ? 'border-companion-600 text-text-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-primary',
                )
              }
            >
              <HugeIcon icon={item.icon} size="xs" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-separator-border px-6 py-3">
        <p className="mx-auto max-w-[1080px] text-caption-1-regular text-text-tertiary">
          portal.companion.kamaloka.ai — relation commerciale et technique. Votre instance
          Companion reste auto-hébergée : aucune donnée métier ne transite par ce portail.
        </p>
      </footer>
    </div>
  )
}
