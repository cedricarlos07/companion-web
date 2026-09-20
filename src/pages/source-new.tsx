import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control'
import { FileDropZone } from '@/components/common/file-drop'
import { Input } from '@/components/base/input/input'
import { Textarea } from '@/components/base/textarea/textarea'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  CheckmarkCircle02Icon,
  Loading03Icon,
  Video01Icon,
  ArrowLeft01Icon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

type Mode = 'upload' | 'paste' | 'transcript' | 'connect'

const MODES: { id: Mode; label: string }[] = [
  { id: 'upload', label: 'Importer des fichiers' },
  { id: 'paste', label: 'Coller du texte' },
  { id: 'transcript', label: 'Transcript de réunion' },
  { id: 'connect', label: 'Connecter une application' },
]

/** Étapes réelles du pipeline serveur (ingestion → extraction → mémoires). */
const PIPELINE = [
  { id: 'upload', label: 'Téléversement' },
  { id: 'reading', label: 'Lecture des documents' },
  { id: 'extracting', label: 'Extraction' },
  { id: 'memories', label: 'Création des mémoires' },
  { id: 'dedupe', label: 'Déduplication et contradictions' },
] as const

/** Formats acceptés par le serveur (routes.ts ALLOWED_EXTENSIONS). */
const SERVER_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.csv']

interface UploadResult {
  documentId: string
  pagesApprox: number
  chunksIndexed: number
  memoriesCreated: number
  confirmations: number
  conflicts: number
  engine: string
}

