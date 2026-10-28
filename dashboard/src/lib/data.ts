import { useEffect, useState } from 'react'

export interface Meta {
  company: string
  first_month: string
  last_month: string
  months: string[]
  weeks: string[]
  marketing_weeks: string[]
  dicts: Record<string, string[]>
  products: { id: string; name: string; category: string; subcategory: string; supplier: string }[]
  stores: { id: string; name: string; region: string; status: string; open: string; close: string | null }[]
}

/** Column-oriented table: every column is a Float64Array of the same length. */
export interface Table { n: number; c: Record<string, Float64Array> }

interface Raw { cols: string[]; rows: (number | null)[][] }

const base = import.meta.env.BASE_URL
const cache = new Map<string, Promise<unknown>>()

function getJson<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${base}data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${name}.json (${r.status})`)
      return r.json()
    }))
  }
  return cache.get(name) as Promise<T>
}

export const loadMeta = () => getJson<Meta>('meta')

export async function loadTable(name: string): Promise<Table> {
  const raw = await getJson<Raw>(name)
  const n = raw.rows.length
  const c: Record<string, Float64Array> = {}
  raw.cols.forEach((col, j) => {
    const a = new Float64Array(n)
    for (let i = 0; i < n; i++) a[i] = raw.rows[i][j] ?? NaN
    c[col] = a
  })
  return { n, c }
}

export interface Async<T> { data: T | null; loading: boolean; error: string | null }

export function useTable(name: string): Async<Table> {
  const [state, set] = useState<Async<Table>>({ data: null, loading: true, error: null })
  useEffect(() => {
    let live = true
    loadTable(name).then(
      (data) => live && set({ data, loading: false, error: null }),
      (e) => live && set({ data: null, loading: false, error: String(e) }),
    )
    return () => { live = false }
  }, [name])
  return state
}

export function useTables<K extends string>(names: readonly K[]): { data: Record<K, Table> | null; loading: boolean; error: string | null } {
  const [state, set] = useState<{ data: Record<K, Table> | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  const key = names.join('|')
  useEffect(() => {
    let live = true
    set((s) => (s.data ? s : { data: null, loading: true, error: null }))
    Promise.all(names.map((n) => loadTable(n))).then(
      (ts) => live && set({ data: Object.fromEntries(names.map((n, i) => [n, ts[i]])) as Record<K, Table>, loading: false, error: null }),
      (e) => live && set({ data: null, loading: false, error: String(e) }),
    )
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}
