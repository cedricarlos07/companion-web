import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cx } from '@/utils/cx'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { Button } from '@/components/base/buttons/button'
import { IconButton } from '@/components/base/buttons/icon-button'
import { Select, SelectItem } from '@/components/base/select/select'
import {
  Attachment01Icon,
  Mic01Icon,
  SentIcon,
  SparklesIcon,
  TargetIcon,
  BotIcon,
  ShieldCheckIcon,
  Database01Icon,
} from '@/lib/icons'

export const ASK_CONTEXTS = [
  { id: 'company', label: 'Entreprise entière' },
  { id: 'department', label: 'Département' },
  { id: 'role', label: 'Rôle' },
  { id: 'person', label: 'Personne' },
  { id: 'project', label: 'Projet' },
]

export const ASK_MODELS = [
  { id: 'ollama-llama32', label: 'llama3.2 (local)' },
  { id: 'ollama-qwen', label: 'qwen2.5 (local)' },
  { id: 'gpt-4o', label: 'gpt-4o' },
  { id: 'claude-sonnet', label: 'claude-sonnet' },
]

export const ASK_MODES = [
  { id: 'readonly', label: 'Lecture seule' },
  { id: 'suggest', label: 'Suggestion' },
  { id: 'act', label: 'Action autorisée' },
]

/**
 * Companion composer (free-equivalent of BoardUI Composer): text area with
 * attach / context / agent / model / permission-mode controls and send.
 */
export function Composer({
  value,
  onValueChange,
  onSubmit,
  placeholder = 'Posez votre question…',
  busy = false,
  className,
  footerNote,
}: {
  value: string
  onValueChange: (v: string) => void
  onSubmit: () => void
  placeholder?: string
  busy?: boolean
  className?: string
  footerNote?: ReactNode
}) {
  const [context, setContext] = useState('company')
  const [model, setModel] = useState('ollama-llama32')
  const [mode, setMode] = useState('readonly')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  function send() {
    const text = value.trim()
    if (!text || busy) return
    onSubmit()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className={cx(
        'rounded-2xl border border-border-button-default bg-background-primary-default shadow-card transition-shadow focus-within:shadow-md',
        className,
      )}
    >
      <textarea
        ref={areaRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={2}
        aria-label="Votre question"
        className="block w-full resize-none bg-transparent px-4 pt-3.5 text-body-medium text-text-primary outline-none placeholder:text-text-placeholder"
      />
      <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
        <IconButton
          
          size="small"
          icon={adaptIcon(Attachment01Icon, 18)}
          aria-label="Joindre un fichier"
          onClick={() => areaRef.current?.focus()}
        />
        <ComposeSelect
          icon={Database01Icon}
          value={context}
          onChange={setContext}
          items={ASK_CONTEXTS}
          ariaLabel="Contexte de la question"
        />
        <ComposeSelect
          icon={BotIcon}
          value={model}
          onChange={setModel}
          items={ASK_MODELS}
          ariaLabel="Modèle"
        />
        <ComposeSelect
          icon={ShieldCheckIcon}
          value={mode}
          onChange={setMode}
          items={ASK_MODES}
          ariaLabel="Mode de permission"
        />
        <div className="flex-1" />
        <IconButton
          
          size="small"
          icon={adaptIcon(Mic01Icon, 18)}
          aria-label="Dicter (bientôt disponible)"
          onClick={() => areaRef.current?.focus()}
        />
        <Button
          size="small"
          leadingIcon={adaptIcon(SentIcon, 18)}
          onClick={send}
          disabled={!value.trim() || busy}
          aria-label="Envoyer"
        >
          Envoyer
        </Button>
      </div>
      {footerNote && (
        <div className="flex items-center gap-1.5 border-t border-separator-border px-4 py-2 text-caption-1-medium text-text-tertiary">
          <HugeIcon icon={TargetIcon} size="xs" />
          {footerNote}
        </div>
      )}
    </div>
  )
}

function ComposeSelect({
  icon,
  value,
  onChange,
  items,
  ariaLabel,
}: {
  icon: typeof SparklesIcon
  value: string
  onChange: (v: string) => void
  items: { id: string; label: string }[]
  ariaLabel: string
}) {
  const current = items.find((i) => i.id === value)
  return (
    <Select
      size="sm"
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k))}
      className="max-w-44"
      items={items}
      renderValue={
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <HugeIcon icon={icon} size="xs" className="shrink-0 text-foreground-icon-tertiary" />
          <span className="truncate text-caption-1-medium">{current?.label}</span>
        </span>
      }
    >
      {(item) => (
        <SelectItem key={item.id} id={item.id} textValue={item.label}>
          {item.label}
        </SelectItem>
      )}
    </Select>
  )
}
