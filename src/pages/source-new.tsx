import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control'
import { FileDropZone } from '@/components/common/file-drop'
import { Input } from '@/components/base/input/input'
import { Textarea } from '@/components/base/textarea/textarea'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  CheckmarkCircle02Icon,
  Database01Icon,
  File01Icon,
  GoogleDriveIcon,
  Mail01Icon,
  Loading03Icon,
  StickyNoteIcon,
  Video01Icon,
} from '@/lib/icons'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

type Mode = 'upload' | 'connect' | 'paste' | 'transcript' | 'email'

const MODES: { id: Mode; label: string }[] = [
  { id: 'upload', label: 'Importer des fichiers' },
  { id: 'connect', label: 'Connecter une application' },
  { id: 'paste', label: 'Coller du texte' },
  { id: 'transcript', label: 'Transcript de réunion' },
  { id: 'email', label: 'Importer un email' },
]

const PIPELINE = [
  { id: 'upload', label: 'Téléversement' },
  { id: 'reading', label: 'Lecture' },
  { id: 'extracting', label: 'Extraction' },
  { id: 'memories', label: 'Création des mémoires' },
  { id: 'dedupe', label: 'Vérification des doublons' },
  { id: 'done', label: 'Terminé' },
] as const

const RESULTS = [
  { label: 'Pages analysées', value: '24' },
  { label: 'Mémoires candidates', value: '31' },
  { label: 'Nouvelles', value: '18' },
  { label: 'Confirmations', value: '9' },
  { label: 'Conflits', value: '2' },
  { label: 'Ignorées', value: '2' },
]

export function NewSourcePage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [mode, setMode] = useState<Mode>('upload')
  const [phase, setPhase] = useState<'select' | 'processing' | 'done'>('select')
  const [step, setStep] = useState(0)
  const [pasteText, setPasteText] = useState('')
  const [emailFrom, setEmailFrom] = useState('')

  useEffect(() => {
    if (phase !== 'processing') return
    setStep(0)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      if (i >= PIPELINE.length) {
        window.clearInterval(id)
        setPhase('done')
        return
      }
      setStep(i)
    }, 900)
    return () => window.clearInterval(id)
  }, [phase])

  function start() {
    if (mode === 'paste' && pasteText.trim().length < 10) {
      pushToast('Collez un texte plus long à analyser.', 'error')
      return
    }
    if (mode === 'email' && !emailFrom.includes('@')) {
      pushToast('Renseignez un email valide à importer.', 'error')
      return
    }
    setPhase('processing')
  }

  return (
    <div>
      <PageHeader
        title="Ajouter une source"
        subtitle="Chaque source importée est lue, extraite, dédupliquée et sourcée automatiquement."
      />

      <div className="mb-5">
        <SegmentedControl
          aria-label="Type d'import"
          defaultSelectedKeys={['upload']}
          onSelectionChange={(k) => {
            const key = [...k][0]
            if (key) {
              setMode(String(key) as Mode)
              setPhase('select')
            }
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
              <FileDropZone
                hint="Formats acceptés : PDF, Word, notes, tableurs"
                allowedExtensions={['.pdf', '.docx', '.txt', '.md', '.xlsx', '.csv']}
                onComplete={(name) => pushToast(`${name} reçu — prêt à analyser.`)}
              />
              <div className="flex justify-end">
                <Button onClick={start}>Lancer l'analyse</Button>
              </div>
            </div>
          )}

          {mode === 'connect' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Google Drive', icon: GoogleDriveIcon, status: 'Déjà connectée' },
                { name: 'Gmail', icon: Mail01Icon, status: 'Déjà connectée' },
                { name: 'CRM', icon: Database01Icon, status: 'Déjà connectée' },
                { name: 'WhatsApp Business', icon: StickyNoteIcon, status: 'Bientôt disponible' },
              ].map((c) => (
                <button
                  key={c.name}
                  type="button"
                  disabled={c.status !== 'Déjà connectée' ? c.status === 'Bientôt disponible' : false}
                  onClick={() => pushToast(`${c.name} — déjà connectée à votre instance.`, 'info')}
                  className={cx(
                    'flex items-center gap-3 rounded-xl border border-border-button-default p-3.5 text-left transition-colors',
                    'hover:bg-background-primary-hover disabled:cursor-not-allowed disabled:opacity-55',
                  )}
                >
                  <HugeIcon icon={c.icon} size="md" className="shrink-0 text-foreground-icon-secondary" />
                  <span>
                    <span className="block text-body-2-medium text-text-primary">{c.name}</span>
                    <span className="block text-caption-1-medium text-text-tertiary">{c.status}</span>
                  </span>
                </button>
              ))}
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-caption-1-medium text-text-tertiary">
                  Les connecteurs supplémentaires sont gérés depuis Intégrations.
                </p>
              </div>
            </div>
          )}

          {mode === 'paste' && (
            <div className="space-y-4">
              <Textarea
                label="Texte à analyser"
                value={pasteText}
                onChange={setPasteText}
                placeholder="Collez ici une procédure, une note de réunion, un échange client…"
                showCount
                maxLength={8000}
              />
              <div className="flex justify-end">
                <Button onClick={start}>Lancer l'analyse</Button>
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
                hint="Transcript (.txt, .vtt, .docx)"
                allowedExtensions={['.txt', '.vtt', '.docx']}
                onComplete={(name) => pushToast(`${name} reçu — prêt à analyser.`)}
              />
              <div className="flex justify-end">
                <Button onClick={start}>Lancer l'analyse</Button>
              </div>
            </div>
          )}

          {mode === 'email' && (
            <div className="space-y-4">
              <Input
                label="Adresse email à importer"
                value={emailFrom}
                onChange={setEmailFrom}
                placeholder="ex. compte-rendu@client.ci"
                hint="L'email et ses pièces jointes seront analysés puis sourcés."
                type="email"
              />
              <div className="flex justify-end">
                <Button onClick={start}>Lancer l'analyse</Button>
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
              const running = i === step
              return (
                <li key={p.id} className="flex items-center gap-3">
                  {done ? (
                    <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="shrink-0 text-emerald-500" />
                  ) : running ? (
                    <HugeIcon icon={Loading03Icon} size="sm" className="shrink-0 animate-spin text-accent-500" />
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      <span className="size-1.5 rounded-full bg-background-quaternary-default" />
                    </span>
                  )}
                  <span className={cx('text-body-2-regular', running ? 'text-text-primary' : done ? 'text-text-tertiary' : 'text-text-tertiary')}>
                    {p.label}
                    {running && '…'}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-caption-1-medium text-text-tertiary">
            Le Knowledge Agent fonctionne en arrière-plan — vous pouvez naviguer ailleurs.
          </p>
        </Card>
      )}

      {phase === 'done' && (
        <Card title="Analyse terminée">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {RESULTS.map((r) => (
              <div key={r.label} className="rounded-xl border border-border-button-default p-3 text-center">
                <p className="text-title-2-semibold text-text-primary tabular-nums">{r.value}</p>
                <p className="text-caption-1-medium text-text-tertiary">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
              <HugeIcon icon={File01Icon} size="xs" />
              2 conflits détectés — à examiner avant publication.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPhase('select')}>
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
