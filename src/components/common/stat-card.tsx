import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import type { IconSvgElement } from '@hugeicons/react'

interface StatCardProps {
  label: string
  value: string
  icon: IconSvgElement
  hint?: string
  tone?: 'default' | 'critical'
  onClick?: () => void
}

/** BoardUI-style KPI stat card with a naked Hugeicons glyph. */
export function StatCard({ label, value, icon, hint, tone = 'default', onClick }: StatCardProps) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 text-left shadow-card',
        onClick && 'cursor-pointer transition-colors hover:bg-background-primary-hover',
      )}
    >
      <HugeIcon
        icon={icon}
        size="lg"
        className={cx(
          'shrink-0',
          tone === 'critical' ? 'text-rose-500' : 'text-foreground-icon-tertiary',
        )}
      />
      <div className="min-w-0">
        <div className="text-title-2-semibold text-text-primary tabular-nums">{value}</div>
        <div className="text-body-2-medium leading-snug text-text-secondary">{label}</div>
        {hint && <div className="text-caption-1-medium text-text-tertiary">{hint}</div>}
      </div>
    </Wrapper>
  )
}

/** Card component used across screens — BoardUI card recipe. */
export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-border-button-default bg-background-primary-default shadow-card',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-1">
          {typeof title === 'string' ? (
            <h2 className="text-headline-medium text-text-primary">{title}</h2>
          ) : (
            title
          )}
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}
