import type { ReactNode } from 'react'
import { useTheme } from '../lib/theme'
import { Delta } from './Delta'
import { Sparkline } from './Sparkline'

export function KpiCard({ label, value, delta, goodWhen = 'up', unit = 'pct', spark, sub, hint }: {
  label: string; value: string; delta?: number | null; goodWhen?: 'up' | 'down' | 'neutral'; unit?: 'pct' | 'pp'
  spark?: number[]; sub?: ReactNode; hint?: string
}) {
  const { tokens } = useTheme()
  return (
    <div className="rounded-xl border border-line bg-surface shadow-[var(--shadow-1)] p-2.5 pb-2 flex flex-col min-w-0 fade-up t-fast hover:border-[color-mix(in_srgb,var(--fg)_22%,var(--line))]">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[12px] text-muted font-medium truncate" title={hint}>{label}</span>
      </div>
      <div className="num text-[28px] leading-[36px] font-medium text-fg tracking-tight mt-0.5 truncate">{value}</div>
      <div className="flex items-center gap-[8px] mt-0.5 min-h-[24px] flex-wrap">
        {delta !== undefined && <Delta value={delta} goodWhen={goodWhen} unit={unit} />}
        <span className="text-[11px] text-muted truncate">{sub ?? (delta !== undefined ? 'vs prior' : '')}</span>
      </div>
      <div className="mt-1.5">{spark ? <Sparkline values={spark} color={tokens.accent} label={`${label} trend`} /> : <div style={{ height: 36 }} />}</div>
    </div>
  )
}
