import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: ReactNode
  children?: ReactNode
}

/** Standard page heading block: optional breadcrumb, title, subtitle, actions. */
export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4">
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title-1-medium text-text-primary">{title}</h1>
          {subtitle && <p className="mt-1 text-body-medium text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
