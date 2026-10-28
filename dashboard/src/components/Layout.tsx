import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PRESETS, periodLabel, useFilters } from '../lib/filters'
import { monthLong } from '../lib/format'
import { useTheme } from '../lib/theme'
import { Icon } from './Icon'

const NAV = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/budget', label: 'Budget vs actual', icon: 'budget' },
  { to: '/marketing', label: 'Marketing', icon: 'marketing' },
  { to: '/products', label: 'Products & returns', icon: 'products' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
]

const base = import.meta.env.BASE_URL
const REPO = 'https://github.com/cher-ry2003/hearthloom-analytics'

function Sidebar() {
  return (
    <aside className="sticky top-0 h-screen w-8 lg:w-[216px] flex-none border-r border-line bg-surface flex flex-col py-2 px-1 lg:px-1.5 z-40" aria-label="Primary">
      <div className="flex items-center gap-1 px-0.5 lg:px-1 h-[40px] mb-2 justify-center lg:justify-start">
        <img src={`${base}favicon.svg`} width={28} height={28} alt="" className="rounded-lg flex-none" />
        <div className="hidden lg:block leading-[16px] min-w-0">
          <div className="serif text-[20px] leading-[20px] text-fg">Hearthloom</div>
          <div className="text-[11px] text-muted">Home Co. · Analytics</div>
        </div>
      </div>
      <nav className="flex flex-col gap-[2px]">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} title={n.label}
            className={({ isActive }) => `t-fast group relative flex items-center gap-1.5 rounded-lg h-[36px] px-1 justify-center lg:justify-start text-[13px] font-medium
              ${isActive ? 'bg-accent-soft text-accent' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`}>
            <Icon name={n.icon} size={17} />
            <span className="hidden lg:inline truncate">{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-[2px]">
        <a href={`${base}dbt-docs/index.html`} target="_blank" rel="noreferrer" title="dbt docs & lineage"
          className="t-fast flex items-center gap-1.5 rounded-lg h-[32px] px-1 justify-center lg:justify-start text-[12px] text-muted hover:bg-surface-2 hover:text-fg">
          <Icon name="book" size={15} /><span className="hidden lg:inline">dbt docs & lineage</span>
        </a>
        <a href={REPO} target="_blank" rel="noreferrer" title="Source on GitHub"
          className="t-fast flex items-center gap-1.5 rounded-lg h-[32px] px-1 justify-center lg:justify-start text-[12px] text-muted hover:bg-surface-2 hover:text-fg">
          <Icon name="github" size={15} /><span className="hidden lg:inline">Source on GitHub</span>
        </a>
        <p className="hidden lg:block text-[11px] leading-[16px] text-muted px-1 mt-1 mb-0">Synthetic data. Hearthloom is a fictional company.</p>
      </div>
    </aside>
  )
}

