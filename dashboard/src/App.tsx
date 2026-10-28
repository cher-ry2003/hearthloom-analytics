import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Skeleton } from './components/Skeleton'
import { loadMeta, type Meta } from './lib/data'
import { FilterProvider } from './lib/filters'
import { ThemeProvider } from './lib/theme'
import Budget from './pages/Budget'
import Inventory from './pages/Inventory'
import Marketing from './pages/Marketing'
import Overview from './pages/Overview'
import Products from './pages/Products'

function Boot() {
  return (
    <div className="p-4 max-w-[1100px] mx-auto flex flex-col gap-2" role="status" aria-label="Loading dashboard">
      <Skeleton className="h-4 w-64" /><Skeleton className="h-2 w-96" />
      <div className="grid grid-cols-5 gap-2 mt-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      <Skeleton className="h-40" />
    </div>
  )
}

function Shell() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { loadMeta().then(setMeta, (e) => setErr(String(e))) }, [])
  if (err) return <div className="p-4 text-bad">Could not load data: {err}</div>
  if (!meta) return <Boot />
  return (
    <FilterProvider meta={meta}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="budget" element={<Budget />} />
            <Route path="marketing" element={<Marketing />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<Inventory />} />
          </Route>
        </Routes>
      </HashRouter>
    </FilterProvider>
  )
}

export default function App() {
  return <ThemeProvider><Shell /></ThemeProvider>
}
