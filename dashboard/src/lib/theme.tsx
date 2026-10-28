import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TOKENS, type ThemeName, type Tokens } from './tokens'

interface ThemeCtx { theme: ThemeName; tokens: Tokens; toggle: () => void }
const Ctx = createContext<ThemeCtx | null>(null)

const initial = (): ThemeName => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(initial)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('hl-theme', theme) } catch { /* private mode */ }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, tokens: TOKENS[theme], toggle }), [theme, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('ThemeProvider missing')
  return v
}
