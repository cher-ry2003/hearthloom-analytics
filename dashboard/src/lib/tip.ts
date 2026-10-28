import { change } from './aggregate'
import { signedPct } from './format'

export interface TipRow { color?: string; name: string; value: string; share?: number | null; delta?: number | null; goodWhen?: 'up' | 'down'; sub?: string }

/** Custom tooltip: value, share of total, change vs prior period. */
export function tipHtml(title: string, rows: TipRow[], note?: string): string {
  const body = rows.map((r) => {
    const meta: string[] = []
    if (r.share != null) meta.push(`<span>Share of total</span><span class="num">${(r.share * 100).toFixed(1)}%</span>`)
    if (r.delta != null) {
      const good = r.goodWhen === 'down' ? r.delta < 0 : r.delta > 0
      const cls = Math.abs(r.delta) < 0.0005 ? '' : good ? 'up' : 'down'
      const arrow = r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '–'
      meta.push(`<span>vs prior period</span><span class="num ${cls}">${arrow} ${signedPct(r.delta)}</span>`)
    }
    if (r.sub) meta.push(`<span>${r.sub}</span><span></span>`)
    return `<div class="r">${r.color ? `<i class="sw" style="background:${r.color}"></i>` : ''}<span class="n">${r.name}</span><span class="v">${r.value}</span></div>` +
      meta.map((m) => `<div class="m">${m}</div>`).join('')
  }).join('')
  return `<div class="hl-tip"><div class="t">${title}</div>${body}${note ? `<div class="m" style="margin-top:6px;padding-left:0">${note}</div>` : ''}</div>`
}

export const delta = change
