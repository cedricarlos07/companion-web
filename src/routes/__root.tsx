import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { AppStoreProvider } from '@/store/app-store'
import { ToastViewport } from '@/components/layout/toasts'
import '@/styles/globals.css'
import '@/styles/companion.css'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <AppStoreProvider>
      <Outlet />
      <ToastViewport />
    </AppStoreProvider>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background-full">
      <p className="text-title-1-medium text-text-primary">404</p>
      <p className="text-body-medium text-text-secondary">Page introuvable</p>
      <Link to="/home" className="text-accent-500 hover:underline">
        Retour à l'accueil
      </Link>
    </div>
  )
}