export function NewSourcePage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [mode, setMode] = useState<Mode>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [pasteText, setPasteText] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [phase, setPhase] = useState<'select' | 'processing' | 'done'>('select')
  const [step, setStep] = useState(1)
  const [results, setResults] = useState<UploadResult[]>([])
  const [docTitles, setDocTitles] = useState<{ id: string; title: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  function switchMode(m: string) {
    setMode(m as Mode)
    setPhase('select')
    setError(null)
  }

  async function start() {
    setError(null)
    if (mode === 'paste' && pasteText.trim().length < 10) {
      pushToast('Collez un texte plus long à analyser.', 'error')
      return
    }
    if ((mode === 'upload' || mode === 'transcript') && files.length === 0) {
      pushToast('Sélectionnez au moins un fichier.', 'error')
      return
    }
    setPhase('processing')
    setStep(1)
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, PIPELINE.length - 1)), 1600)

    const res =
      mode === 'paste'
        ? await api.uploadFiles([], {
            text: pasteText.trim(),
            title: pasteTitle.trim() || undefined,
            sourceName: sourceName.trim() || 'Import manuel',
          })
        : await api.uploadFiles(files, { sourceName: sourceName.trim() || 'Import manuel' })

    window.clearInterval(timer)
    if (res === null) {
      setPhase('select')
      setError("L'analyse a échoué — vérifiez les formats (.pdf, .docx, .txt, .md, .csv) et réessayez.")
      return
    }
    setResults(res.results)
    setDocTitles(res.documents)
    setPhase('done')
    const totalMemories = res.results.reduce((s, r) => s + r.memoriesCreated, 0)
    pushToast(`Analyse terminée — ${totalMemories} mémoires candidates créées.`, 'success')
  }

  const totals = results.reduce(
    (acc, r) => ({
      pages: acc.pages + r.pagesApprox,
      chunks: acc.chunks + r.chunksIndexed,
      memories: acc.memories + r.memoriesCreated,
      confirmations: acc.confirmations + r.confirmations,
      conflicts: acc.conflicts + r.conflicts,
    }),
    { pages: 0, chunks: 0, memories: 0, confirmations: 0, conflicts: 0 },
  )

  function reset() {
    setPhase('select')
    setFiles([])
    setPasteText('')
    setPasteTitle('')
    setResults([])
    setStep(1)
  }

  return (
    <div>
      <PageHeader
        title="Ajouter une source"
        subtitle="Chaque source importée est lue, extraite, dédupliquée et sourcée automatiquement."
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="mb-5">
        <SegmentedControl
          aria-label="Type d'import"
          defaultSelectedKeys={['upload']}
          onSelectionChange={(k) => {
            const key = [...k][0]
            if (key) switchMode(String(key))
          }}
        >
          {MODES.map((m) => (
            <SegmentedControlItem key={m.id} id={m.id}>
              {m.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      {phase === 'select' && (
        <Card>
          {mode === 'upload' && (
            <div className="space-y-4">
              <Input
                label="Nom de la source (optionnel)"
                value={sourceName}
                onChange={setSourceName}
                placeholder="ex. Procédures SAV 2026"
              />
              <FileDropZone
                hint="Formats acceptés : PDF, Word, texte, Markdown, CSV"
                allowedExtensions={SERVER_EXTENSIONS}
                multiple
                onFiles={setFiles}
              />
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f) => (
                    <li key={f.name + f.size} className="flex items-center gap-2 text-caption-1-medium text-text-secondary">
                      <HugeIcon icon={CheckmarkCircle02Icon} size="xs" className="text-status-lime-text" />
                      {f.name} · {(f.size / 1024).toFixed(0)} Ko
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end">
                <Button onClick={() => void start()} disabled={files.length === 0}>
                  Lancer l'analyse
                </Button>
              </div>
            </div>
          )}

          {mode === 'connect' && (
            <div className="space-y-3">
              <p className="text-body-2-regular text-text-secondary">
                Les connecteurs applicatifs (Drive, Gmail, CRM…) sont gérés depuis la page
                Intégrations, avec leurs scopes et leur journal de synchronisation.
              </p>
              <Button onClick={() => navigate('/integrations')}>Ouvrir Intégrations</Button>
            </div>
          )}

          {mode === 'paste' && (
            <div className="space-y-4">
              <Input
                label="Titre du document"
                value={pasteTitle}
                onChange={setPasteTitle}
                placeholder="ex. Note de réunion — revue processus SAV"
              />
              <Textarea
                label="Texte à analyser"
                value={pasteText}
                onChange={setPasteText}
                placeholder="Collez ici une procédure, une note de réunion, un échange client…"
                showCount
                maxLength={8000}
              />
              <div className="flex justify-end">
                <Button onClick={() => void start()} disabled={pasteText.trim().length < 10}>
                  Lancer l'analyse
                </Button>
              </div>
            </div>
          )}

          {mode === 'transcript' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-border-button-default p-4">
                <HugeIcon icon={Video01Icon} size="md" className="shrink-0 text-foreground-icon-secondary" />
                <p className="text-body-2-regular text-text-secondary">
                  Déposez un transcript (Teams, Zoom, Meet). Companion identifiera les décisions, procédures et
                  leçons évoquées.
                </p>
              </div>
              <FileDropZone
                hint="Transcript (.txt, .md, .csv exporté)"
                allowedExtensions={['.txt', '.md', '.csv', '.docx']}
                onFiles={setFiles}
              />
              <div className="flex justify-end">
                <Button onClick={() => void start()} disabled={files.length === 0}>
                  Lancer l'analyse
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {phase === 'processing' && (
        <Card title="Analyse en cours">
          <ol className="space-y-3">
            {PIPELINE.map((p, i) => {
              const done = i < step
              const current = i === step
              return (
                <li key={p.id} className="flex items-center gap-3">
                  {done ? (
                    <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="shrink-0 text-emerald-500" />
                  ) : (
                    <HugeIcon
                      icon={Loading03Icon}
                      size="sm"
                      className={cx('shrink-0', current ? 'animate-spin text-accent-500' : 'text-foreground-icon-quaternary')}
                    />
                  )}
                  <span className={cx('text-body-2-regular', i <= step ? 'text-text-primary' : 'text-text-tertiary')}>
                    {p.label}
                    {current && '…'}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-caption-1-medium text-text-tertiary">
            Le pipeline tourne côté serveur — l'extraction LLM peut prendre quelques minutes selon le
            volume.
          </p>
        </Card>
      )}

      {phase === 'done' && (
        <Card title="Analyse terminée">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Pages analysées', value: totals.pages },
              { label: 'Chunks indexés', value: totals.chunks },
              { label: 'Mémoires candidates', value: totals.memories },
              { label: 'Confirmations', value: totals.confirmations },
              { label: 'Conflits', value: totals.conflicts },
            ].map((r) => (
              <div key={r.label} className="rounded-xl border border-border-button-default p-3 text-center">
                <p className="text-title-2-semibold text-text-primary tabular-nums">{r.value}</p>
                <p className="text-caption-1-medium text-text-tertiary">{r.label}</p>
              </div>
            ))}
          </div>
          {results.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {results.map((r) => {
                const title = docTitles.find((d) => d.id === r.documentId)?.title ?? r.documentId.slice(0, 8)
                return (
                  <li key={r.documentId} className="flex flex-wrap items-center gap-2 text-caption-1-medium text-text-secondary">
                    <HugeIcon icon={CheckmarkCircle02Icon} size="xs" className="text-status-lime-text" />
                    {title} · {r.memoriesCreated} mémoires · {r.confirmations} confirmations · {r.conflicts} conflits
                    {r.conflicts > 0 && <span className="text-text-error-primary">— à examiner avant publication</span>}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-caption-1-medium text-text-tertiary">Moteur : {results[0]?.engine ?? '—'}</p>
            <div className="flex gap-2">
              <Button variant="ghost" leadingIcon={adaptIcon(ArrowLeft01Icon, 18)} onClick={reset}>
                Nouvelle importation
              </Button>
              <Button onClick={() => navigate('/brain')}>Examiner les connaissances</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
