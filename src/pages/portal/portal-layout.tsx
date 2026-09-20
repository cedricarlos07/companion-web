import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  Home01Icon,
  CheckmarkBadge01Icon,
  DownloadIcon,
  ServerStack01Icon,
  File01Icon,
  Message01Icon,
  LogoutIcon,
} from '@/lib/icons'
import { clearPortalSession, portalLogin, readPortalSession, savePortalSession, type PortalMe, type PortalSession } from '@/services/portal'

const NAV = [
  { to: '/portal', label: 'Accueil', icon: Home01Icon, end: true },
  { to: '/portal/license', label: 'Licence', icon: CheckmarkBadge01Icon, end: false },
  { to: '/portal/downloads', label: 'Téléchargements', icon: DownloadIcon, end: false },
  { to: '/portal/instances', label: 'Instances', icon: ServerStack01Icon, end: false },
  { to: '/portal/invoices', label: 'Factures', icon: File01Icon, end: false },
  { to: '/portal/support', label: 'Support', icon: Message01Icon, end: false },
]

/**
 * Portail Client KamaLoka.
 *
 * Espace post-vente réservé aux clients abonnés : licence, téléchargements,
 * instances, factures, support. L'accès se fait par token portail (fourni par
 * KamaLoka, un par licence) contre l'API du Control Center. Surface
 * volontairement séparée de Companion — aucune donnée métier ne transite ici.
 */
export function PortalLayout() {
  const navigate = useNavigate()
  const [session, setSession] = useState<PortalSession | null>(() => readPortalSession())
  const [me, setMe] = useState<PortalMe | null>(null)
  const [checking, setChecking] = useState(Boolean(session))

  useEffect(() => {
    if (!session) {
      setMe(null)
      setChecking(false)
      return
    }
    setChecking(true)
    portalLogin(session).then((res) => {
      if (res) setMe(res)
      else clearPortalSession()
      setSession(res ? session : null)
      setChecking(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function logout() {
    clearPortalSession()
    setSession(null)
    setMe(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-full">
      <header className="sticky top-0 z-20 border-b border-separator-border bg-background-primary-default">
        <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center gap-3 px-6">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-black text-caption-1-bold text-companion-300">
            K
          </span>
          <span className="text-headline-semibold text-text-primary">KamaLoka</span>
          <Chip variant="subtle" color="lime">Portail client</Chip>
          <div className="flex-1" />
          {me && (
            <span className="hidden text-body-2-medium text-text-secondary sm:inline">
              {me.customer}
            </span>
          )}
          {session && (
            <button
              type="button"
              onClick={logout}
              aria-label="Se déconnecter du portail client"
              className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <HugeIcon icon={LogoutIcon} size="sm" />
            </button>
          )}
        </div>
        {session && (
          <nav
            className="mx-auto flex w-full max-w-[1080px] gap-1 overflow-x-auto px-6"
            aria-label="Navigation du portail client"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-body-2-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                    isActive
                      ? 'border-companion-600 text-text-primary'
                      : 'border-transparent text-text-tertiary hover:text-text-primary',
                  )
                }
              >
                <HugeIcon icon={item.icon} size="xs" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 py-6">
        {checking ? (
          <p className="py-12 text-center text-body-medium text-text-tertiary">Connexion au portail KamaLoka…</p>
        ) : session && me ? (
          <Outlet context={{ me, session }} />
        ) : (
          <PortalLogin onLoggedIn={(s, m) => { savePortalSession(s); setSession(s); setMe(m) }} navigate={navigate} />
        )}
      </main>

      <footer className="border-t border-separator-border px-6 py-3">
        <p className="mx-auto max-w-[1080px] text-caption-1-regular text-text-tertiary">
          Portail client KamaLoka — relation commerciale et technique. Votre instance
          Companion reste auto-hébergée : aucune donnée métier ne transite par ce portail.
        </p>
      </footer>
    </div>
  )
}

function PortalLogin({ onLoggedIn, navigate }: {
  onLoggedIn: (session: PortalSession, me: PortalMe) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    const trimmedUrl = baseUrl.trim().replace(/\/$/, '')
    const trimmedToken = token.trim()
    if (!/^https?:\/\//.test(trimmedUrl) || !trimmedToken.startsWith('cmp_portal_')) {
      setError('Vérifiez l\u2019URL du Control Center (https://…) et votre token portail (cmp_portal_…).')
      return
    }
    setBusy(true)
    const me = await portalLogin({ baseUrl: trimmedUrl, token: trimmedToken })
    setBusy(false)
    if (!me) {
      setError('Connexion refusée par le Control Center — token invalide ou serveur injoignable.')
      return
    }
    onLoggedIn({ baseUrl: trimmedUrl, token: trimmedToken }, me)
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="text-title-1-medium text-text-primary">Portail client KamaLoka</h1>
      <p className="mt-2 text-body-medium text-text-secondary">
        Connectez-vous avec le token portail fourni par KamaLoka pour accéder à votre
        licence, vos instances et vos factures.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => { e.preventDefault(); void submit() }}
        noValidate
      >
        <Input
          label="URL du Control Center KamaLoka"
          value={baseUrl}
          onChange={setBaseUrl}
          placeholder="https://license.kamaloka.ai"
          autoComplete="url"
        />
        <Input
          label="Token portail"
          value={token}
          onChange={setToken}
          placeholder="cmp_portal_…"
          autoComplete="off"
        />
        {error && (
          <p role="alert" className="text-body-2-medium text-text-error-primary">{error}</p>
        )}
        <Button type="submit" className="w-full justify-center" disabled={busy}>
          {busy ? 'Connexion…' : 'Accéder au portail'}
        </Button>
        <Button type="button" variant="ghost" className="w-full justify-center" onClick={() => navigate('/login')}>
          Retour à l'application
        </Button>
      </form>
    </div>
  )
}
