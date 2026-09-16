import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { CloseButton } from '@/components/base/buttons/close-button'

/** Lightweight accessible modal with overlay (Escape closes, initial focus). */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'w-full rounded-2xl border border-border-button-default bg-background-primary-default shadow-xl outline-none',
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-separator-border px-5 py-3.5">
          <h2 className="text-headline-medium text-text-primary">{title}</h2>
          <CloseButton onClick={onClose} aria-label="Fermer" />
        </div>
        <div className="max-h-[70vh] overflow-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-separator-border px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Right-side drawer for detail panels. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 bg-neutral-950/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l border-border-button-default bg-background-primary-default shadow-xl',
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-separator-border px-5 py-3.5">
          <h2 className="text-headline-medium text-text-primary">{title}</h2>
          <CloseButton onClick={onClose} aria-label="Fermer" />
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </aside>
    </div>
  )
}
