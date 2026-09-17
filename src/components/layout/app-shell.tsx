import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AppSidebar } from './app-sidebar'
import { TopBar } from './top-bar'
import { GlobalSearch } from './global-search'
import { ToastViewport } from './toasts'
import { api } from '@/services/api'
import { cx } from '@/utils/cx'

interface LicenseBanner {
  mode: 'active' | 'grace' | 'restricted'
  message: string
  daysLeft: number | null
}

/** Bannière licence — grâce ou restreint. Jamais bloquante pour la lecture. */
function LicenseBannerBar({ banner }: { banner: LicenseBanner }) {
  if (banner.mode === 'active') return null
  const restricted = banner.mode === 'restricted'
  return (
    <div
      role="status"
      className={cx(
        'flex flex-wrap items-center justify-between gap-2 px-6 py-2 text-caption-1-medium',
        restricted ? 'bg-status-rose-background text-status-rose-text' : 'bg-status-yellow-background text-status-yellow-text',
      )}
    >
      <span>
        {restricted ? 'Licence expirée — mode restreint. ' : 'Licence bientôt expirée. '}
        {banner.message}
      </span>
      <Link to="/billing" className="underline underline-offset-2">
        Gérer la licence
      </Link>
    </div>
  )
}

/** Main authenticated application shell: sidebar + top bar + routed content. */
export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [banner, setBanner] = useState<LicenseBanner | null>(null)

  useEffect(() => {
    let alive = true
    api
      .request<LicenseBanner & { valid: boolean }>('/license')
      .then((l) => {
        if (alive && l && (l.mode === 'grace' || l.mode === 'restricted')) setBanner(l)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background-full text-text-primary">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSearch={() => setSearchOpen(true)} />
        {banner && <LicenseBannerBar banner={banner} />}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ToastViewport />
    </div>
  )
}
