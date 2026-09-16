import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import type { IconSvgElement } from '@hugeicons/react'
import { AlertCircleIcon, InboxIcon } from '@/lib/icons'

/** Intentional empty state with a subtle icon, message and CTA. */
export function EmptyState({
  icon = InboxIcon,
  title,
  detail,
  action,
  className,
}: {
  icon?: IconSvgElement
  title: string
  detail?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-2 py-14 text-center', className)}>
      <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-background-secondary-default">
        <HugeIcon icon={icon} size="md" className="text-foreground-icon-tertiary" />
      </span>
      <p className="text-headline-medium text-text-primary">{title}</p>
      {detail && <p className="max-w-sm text-body-2-regular text-text-secondary">{detail}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Error state with recovery actions. */
export function ErrorState({
  title,
  detail,
  actions,
}: {
  title: string
  detail?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-button-default bg-background-primary-default p-4">
      <HugeIcon icon={AlertCircleIcon} size="md" className="mt-0.5 shrink-0 text-rose-500" />
      <div className="min-w-0">
        <p className="text-body-medium font-medium text-text-primary">{title}</p>
        {detail && <p className="mt-0.5 text-body-2-regular text-text-secondary">{detail}</p>}
        {actions && <div className="mt-3 flex gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Skeleton block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-background-tertiary-default', className)} />
}

/** Table-shaped loading skeleton. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  )
}
