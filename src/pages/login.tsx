import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { adaptIcon } from '@/components/ui/huge-icon'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { LoginIcon, ShieldUserIcon } from '@/lib/icons'
import { ORG } from '@/data/org'
import { assertMockAllowed } from '@/lib/mock'
import { api } from '@/services/api'

/** Minimal enterprise login — no illustration, just the essentials. */
export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('ange.niamke@kamaloka.ci')
  const [password, setPassword] = useState('companion')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
            <Button type="submit" leadingIcon={adaptIcon(LoginIcon, 20)} className="w-full justify-center" disabled={busy}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              leadingIcon={adaptIcon(ShieldUserIcon, 20)}
              className="w-full justify-center"
              onClick={() => navigate('/home')}
            >
              Continuer avec SSO
            </Button>
          </form>
        </div>
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-separator-border px-4 py-4 text-caption-1-medium text-text-tertiary">
        <span>Instance</span>
        <span className="rounded-md bg-background-secondary-default px-2 py-0.5 text-body-2-medium text-text-secondary">
          {ORG.instance}
        </span>
        <span>· Données auto-hébergées</span>
      </footer>
    </div>
  )
}
