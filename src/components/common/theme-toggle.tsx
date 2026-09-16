import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip'
import { IconButton } from '@/components/base/buttons/icon-button'
import { adaptIcon } from '@/components/ui/huge-icon'
import { Moon02Icon, SunIcon } from '@/lib/icons'
import { resolvedTheme, setTheme, useTheme } from '@/lib/theme'

/**
 * Bascule clair / sombre de la plateforme (icône du top-bar et des paramètres).
 * Persiste le choix ; les deux wordmarks et tous les tokens suivent via la
 * classe `.dark` sur <html>.
 */
export function ThemeToggle() {
  useTheme()
  const resolved = resolvedTheme()
  const label = resolved === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'

  return (
    <Tooltip>
      <TooltipTrigger>
        <IconButton
          size="small"
          icon={adaptIcon(resolved === 'dark' ? SunIcon : Moon02Icon, 20)}
          aria-label={label}
          onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
        />
      </TooltipTrigger>
      {label}
    </Tooltip>
  )
}
