import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { adaptIcon } from '@/components/ui/huge-icon'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { LoginIcon } from '@/lib/icons'
import { MOCK_ALLOWED, assertMockAllowed } from '@/lib/mock'
import { api } from '@/services/api'

/** Minimal enterprise login — no illustration, just the essentials. */
export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(MOCK_ALLOWED ? 'ange.niamke@kamaloka.ci' : '')
  const [password, setPassword] = useState(MOCK_ALLOWED ? 'companion' : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotSent, setForgotSent] = useState<string | null>(null)

  // Instance vierge : proposer discrètement la configuration initiale —
  // jamais de redirection automatique des visiteurs vers l'assistant.
  const [showSetupLink, setShowSetupLink] = useState(false)
  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((d: { needsSetup?: boolean }) => setShowSetupLink(d.needsSetup === true))
      .catch(() => undefined)
  }, [navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.includes('@') || password.length < 4) {
      setError('Vérifiez votre email et votre mot de passe (4 caractères minimum).')
      return
    }
    setBusy(true)
    const res = await api.login(email, password)
    setBusy(false)
    if (res) {
      navigate('/home')
      return
    }
    // Identifiants invalides ou backend indisponible.
    if (assertMockAllowed('login')) {
      setError('')
      navigate('/home')
      return
    }
    setError('Connexion impossible : backend indisponible ou identifiants invalides.')
  }

  async function forgot() {
    if (!email.includes('@')) {
      setError('Renseignez votre email pour recevoir un lien de réinitialisation.')
      return
    }
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; devToken?: string; error?: string } | null
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? 'Demande impossible.')
        return
      }
      setForgotSent(
        body.devToken
          ? `Mode dev — utilisez le token de réinitialisation : ${body.devToken.slice(0, 10)}…`
          : 'Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.',
      )
    } catch {
      setError('Erreur réseau — la demande n\'a pas abouti.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            {/* Wordmark officiel : noir sur clair, vert sur sombre (brand kit v1.0). */}
            <img
              src="/brand/companion-wordmark-on-light.png"
              alt="Companion"
              className="theme-logo-light mx-auto mb-4 h-9 w-auto"
              draggable={false}
            />
            <img
              src="/brand/companion-wordmark-on-dark.png"
              alt=""
              aria-hidden="true"
              className="theme-logo-dark mx-auto mb-4 h-9 w-auto"
              draggable={false}
            />
            <h1 className="text-title-1-medium text-text-primary">Bienvenue dans Companion</h1>
            <p className="mt-1.5 text-body-medium text-text-secondary">
              La mémoire opérationnelle de votre entreprise.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="prenom.nom@entreprise.ci"
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            {error && (
              <p role="alert" className="text-body-2-medium text-text-error-primary">
                {error}
              </p>
            )}
            {forgotSent && (
              <p className="text-body-2-medium text-text-secondary">{forgotSent}</p>
            )}
            <Button type="submit" leadingIcon={adaptIcon(LoginIcon, 20)} className="w-full justify-center" disabled={busy}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </Button>
            <Button type="button" variant="ghost" className="w-full justify-center" onClick={() => void forgot()}>
              Mot de passe oublié ?
            </Button>
            {showSetupLink && (
              <p className="pt-2 text-center">
                <a href="/setup" className="text-caption-1-medium text-text-tertiary underline hover:text-text-secondary">
                  Première installation ? Configurer l'instance
                </a>
              </p>
            )}
          </form>
        </div>
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-separator-border px-4 py-4 text-caption-1-medium text-text-tertiary">
        <span>Companion</span>
        <span>· Données auto-hébergées</span>
      </footer>
    </div>
  )
}
