import type { Table } from './data'
import type { Range } from './filters'

export interface Sel { region: number | null; channel: number | null; category?: number | null }

export interface Pnl {
  lines: number; units: number; gross_sales: number; discounts: number; net_sales: number
  units_returned: number; refunds: number; cogs: number; cogs_recovered: number; marketing: number
  net_revenue: number; gross_profit: number; gm: number; contribution: number; return_rate: number
}

export const emptyPnl = (): Pnl => ({
  lines: 0, units: 0, gross_sales: 0, discounts: 0, net_sales: 0, units_returned: 0, refunds: 0, cogs: 0,
  cogs_recovered: 0, marketing: 0, net_revenue: 0, gross_profit: 0, gm: 0, contribution: 0, return_rate: 0,
})

export function finalize(p: Pnl): Pnl {
  p.net_revenue = p.net_sales - p.refunds
  p.gross_profit = p.net_revenue - (p.cogs - p.cogs_recovered)
  p.gm = p.net_revenue ? p.gross_profit / p.net_revenue : 0
  p.contribution = p.gross_profit - p.marketing
  p.return_rate = p.units ? p.units_returned / p.units : 0
  return p
}

const ok = (v: number, want: number | null | undefined) => want == null || v === want

/** Aggregate the P&L table into one bucket per month index in [from, to]. */
export function pnlMonthly(t: Table, r: Range, s: Sel): Pnl[] {
  const out = Array.from({ length: r.to - r.from + 1 }, emptyPnl)
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    if (!ok(c.region[i], s.region) || !ok(c.channel[i], s.channel) || !ok(c.category[i], s.category)) continue
    const o = out[m - r.from]
    o.lines += c.lines[i]; o.units += c.units[i]; o.gross_sales += c.gross_sales[i]; o.discounts += c.discounts[i]
    o.net_sales += c.net_sales[i]; o.units_returned += c.units_returned[i]; o.refunds += c.refunds[i]
    o.cogs += c.cogs[i]; o.cogs_recovered += c.cogs_recovered[i]; o.marketing += c.marketing_allocated[i]
  }
  return out.map(finalize)
}

export function sumPnl(rows: Pnl[]): Pnl {
  const t = emptyPnl()
  for (const r of rows) {
    t.lines += r.lines; t.units += r.units; t.gross_sales += r.gross_sales; t.discounts += r.discounts
    t.net_sales += r.net_sales; t.units_returned += r.units_returned; t.refunds += r.refunds
    t.cogs += r.cogs; t.cogs_recovered += r.cogs_recovered; t.marketing += r.marketing
  }
  return finalize(t)
}

export const pnlTotal = (t: Table, r: Range, s: Sel) => sumPnl(pnlMonthly(t, r, s))

/** Group P&L by an index column (region / channel / category) over a range. */
export function pnlGroup(t: Table, r: Range, s: Sel, by: 'region' | 'channel' | 'category', size: number): Pnl[] {
  const out = Array.from({ length: size }, emptyPnl)
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    if (!ok(c.region[i], s.region) || !ok(c.channel[i], s.channel) || !ok(c.category[i], s.category)) continue
    const o = out[c[by][i]]
    o.lines += c.lines[i]; o.units += c.units[i]; o.gross_sales += c.gross_sales[i]; o.discounts += c.discounts[i]
    o.net_sales += c.net_sales[i]; o.units_returned += c.units_returned[i]; o.refunds += c.refunds[i]
    o.cogs += c.cogs[i]; o.cogs_recovered += c.cogs_recovered[i]; o.marketing += c.marketing_allocated[i]
  }
  return out.map(finalize)
}

/** Sum orders (month x region x channel). */
export function ordersMonthly(t: Table, r: Range, s: Sel): number[] {
  const out = new Array(r.to - r.from + 1).fill(0)
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    if (!ok(c.region[i], s.region) || !ok(c.channel[i], s.channel)) continue
    out[m - r.from] += c.orders[i]
  }
  return out
}

/** Relative change; null if the base is zero / missing. */
export const change = (cur: number, prev: number | null | undefined): number | null =>
  prev == null || prev === 0 ? null : (cur - prev) / Math.abs(prev)

export interface ProdAgg { units: number; net_sales: number; cogs: number; units_returned: number; refunds: number }

/** Aggregate product_monthly by product index over a range (filters: region / channel). */
export function productAgg(t: Table, r: Range, s: Sel, nProducts: number): ProdAgg[] {
  const out: ProdAgg[] = Array.from({ length: nProducts }, () => ({ units: 0, net_sales: 0, cogs: 0, units_returned: 0, refunds: 0 }))
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    if (!ok(c.region[i], s.region) || !ok(c.channel[i], s.channel)) continue
    const o = out[c.product_id[i]]
    o.units += c.units[i]; o.net_sales += c.net_sales[i]; o.cogs += c.cogs[i]; o.units_returned += c.units_returned[i]; o.refunds += c.refunds[i]
  }
  return out
}

export interface Var { a: number; b: number; f: number; ac: number; bc: number; fc: number }
export const emptyVar = (): Var => ({ a: 0, b: 0, f: 0, ac: 0, bc: 0, fc: 0 })
export const addVar = (o: Var, p: Var) => { o.a += p.a; o.b += p.b; o.f += p.f; o.ac += p.ac; o.bc += p.bc; o.fc += p.fc; return o }

/** Region x category cube of actual / budget / forecast net sales and COGS. */
export function varCube(t: Table, r: Range, s: Sel): Var[][] {
  const cube = Array.from({ length: 4 }, () => Array.from({ length: 8 }, emptyVar))
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    if (!ok(c.region[i], s.region) || !ok(c.channel[i], s.channel)) continue
    const o = cube[c.region[i]][c.category[i]]
    o.a += c.actual_net_sales[i]; o.b += c.budget_net_sales[i]; o.f += c.forecast_net_sales[i]
    o.ac += c.actual_cogs[i]; o.bc += c.budget_cogs[i]; o.fc += c.forecast_cogs[i]
  }
  return cube
}

export function varMonthly(t: Table, r: Range, s: Sel): Var[] {
  const out = Array.from({ length: r.to - r.from + 1 }, emptyVar)
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    if (!ok(c.region[i], s.region) || !ok(c.channel[i], s.channel)) continue
    const o = out[m - r.from]
    o.a += c.actual_net_sales[i]; o.b += c.budget_net_sales[i]; o.f += c.forecast_net_sales[i]
    o.ac += c.actual_cogs[i]; o.bc += c.budget_cogs[i]; o.fc += c.forecast_cogs[i]
  }
  return out
}

export const sumVar = (rows: Var[]) => rows.reduce((o, v) => addVar(o, v), emptyVar())
