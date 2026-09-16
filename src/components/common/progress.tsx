import { cx } from '@/utils/cx'

/** Labeled progress row (label left, percent right, subtle track). */
export function ProgressRow({
  label,
  value,
  tone = 'default',
  compact = false,
}: {
  label: string
  value: number
  tone?: 'default' | 'critical' | 'warning' | 'success'
  compact?: boolean
}) {
  const barColor =
    tone === 'critical'
      ? 'bg-rose-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : tone === 'success'
          ? 'bg-emerald-500'
          : 'bg-accent-500'
  return (
    <div className="flex items-center gap-3">
      <span
        className={cx(
          'min-w-0 truncate text-text-secondary',
          compact ? 'text-caption-1-medium' : 'text-body-2-medium',
        )}
        title={label}
      >
        {label}
      </span>
      <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
        <div
          className={cx('h-full rounded-full transition-[width] duration-500', barColor)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span
        className={cx(
          'w-10 shrink-0 text-right tabular-nums text-text-primary',
          compact ? 'text-caption-1-semibold' : 'text-body-2-semibold',
        )}
      >
        {value} %
      </span>
    </div>
  )
}

/** Large score display with circular progress ring (readiness / health). */
export function ScoreRing({
  value,
  size = 132,
  label,
  tone = 'default',
}: {
  value: number
  size?: number
  label?: string
  tone?: 'default' | 'critical' | 'warning' | 'success'
}) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color =
    tone === 'critical'
      ? '#f43f5e'
      : tone === 'warning'
        ? '#f59e0b'
        : tone === 'success'
          ? '#10b981'
          : 'var(--color-accent-500)'
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-background-tertiary-default)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, value)) / 100}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-title-1-semibold text-text-primary tabular-nums">{value} %</span>
        {label && <span className="text-caption-1-medium text-text-tertiary">{label}</span>}
      </div>
    </div>
  )
}
