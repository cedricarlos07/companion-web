import { useAppStore } from '@/store/app-store'
import { HugeIcon } from '@/components/ui/huge-icon'
import { CheckmarkCircle02Icon, AlertCircleIcon, InformationCircleIcon } from '@/lib/icons'
import { cx } from '@/utils/cx'

/** Toast viewport — renders the store's transient feedback messages. */
export function ToastViewport() {
  const { toasts } = useAppStore()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-lg',
            'border-border-button-default bg-background-primary-default',
          )}
          role="status"
        >
          <HugeIcon
            icon={t.tone === 'error' ? AlertCircleIcon : t.tone === 'info' ? InformationCircleIcon : CheckmarkCircle02Icon}
            size="sm"
            className={cx(
              t.tone === 'error' ? 'text-rose-500' : t.tone === 'info' ? 'text-blue-500' : 'text-emerald-500',
            )}
          />
          <span className="text-body-2-medium whitespace-nowrap text-text-primary">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
