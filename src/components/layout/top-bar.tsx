import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import { adaptIcon } from '@/components/ui/huge-icon'
import { Button } from '@/components/base/buttons/button'
import { IconButton } from '@/components/base/buttons/icon-button'
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip'
import { CloseButton } from '@/components/base/buttons/close-button'
import { Chip } from '@/components/base/badges/chip'
import {
  AlertCircleIcon,
  BotIcon,
  Notification01Icon,
  PlusSignIcon,
  Shield01Icon,
  AiBrain01Icon,
  CheckmarkCircle02Icon,
  Calendar01Icon,
  Search01Icon,
} from '@/lib/icons'
import { useAppStore } from '@/store/app-store'
import { ThemeToggle } from '@/components/common/theme-toggle'
import type { AppNotification } from '@/types'

const CATEGORY_META: Record<
  AppNotification['category'],
  { label: string; icon: typeof BotIcon }
> = {
  attention: { label: 'À traiter', icon: AlertCircleIcon },
  agents: { label: 'Agents', icon: BotIcon },
  knowledge: { label: 'Connaissances', icon: AiBrain01Icon },
  security: { label: 'Sécurité', icon: Shield01Icon },
}

/** Top context bar: search, date, notifications popover, add source. */
export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [notifOpen, setNotifOpen] = useState(false)
  const { notifications, dismissNotification, pushToast } = useAppStore()
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-separator-border bg-background-secondary-default px-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center gap-2 rounded-lg border border-border-button-default bg-background-primary-default px-2.5 py-1.5 text-text-tertiary hover:bg-background-primary-hover"
        aria-label="Rechercher"
      >
        <HugeIcon icon={Search01Icon} size="sm" />
        <span className="hidden text-body-2-regular md:inline">Rechercher</span>
      </button>

      <span className="hidden items-center gap-1.5 text-caption-1-medium text-text-tertiary lg:flex">
        <HugeIcon icon={Calendar01Icon} size="xs" />
        <span className="capitalize">{today}</span>
      </span>

      <div className="flex-1" />

      <ThemeToggle />

      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="secondary"
            size="small"
            leadingIcon={adaptIcon(PlusSignIcon, 18)}
            onClick={() => {
              navigate('/sources/new')
              pushToast('Choisissez un type de source à connecter.', 'info')
            }}
          >
            Ajouter une source
          </Button>
        </TooltipTrigger>
        Importer une nouvelle source de connaissances
      </Tooltip>

      <div className="relative">
        <IconButton
          
          size="small"
          icon={adaptIcon(Notification01Icon, 20)}
          aria-label={`Notifications (${unread} non lues)`}
          aria-expanded={notifOpen}
          onClick={() => setNotifOpen((o) => !o)}
        />
        {unread > 0 && (
          <span
            className="pointer-events-none absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-companion-300 text-[10px] leading-4 font-semibold text-brand-black tabular-nums"
            aria-hidden
          >
            {unread}
          </span>
        )}
        {notifOpen && (
          <NotificationPopover
            onClose={() => setNotifOpen(false)}
            onDismiss={(id) => {
              dismissNotification(id)
              pushToast('Notification supprimée.', 'info')
            }}
          />
        )}
      </div>
    </header>
  )
}

function NotificationPopover({
  onClose,
  onDismiss,
}: {
  onClose: () => void
  onDismiss: (id: string) => void
}) {
  const { notifications } = useAppStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | AppNotification['category']>('all')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = filter === 'all' ? notifications : notifications.filter((n) => n.category === filter)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} role="presentation" />
      <div
        role="dialog"
        aria-label="Centre de notifications"
        className="absolute top-10 right-0 z-50 w-96 overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-separator-border px-4 py-3">
          <h2 className="text-headline-medium text-text-primary">Notifications</h2>
          <CloseButton onClick={onClose} aria-label="Fermer les notifications" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b border-separator-border px-4 py-2">
          <Chip
            variant="caption"
            color={filter === 'all' ? 'blue' : 'soft'}
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            Tout
          </Chip>
          {(Object.keys(CATEGORY_META) as AppNotification['category'][]).map((cat) => (
            <Chip
              key={cat}
              variant="caption"
              color={filter === cat ? 'blue' : 'soft'}
              className="cursor-pointer"
              onClick={() => setFilter(cat)}
            >
              {CATEGORY_META[cat].label}
            </Chip>
          ))}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {list.length === 0 && (
            <p className="px-4 py-10 text-center text-body-2-regular text-text-tertiary">
              Aucune notification dans cette catégorie.
            </p>
          )}
          {list.map((n) => {
            const Icon = CATEGORY_META[n.category].icon
            return (
              <div
                key={n.id}
                className={cx(
                  'group flex items-start gap-3 border-b border-separator-border px-4 py-3 last:border-b-0',
                  !n.read && 'bg-accent-50/60',
                )}
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-background-secondary-default">
                  <HugeIcon icon={Icon} size="xs" className="text-foreground-icon-secondary" />
                </span>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onClose()
                    if (n.href) navigate(n.href)
                  }}
                >
                  <p className="text-body-2-medium text-text-primary">{n.title}</p>
                  {n.detail && <p className="mt-0.5 text-caption-1-medium text-text-secondary">{n.detail}</p>}
                  <p className="mt-1 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
                    <HugeIcon icon={CheckmarkCircle02Icon} size="xs" />
                    {n.time}
                  </p>
                </button>
                <span className="opacity-0 transition-opacity group-hover:opacity-100">
                  <CloseButton onClick={() => onDismiss(n.id)} aria-label="Supprimer la notification" />
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
