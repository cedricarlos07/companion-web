import { useEffect, useState } from 'react'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import { CheckmarkCircle02Icon, Loading03Icon, SparklesIcon, Alert02Icon } from '@/lib/icons'
import { AgentThinking } from '@/components/application/agent-thinking/agent-thinking'

export interface ThinkingStep {
  id: string
  label: string
}

/**
 * Companion agent-thinking panel: a running shimmer label plus a step list
 * that progressively completes (mock agent execution). Steps advance on an
 * interval; the last step keeps "running" until `hold` is reached.
 */
export function AgentThinkingPanel({
  steps,
  intervalMs = 1400,
  onComplete,
  holdOnLast = false,
  className,
}: {
  steps: ThinkingStep[]
  intervalMs?: number
  onComplete?: () => void
  holdOnLast?: boolean
  className?: string
}) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    setCurrent(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      if (i >= steps.length) {
        window.clearInterval(id)
        if (!holdOnLast) onComplete?.()
        else setCurrent(steps.length - 1)
        return
      }
      setCurrent(i)
    }, intervalMs)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.map((s) => s.id).join('|'), intervalMs, holdOnLast])

  return (
    <div className={cx('rounded-2xl border border-border-button-default bg-background-primary-default p-4', className)}>
      <div className="mb-3 flex items-center gap-2">
        <HugeIcon icon={SparklesIcon} size="sm" className="text-accent-500" />
        <AgentThinking />
      </div>
      <ol className="space-y-2" aria-live="polite">
        {steps.map((step, i) => {
          const done = i < current
          const running = i === current
          return (
            <li key={step.id} className="flex items-center gap-2.5">
              {done ? (
                <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="shrink-0 text-emerald-500" />
              ) : running ? (
                <HugeIcon icon={Loading03Icon} size="sm" className="shrink-0 animate-spin text-accent-500" />
              ) : (
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <span className="size-1.5 rounded-full bg-background-quaternary-default" />
                </span>
              )}
              <span
                className={cx(
                  'text-body-2-regular',
                  done ? 'text-text-tertiary' : running ? 'text-text-primary' : 'text-text-tertiary',
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Inline warning step (for detected problems inside an analysis). */
export function ThinkingWarning({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border-button-default bg-background-secondary-default p-3">
      <HugeIcon icon={Alert02Icon} size="sm" className="shrink-0 text-amber-500" />
      <span className="text-body-2-regular text-text-secondary">{label}</span>
    </div>
  )
}
