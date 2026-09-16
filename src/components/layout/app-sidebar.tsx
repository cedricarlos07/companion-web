import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  Activity01Icon,
  AiBrain01Icon,
  AiChat02Icon,
  BotIcon,
  CheckmarkBadge01Icon,
  Database01Icon,
  Exchange01Icon,
  Home01Icon,
  PlugIcon,
  Search01Icon,
  Settings01Icon,
  ShieldAlertIcon,
  UserAdd01Icon,
  UserGroupIcon,
  HierarchyIcon,
  WorkflowIcon,
  MenuIcon,
  LogoutIcon,
  UserCircleIcon,
  PlusSignIcon,
} from '@/lib/icons'
import { Kbd } from '@/components/base/kbd/kbd'
import { Dropdown, DropdownTrigger, DropdownPopover, DropdownGroup, DropdownItem, DropdownDivider } from '@/components/base/dropdown/dropdown'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ORG } from '@/data/org'
import { useAppStore } from '@/store/app-store'

interface NavItem {
  to: string
  label: string
  icon: typeof Home01Icon
  end?: boolean
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Général',
    items: [
      { to: '/home', label: 'Accueil', icon: Home01Icon, end: true },
      { to: '/ask', label: 'Demander à Companion', icon: AiChat02Icon },
      { to: '/brain', label: 'Company Brain', icon: AiBrain01Icon },
    ],
  },
  {
    title: 'Connaissances',
    items: [
      { to: '/people', label: 'Personnes', icon: UserGroupIcon },
      { to: '/roles', label: 'Rôles', icon: HierarchyIcon },
      { to: '/sources', label: 'Sources', icon: Database01Icon },
      { to: '/knowledge-risk', label: 'Risque de savoir', icon: ShieldAlertIcon },
    ],
  },
  {
    title: 'Continuité',
    items: [
      { to: '/handovers', label: 'Transferts', icon: Exchange01Icon },
      { to: '/onboarding', label: 'Intégration', icon: UserAdd01Icon },
    ],
  },
  {
    title: 'Agentique',
    items: [
      { to: '/agents', label: 'Agents', icon: BotIcon },
      { to: '/automations', label: 'Automatisations', icon: WorkflowIcon },
    ],
  },
  {
    title: 'Contrôle',
    items: [
      { to: '/approvals', label: 'Approbations', icon: CheckmarkBadge01Icon },
      { to: '/activity', label: 'Activité', icon: Activity01Icon },
    ],
  },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { approvals } = useAppStore()
  const pendingCount = approvals.filter((a) => a.status === 'pending').length

  return (
    <aside
      className={cx(
        'flex h-full shrink-0 flex-col border-r border-separator-border bg-background-secondary-default transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className={cx('flex items-center gap-2.5 px-4 pt-4 pb-3', collapsed && 'justify-center px-2')}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-button-primary text-text-white shadow-xs">
          <HugeIcon icon={AiBrain01Icon} size="sm" className="text-white" />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-headline-semibold text-text-primary">Companion</span>
            <span className="block truncate text-caption-1-medium text-text-tertiary">
              Votre entreprise n'oublie plus.
            </span>
          </span>
        )}
      </div>

      {/* Workspace switcher */}
      {!collapsed ? (
        <div className="px-3 pb-2">
          <Dropdown>
            <DropdownTrigger
              className="flex w-full items-center gap-2.5 rounded-xl border border-border-button-default bg-background-primary-default px-2.5 py-2 text-left hover:bg-background-primary-hover"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-100 text-caption-1-semibold text-accent-700">
                K
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-2-medium text-text-primary">{ORG.workspace}</span>
                <span className="block text-caption-1-medium text-text-tertiary">{ORG.employees} employés</span>
              </span>
              <HugeIcon icon={MenuIcon} size="xs" className="shrink-0 text-foreground-icon-tertiary rotate-90" />
            </DropdownTrigger>
            <DropdownPopover aria-label="Menu de l'espace de travail">
              <DropdownGroup label="Espaces de travail">
                <DropdownItem selected>🏢 {ORG.workspace}</DropdownItem>
                <DropdownItem onSelect={() => navigate('/setup')}>
                  <span className="inline-flex items-center gap-2">
                    <HugeIcon icon={PlusSignIcon} size="xs" />
                    Créer un espace
                  </span>
                </DropdownItem>
              </DropdownGroup>
              <DropdownDivider />
              <DropdownItem onSelect={() => navigate('/settings')}>
                <span className="inline-flex items-center gap-2">
                  <HugeIcon icon={Settings01Icon} size="xs" />
                  Paramètres de l'espace
                </span>
              </DropdownItem>
            </DropdownPopover>
          </Dropdown>
        </div>
      ) : (
        <div className="flex justify-center pb-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-100 text-caption-1-semibold text-accent-700">
            K
          </span>
        </div>
      )}

      {/* Search trigger */}
      <div className={cx('pb-2', collapsed ? 'px-2' : 'px-3')}>
        <button
          type="button"
          onClick={() => navigate('/home?search=open')}
          className="flex w-full items-center gap-2 rounded-lg border border-border-button-default bg-background-primary-default px-2.5 py-1.5 text-text-tertiary hover:bg-background-primary-hover"
          aria-label="Rechercher dans Companion"
        >
          <HugeIcon icon={Search01Icon} size="sm" className="shrink-0" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-body-2-regular">
                Rechercher dans Companion
              </span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2" aria-label="Navigation principale">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-3">
            {!collapsed && (
              <p className="px-2 pb-1 text-caption-1-semibold tracking-wide text-text-tertiary uppercase">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-body-2-medium outline-none transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                        isActive
                          ? 'bg-background-primary-default text-text-primary shadow-card'
                          : 'text-text-secondary hover:bg-background-primary-default hover:text-text-primary',
                        collapsed && 'justify-center px-2',
                      )
                    }
                  >
                    <HugeIcon icon={item.icon} size="md" className="shrink-0" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.to === '/approvals' && pendingCount > 0 && (
                      <span className="rounded-full bg-accent-500 px-1.5 text-caption-2-semibold text-text-white tabular-nums">
                        {pendingCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-separator-border px-3 py-2">
        <ul className="space-y-0.5">
          {[
            { to: '/integrations', label: 'Intégrations', icon: PlugIcon },
            { to: '/settings', label: 'Paramètres', icon: Settings01Icon },
          ].map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-body-2-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    isActive
                      ? 'bg-background-primary-default text-text-primary shadow-card'
                      : 'text-text-secondary hover:bg-background-primary-default hover:text-text-primary',
                    collapsed && 'justify-center px-2',
                  )
                }
              >
                <HugeIcon icon={item.icon} size="md" className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Profile */}
        <div className={cx('mt-1', collapsed ? 'flex justify-center' : '')}>
          <Dropdown>
            <DropdownTrigger
              className={cx(
                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-background-primary-default',
                collapsed && 'w-auto px-1',
              )}
            >
              <PersonAvatar name={ORG.currentUser} size="md" />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-2-medium text-text-primary">{ORG.currentUser}</span>
                  <span className="block truncate text-caption-1-medium text-text-tertiary">
                    {ORG.currentUserRole}
                  </span>
                </span>
              )}
            </DropdownTrigger>
            <DropdownPopover aria-label="Menu du profil">
              <DropdownGroup>
                <DropdownItem onSelect={() => navigate('/settings')}>
                  <span className="inline-flex items-center gap-2">
                    <HugeIcon icon={UserCircleIcon} size="xs" />
                    Mon profil
                  </span>
                </DropdownItem>
                <DropdownItem onSelect={() => navigate('/login')}>
                  <span className="inline-flex items-center gap-2">
                    <HugeIcon icon={LogoutIcon} size="xs" />
                    Se déconnecter
                  </span>
                </DropdownItem>
              </DropdownGroup>
            </DropdownPopover>
          </Dropdown>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
          className={cx(
            'mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-body-2-medium text-text-tertiary hover:bg-background-primary-default hover:text-text-primary',
            collapsed && 'justify-center px-2',
          )}
        >
          <HugeIcon icon={MenuIcon} size="md" className={cx('shrink-0 transition-transform', collapsed ? '' : 'rotate-180')} />
          {!collapsed && <span>Replier</span>}
        </button>
      </div>
    </aside>
  )
}

export { adaptIcon }
