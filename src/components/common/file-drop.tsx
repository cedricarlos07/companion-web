import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import { CloudUploadIcon } from '@/lib/icons'
import { Loading03Icon, CheckmarkCircle02Icon } from '@/lib/icons'

/**
 * French drag-and-drop file zone (BoardUI FileUpload mechanics, French copy).
 * Simulates upload progress, then completes — mock ingestion.
 */
export function FileDropZone({
  hint,
  allowedExtensions = ['.pdf', '.docx', '.txt', '.md', '.xlsx', '.csv'],
  onComplete,
  className,
}: {
  hint?: string
  allowedExtensions?: readonly string[]
  onComplete?: (name: string) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState(false)

  function startUpload(name: string) {
    setFileName(name)
    setDone(false)
    setProgress(0)
    let p = 0
    const id = window.setInterval(() => {
      p += Math.random() * 28 + 12
      if (p >= 100) {
        window.clearInterval(id)
        setProgress(100)
        setDone(true)
        onComplete?.(name)
      } else {
        setProgress(p)
      }
    }, 260)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) startUpload(file.name)
  }

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Déposer un fichier"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
          dragging
            ? 'border-accent-500 bg-accent-50/60'
            : 'border-border-button-default bg-background-secondary-default hover:border-border-button-hover',
        )}
      >
        {done ? (
          <HugeIcon icon={CheckmarkCircle02Icon} size="lg" className="text-emerald-500" />
        ) : progress !== null ? (
          <HugeIcon icon={Loading03Icon} size="lg" className="animate-spin text-accent-500" />
        ) : (
          <HugeIcon icon={CloudUploadIcon} size="lg" className="text-foreground-icon-tertiary" />
        )}
        {progress === null ? (
          <>
            <p className="text-body-medium text-text-primary">
              Glissez-déposez un fichier ou <span className="text-accent-700">parcourez</span>
            </p>
            <p className="text-caption-1-medium text-text-tertiary">
              {hint ?? `Formats acceptés : ${allowedExtensions.join(' ')}`}
            </p>
          </>
        ) : done ? (
          <p className="text-body-medium text-text-primary">{fileName} — prêt à analyser</p>
        ) : (
          <p className="text-body-medium text-text-primary">
            Téléversement de {fileName}… {Math.round(progress)} %
          </p>
        )}
        {progress !== null && !done && (
          <div className="h-1 w-56 overflow-hidden rounded-full bg-background-tertiary-default">
            <div className="h-full rounded-full bg-accent-500 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={allowedExtensions.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) startUpload(file.name)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