function Select({ label, value, onChange, options, disabled, title }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; title?: string
}) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'opacity-50' : ''}`} title={title}>
      <span className="sr-only">{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="t-fast appearance-none h-[32px] rounded-lg border border-line bg-surface pl-1.5 pr-3.5 text-[13px] font-medium text-fg hover:border-[color-mix(in_srgb,var(--fg)_28%,var(--line))] disabled:cursor-not-allowed">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevron" size={14} className="pointer-events-none absolute right-1 text-muted" />
    </label>
  )
}

function DateRange() {
  const { meta, f, setRange, preset, applyPreset } = useFilters()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key) }
  }, [open])
  const opts = meta.months.map((m, i) => ({ value: String(i), label: monthLong(m) }))
  return (
    <div className="flex items-center gap-1 flex-wrap" ref={ref}>
      <div role="radiogroup" aria-label="Date range preset" className="inline-flex rounded-lg bg-surface-2 p-[2px] gap-[2px]">
        {PRESETS.map((p) => (
          <button key={p.id} role="radio" aria-checked={preset === p.id} onClick={() => applyPreset(p.id)}
            className={`t-fast rounded-md px-1.5 h-[28px] text-[13px] font-medium ${preset === p.id ? 'bg-surface text-fg shadow-[var(--shadow-1)]' : 'text-muted hover:text-fg'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog"
          className="t-fast inline-flex items-center gap-1 h-[32px] rounded-lg border border-line bg-surface px-1.5 text-[13px] font-medium hover:border-[color-mix(in_srgb,var(--fg)_28%,var(--line))]">
          <Icon name="calendar" size={14} className="text-muted" />
          <span className="num">{periodLabel(meta, f)}</span>
        </button>
        {open && (
          <div role="dialog" aria-label="Custom date range" className="absolute left-0 top-[40px] z-50 w-[272px] rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)] fade-up">
            <div className="grid grid-cols-2 gap-1.5">
              <label className="text-[12px] text-muted flex flex-col gap-[4px]">From
                <select value={f.from} onChange={(e) => { const v = +e.target.value; setRange(v, Math.max(v, f.to)) }}
                  className="h-[32px] rounded-lg border border-line bg-surface px-1 text-[13px] text-fg">
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="text-[12px] text-muted flex flex-col gap-[4px]">To
                <select value={f.to} onChange={(e) => { const v = +e.target.value; setRange(Math.min(v, f.from), v) }}
                  className="h-[32px] rounded-lg border border-line bg-surface px-1 text-[13px] text-fg">
                  {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <p className="text-[11px] text-muted leading-[16px] mt-1.5 mb-0">Comparisons use the equal-length period immediately before the selection.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Topbar() {
  const { meta, f, setRegion, setChannel, reset } = useFilters()
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const marketing = pathname === '/marketing'
  const inventory = pathname === '/inventory'
  const regions = meta.dicts.region.slice(0, 4)
  const channels = meta.dicts.channel
  const dirty = f.region != null || f.channel != null
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur-md no-print">
      <div className="mx-auto max-w-[1344px] px-2 lg:px-3 py-1 flex flex-wrap items-center gap-1.5 min-h-[56px]">
        <DateRange />
        <div className="h-3 w-px bg-line hidden md:block" />
        <Select label="Region" value={f.region == null ? 'all' : String(f.region)} disabled={marketing}
          title={marketing ? 'Marketing spend is national: the region filter does not apply here.' : undefined}
          onChange={(v) => setRegion(v === 'all' ? null : +v)}
          options={[{ value: 'all', label: 'All regions' }, ...regions.map((r, i) => ({ value: String(i), label: r }))]} />
        <Select label="Sales channel" value={f.channel == null ? 'all' : String(f.channel)} disabled={marketing}
          title={marketing ? 'Marketing spend is national: the channel filter does not apply here.' : undefined}
          onChange={(v) => setChannel(v === 'all' ? null : +v)}
          options={[{ value: 'all', label: 'All channels' }, ...channels.map((c, i) => ({ value: String(i), label: c }))]} />
        {dirty && !marketing && (
          <button onClick={reset} className="t-fast inline-flex items-center gap-[4px] h-[32px] rounded-lg px-1 text-[12px] text-muted hover:text-fg hover:bg-surface-2">
            <Icon name="reset" size={13} />Reset
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden md:inline text-[12px] text-muted num">Data through {monthLong(meta.last_month)}</span>
          <button onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme"
            className="t-fast h-[32px] w-[32px] grid place-items-center rounded-lg border border-line bg-surface text-fg-2 hover:text-fg hover:border-[color-mix(in_srgb,var(--fg)_28%,var(--line))]">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}

export function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-1 focus:left-1 focus:z-50 focus:bg-surface focus:px-2 focus:py-1 focus:rounded-lg">Skip to content</a>
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar />
        <main id="main" className="mx-auto max-w-[1344px] px-2 lg:px-3 pt-3 pb-8">
          <Outlet />
          <footer className="mt-5 pt-2 border-t border-line-soft text-[12px] text-muted flex flex-wrap gap-x-3 gap-y-0.5">
            <span>Hearthloom Home Co. is a fictional retailer; all data is synthetic and generated with a fixed seed.</span>
            <a className="underline underline-offset-2 hover:text-fg" href={`${base}dbt-docs/index.html`} target="_blank" rel="noreferrer">dbt docs</a>
          </footer>
        </main>
      </div>
    </div>
  )
}
