import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Meta } from './data'

export interface Filters {
  from: number            // month index (inclusive)
  to: number              // month index (inclusive)
  region: number | null   // index into dicts.region (0-3) or null = all
  channel: number | null  // index into dicts.channel or null = all
}

export interface Range { from: number; to: number }

interface Ctx {
  meta: Meta
  f: Filters
  prior: Range | null     // equal-length period immediately before, or null if it falls before the data
  yoy: Range | null       // same months one year earlier, or null
  setRange: (from: number, to: number) => void
  setRegion: (r: number | null) => void
  setChannel: (c: number | null) => void
  reset: () => void
  preset: string
  applyPreset: (p: string) => void
}

const FilterCtx = createContext<Ctx | null>(null)
const KEY = 'hl-filters-v3'

export const PRESETS: { id: string; label: string }[] = [
  { id: 'l12', label: '12M' },
  { id: 'l24', label: '24M' },
  { id: 'ytd', label: 'YTD' },
  { id: 'fy', label: 'Prior FY' },
  { id: 'all', label: 'All' },
]

export function presetRange(id: string, meta: Meta): Range {
  const last = meta.months.length - 1
  const lastYear = +meta.months[last].slice(0, 4)
  switch (id) {
    case 'l12': return { from: Math.max(0, last - 11), to: last }
    case 'l24': return { from: Math.max(0, last - 23), to: last }
    case 'ytd': return { from: meta.months.findIndex((m) => m.startsWith(String(lastYear))), to: last }
    case 'fy': {
      const a = meta.months.findIndex((m) => m.startsWith(String(lastYear - 1)))
      return { from: a, to: a + 11 }
    }
    default: return { from: 0, to: last }
  }
}

export function FilterProvider({ meta, children }: { meta: Meta; children: ReactNode }) {
  const defaults = useMemo<Filters>(() => ({ ...presetRange('l24', meta), region: null, channel: null }), [meta])
  const [f, setF] = useState<Filters>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Filters | null
      if (s && s.from >= 0 && s.to < meta.months.length && s.from <= s.to) return s
    } catch { /* ignore */ }
    return defaults
  })
  const [preset, setPreset] = useState('l24')
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(f)) } catch { /* ignore */ } }, [f])

  const setRange = useCallback((from: number, to: number) => { setPreset('custom'); setF((s) => ({ ...s, from, to })) }, [])
  const applyPreset = useCallback((p: string) => { setPreset(p); const r = presetRange(p, meta); setF((s) => ({ ...s, ...r })) }, [meta])
  const setRegion = useCallback((region: number | null) => setF((s) => ({ ...s, region })), [])
  const setChannel = useCallback((channel: number | null) => setF((s) => ({ ...s, channel })), [])
  const reset = useCallback(() => { setPreset('l24'); setF(defaults) }, [defaults])

  const value = useMemo<Ctx>(() => {
    const len = f.to - f.from + 1
    const prior = f.from - len >= 0 ? { from: f.from - len, to: f.from - 1 } : null
    const yoy = f.from - 12 >= 0 ? { from: f.from - 12, to: f.to - 12 } : null
    return { meta, f, prior, yoy, setRange, setRegion, setChannel, reset, preset, applyPreset }
  }, [meta, f, setRange, setRegion, setChannel, reset, preset, applyPreset])

  return <FilterCtx.Provider value={value}>{children}</FilterCtx.Provider>
}

export function useFilters() {
  const v = useContext(FilterCtx)
  if (!v) throw new Error('FilterProvider missing')
  return v
}

export function periodLabel(meta: Meta, r: Range) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const l = (i: number) => `${MONTHS[+meta.months[i].slice(5, 7) - 1]} ${meta.months[i].slice(0, 4)}`
  return r.from === r.to ? l(r.from) : `${l(r.from)} – ${l(r.to)}`
}
