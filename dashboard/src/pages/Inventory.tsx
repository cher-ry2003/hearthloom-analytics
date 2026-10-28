import { useMemo, useState } from 'react'
import { Card, Note, PageHeader, Segmented } from '../components/Card'
import { Chart } from '../components/Chart'
import { KpiCard } from '../components/KpiCard'
import { KpiSkeleton } from '../components/Skeleton'
import { change } from '../lib/aggregate'
import { catAxis, grid, MONO, mix, tooltip, valAxis } from '../lib/chartKit'
import { useTables, type Table } from '../lib/data'
import { periodLabel, useFilters, type Range } from '../lib/filters'
import { monthLong, monthShort, pct, times, usd } from '../lib/format'
import { useTheme } from '../lib/theme'
import { tipHtml } from '../lib/tip'

const BUCKETS = ['0–30 days', '31–60 days', '61–90 days', '91–180 days', '180+ days']
const BKEY = ['aged_0_30', 'aged_31_60', 'aged_61_90', 'aged_91_180', 'aged_180_plus'] as const
const NC = 8

interface Inv { cogs: number; avg: number; end: number; aged: number[]; demand: number; stock: number }
const empty = (): Inv => ({ cogs: 0, avg: 0, end: 0, aged: [0, 0, 0, 0, 0], demand: 0, stock: 0 })

const okSel = (c: Record<string, Float64Array>, i: number, region: number | null, channel: number | null) =>
  (region == null || c.region[i] === region) && (channel == null || c.channel[i] === channel)

function agg(t: Table, r: Range, region: number | null, channel: number | null, endMonth: number) {
  const byCat = Array.from({ length: NC }, empty)
  const byMonth = Array.from({ length: r.to - r.from + 1 }, empty)
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to || !okSel(c, i, region, channel)) continue
    for (const o of [byCat[c.category[i]], byMonth[m - r.from]]) {
      o.cogs += c.cogs[i]; o.avg += c.avg_inv_value[i]; o.demand += c.demand_cells[i]; o.stock += c.stockout_cells[i]
    }
    // month-end inventory and ageing: every month for the time series, only the end month for category snapshots
    const bm = byMonth[m - r.from]
    bm.end += c.ending_inv_value[i]; BKEY.forEach((k, b) => { bm.aged[b] += c[k][i] })
    if (m === endMonth) { const bc = byCat[c.category[i]]; bc.end += c.ending_inv_value[i]; BKEY.forEach((k, b) => { bc.aged[b] += c[k][i] }) }
  }
  return { byCat, byMonth }
}

const turns = (cogs: number, avg: number, months: number) => (avg ? (cogs * (12 / months)) / avg : 0)

export default function Inventory() {
  const { meta, f, prior } = useFilters()
  const { tokens: t } = useTheme()
  const d = useTables(['inventory', 'stockouts'] as const)
  const [ageView, setAgeView] = useState<'category' | 'time'>('category')
  const cats = meta.dicts.category
  const len = f.to - f.from + 1

  const m = useMemo(() => {
    if (!d.data) return null
    const cur = agg(d.data.inventory, f, f.region, f.channel, f.to)
    const pri = prior ? agg(d.data.inventory, prior, f.region, f.channel, prior.to) : null
    const sum = (rows: Inv[]) => rows.reduce((o, r) => { o.cogs += r.cogs; o.avg += r.avg; o.end += r.end; o.demand += r.demand; o.stock += r.stock; r.aged.forEach((v, b) => { o.aged[b] += v }); return o }, empty())
    const tot = sum(cur.byCat)
    const priTot = pri ? sum(pri.byCat) : null
    const avgMonthly = (rows: Inv[], months: number) => rows.reduce((a, r) => a + r.avg, 0) / months
    const T = turns(tot.cogs, avgMonthly(cur.byMonth, len), len)
    const PT = pri && priTot ? turns(priTot.cogs, avgMonthly(pri.byMonth, len), len) : null
    const catTurns = cur.byCat.map((c) => turns(c.cogs, c.avg / len, len))
    const catTurnsPri = pri ? pri.byCat.map((c) => turns(c.cogs, c.avg / len, len)) : null
    return { cur, pri, tot, priTot, T, PT, catTurns, catTurnsPri }
  }, [d.data, f, prior, len])
  const loading = !d.data || !m
  const empty_ = !!m && m.tot.demand === 0 && m.tot.end === 0
  const labels = useMemo(() => meta.months.slice(f.from, f.to + 1).map(monthShort), [meta, f.from, f.to])

  // ---- turns by category ----
  const turnsOpt = useMemo(() => {
    if (!m) return {}
    const order = [...Array(NC).keys()].filter((i) => m.cur.byCat[i].avg > 0).sort((a, b) => m.catTurns[a] - m.catTurns[b])
    return {
      grid: grid({ left: 4, right: 52, top: 6, bottom: 4 }),
      tooltip: tooltip((p: any) => {
        const i = order[p.dataIndex]
        const c = m.cur.byCat[i]
        return tipHtml(cats[i], [{ color: t.cats[i], name: 'Annualised turns', value: times(m.catTurns[i], 2), delta: m.catTurnsPri ? change(m.catTurns[i], m.catTurnsPri[i]) : null },
          { name: 'Weeks of supply', value: (52 / (m.catTurns[i] || 1)).toFixed(1) }, { name: 'Avg inventory', value: usd(c.avg / len, 2), share: m.tot.avg ? c.avg / m.tot.avg : null }])
      }, 'item', t),
      xAxis: { type: 'value', show: false, max: (v: any) => v.max * 1.05 },
      yAxis: { type: 'category', data: order.map((i) => cats[i]), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, width: 124, overflow: 'truncate', margin: 10 } },
      series: [{
        type: 'bar', barWidth: 15, data: order.map((i) => ({ value: +m.catTurns[i].toFixed(2), itemStyle: { color: t.cats[i], borderRadius: [0, 5, 5, 0] } })),
        showBackground: true, backgroundStyle: { color: t.lineSoft, borderRadius: [0, 5, 5, 0] },
        label: { show: true, position: 'right', fontFamily: MONO, fontSize: 11, color: t.fg, formatter: (p: any) => times(p.value) },
        markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: t.muted, type: [4, 4], width: 1 },
          label: { show: false }, data: [{ xAxis: +m.T.toFixed(2) }] },
      }],
    }
  }, [m, cats, t, len])

  // ---- ageing ----
  const ramp = [0.62, 0.46, 0.3, 0.15, 0].map((k) => mix(t.accent, t.surface, k))
  const ageOpt = useMemo(() => {
    if (!m) return {}
    const stack = (names: string[], rows: Inv[], axisIsCat: boolean) => ({
      series: BUCKETS.map((b, bi) => ({
        name: b, type: 'bar', stack: 'age', barMaxWidth: axisIsCat ? 18 : 26, emphasis: { focus: 'series' },
        data: rows.map((r) => (axisIsCat ? (r.end ? r.aged[bi] / r.end : 0) : Math.round(r.aged[bi]))),
        itemStyle: { color: ramp[bi], borderColor: t.surface, borderWidth: 1, borderRadius: bi === 4 ? (axisIsCat ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0 },
      })),
      names,
    })
    if (ageView === 'category') {
      const idx = [...Array(NC).keys()].filter((i) => m.cur.byCat[i].end > 0)
      const sorted = idx.sort((a, b) => (m.cur.byCat[a].aged[3] + m.cur.byCat[a].aged[4]) / (m.cur.byCat[a].end || 1) - (m.cur.byCat[b].aged[3] + m.cur.byCat[b].aged[4]) / (m.cur.byCat[b].end || 1))
      const s = stack(sorted.map((i) => cats[i]), sorted.map((i) => m.cur.byCat[i]), true)
      return {
        grid: grid({ left: 4, right: 56, top: 6, bottom: 4 }),
        tooltip: tooltip((ps: any[]) => {
          const i = sorted[ps[0].dataIndex]; const c = m.cur.byCat[i]
          return tipHtml(`${cats[i]} · ${monthLong(meta.months[f.to])}`, BUCKETS.map((b, bi) => ({ color: ramp[bi], name: b, value: usd(c.aged[bi], 2), share: c.end ? c.aged[bi] / c.end : null })).reverse(), `Inventory at cost ${usd(c.end, 2)}`)
        }, 'axis', t),
        xAxis: { type: 'value', max: 1.16, axisLabel: { show: false }, splitLine: { show: false } },
        yAxis: { type: 'category', data: s.names, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, width: 124, overflow: 'truncate', margin: 10 } },
        series: [...s.series.map((x) => x), {
          name: 'total', type: 'bar', stack: 'age', data: sorted.map(() => 0), itemStyle: { color: 'transparent' }, silent: true, tooltip: { show: false },
          label: { show: true, position: 'right', fontFamily: MONO, fontSize: 10.5, color: t.fg2, formatter: (p: any) => usd(m.cur.byCat[sorted[p.dataIndex]].end) },
        }],
      }
    }
    const s = stack(labels, m.cur.byMonth, false)
    const endv = (r: Inv) => r.aged.reduce((a, b) => a + b, 0)
    return {
      grid: grid({ top: 12, right: 8 }),
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex; const c = m.cur.byMonth[i]
        return tipHtml(monthLong(meta.months[f.from + i]), BUCKETS.map((b, bi) => ({ color: ramp[bi], name: b, value: usd(c.aged[bi], 2), share: endv(c) ? c.aged[bi] / endv(c) : null })).reverse(), `Month-end inventory at cost ${usd(endv(c), 2)}`)
      }, 'axis', t),
      xAxis: catAxis(labels, t), yAxis: valAxis(t, (v) => usd(v, 0)), series: s.series,
    }
  }, [m, ageView, cats, labels, t, meta, f.to, f.from])

  // ---- stock-out heatmap ----
  const heat = useMemo(() => {
    if (!d.data) return null
    const s = d.data.stockouts.c
    const monthKey = new Map(meta.months.map((mm, i) => [mm.slice(0, 7), i]))
    const wkIdx: number[] = []
    meta.weeks.forEach((w, i) => { const mi = monthKey.get(w.slice(0, 7)); if (mi != null && mi >= f.from && mi <= f.to) wkIdx.push(i) })
    const pos = new Map(wkIdx.map((w, i) => [w, i]))
    const dem = Array.from({ length: NC }, () => new Float64Array(wkIdx.length))
    const stk = Array.from({ length: NC }, () => new Float64Array(wkIdx.length))
    for (let i = 0; i < d.data.stockouts.n; i++) {
      const p = pos.get(s.week_start[i]); if (p == null || !okSel(s, i, f.region, f.channel)) continue
      dem[s.category[i]][p] += s.demand_cells[i]; stk[s.category[i]][p] += s.stockout_cells[i]
    }
    const cells: [number, number, number][] = []
    let max = 0
    for (let c = 0; c < NC; c++) for (let w = 0; w < wkIdx.length; w++) if (dem[c][w] > 0) { const v = stk[c][w] / dem[c][w]; cells.push([w, c, +v.toFixed(4)]); if (v > max) max = v }
    return { wkIdx, cells, max: Math.max(0.05, Math.min(0.5, max)), dem, stk }
  }, [d.data, meta, f])

  const heatOpt = useMemo(() => {
    if (!heat) return {}
    const wlabel = (w: number) => meta.weeks[heat.wkIdx[w]]
    return {
      grid: grid({ left: 4, right: 12, top: 4, bottom: 44 }),
      tooltip: tooltip((p: any) => {
        const [w, c, v] = p.value
        return tipHtml(`${cats[c]} · week of ${monthLong(wlabel(w)).replace(' ', ' ')}`.replace(/(\w{3}) (\d{4})$/, wlabel(w).slice(8, 10) + ' $1 $2'),
          [{ name: 'Stock-out rate', value: pct(v, 1) }, { name: 'Store-SKUs short', value: `${Math.round(heat.stk[c][w])} of ${Math.round(heat.dem[c][w])}` }], 'Share of store-SKUs with demand that ran out')
      }, 'item', t),
      xAxis: { type: 'category', data: heat.wkIdx.map((_, w) => wlabel(w)), axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false },
        axisLabel: { color: t.muted, fontSize: 11, fontFamily: MONO, margin: 10, interval: (i: number) => /-(01|04|07|10)-0[1-7]$/.test(wlabel(i)), formatter: (v: string) => monthShort(v.slice(0, 8) + '01') } },
      yAxis: { type: 'category', data: cats, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, width: 132, overflow: 'truncate', margin: 10 } },
      visualMap: { type: 'continuous', min: 0, max: heat.max, dimension: 2, orient: 'horizontal', left: 'right', bottom: 0, itemWidth: 10, itemHeight: 120, text: [`${Math.round(heat.max * 100)}%+`, '0%'], textStyle: { color: t.muted, fontFamily: MONO, fontSize: 10.5 },
        inRange: { color: [mix(t.surface, t.fg, 0.07), mix(t.accent, t.surface, 0.55), t.accent] }, calculable: false, show: true },
      series: [{ type: 'heatmap', data: heat.cells, itemStyle: { borderColor: t.surface, borderWidth: 1, borderRadius: 2 }, emphasis: { itemStyle: { borderColor: t.fg, borderWidth: 1 } }, progressive: 0, animation: false }],
    }
  }, [heat, cats, t, meta])

  const T = m?.tot, P = m?.priTot
  const sparkM = (fn: (r: Inv) => number) => m?.cur.byMonth.slice(-12).map(fn)
  const agedShare = T && T.end ? (T.aged[3] + T.aged[4]) / T.end : 0
  const agedShareP = P && P.end ? (P.aged[3] + P.aged[4]) / P.end : null
  const scope = [f.region == null ? 'all locations' : meta.dicts.region[f.region], f.channel == null ? '' : meta.dicts.channel[f.channel]].filter(Boolean).join(' · ')

  return (
    <>
      <PageHeader title="Inventory health" lede={<>Turns, stock-outs and ageing for <span className="text-fg-2">{scope}</span>, {periodLabel(meta, f)}. Inventory is valued at cost from weekly snapshots.</>} />

      {empty_ ? (
        <Card><div className="py-6 text-center text-muted text-[13px]">No inventory matches this combination: e-commerce stock sits in a single distribution centre, outside the four store regions. Clear the region or channel filter.</div></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mb-3">
            {loading ? Array.from({ length: 5 }, (_, i) => <KpiSkeleton key={i} />) : (
              <>
                <KpiCard label="Inventory at cost" value={usd(T!.end)} goodWhen="neutral" delta={P && P.end ? change(T!.end, P.end) : null} sub={`at ${monthLong(meta.months[f.to])}`} spark={sparkM((r) => r.end)} />
                <KpiCard label="Inventory turns" value={times(m!.T)} delta={m!.PT ? change(m!.T, m!.PT) : null} sub="annualised" spark={sparkM((r) => turns(r.cogs, r.avg, 1))} hint="COGS (annualised) ÷ average inventory at cost" />
                <KpiCard label="Weeks of supply" value={(52 / (m!.T || 1)).toFixed(1)} goodWhen="down" delta={m!.PT ? change(52 / m!.T, 52 / m!.PT) : null} spark={sparkM((r) => 52 / (turns(r.cogs, r.avg, 1) || 1))} />
                <KpiCard label="Stock-out rate" value={pct(T!.demand ? T!.stock / T!.demand : 0)} unit="pp" goodWhen="down" delta={P && P.demand ? T!.stock / T!.demand - P.stock / P.demand : null} sub="of store-SKUs with demand" spark={sparkM((r) => (r.demand ? r.stock / r.demand : 0))} />
                <KpiCard label="Aged over 90 days" value={pct(agedShare)} unit="pp" goodWhen="down" delta={agedShareP != null ? agedShare - agedShareP : null} sub="of inventory value" spark={undefined} />
              </>
            )}
          </div>

          <div className="grid grid-cols-12 gap-3">
            <Card className="col-span-12 xl:col-span-5" title="Inventory turns by category" subtitle={`Annualised COGS ÷ average inventory. Dashed line = overall ${m ? times(m.T) : ''}`}>
              <Chart option={turnsOpt} loading={loading} height={312} label={m ? `Inventory turns by category. Overall ${times(m.T)}.` : 'Inventory turns'} />
            </Card>
            <Card className="col-span-12 xl:col-span-7" title="Inventory ageing" subtitle={ageView === 'category' ? `Share of each category’s inventory by age at ${monthLong(meta.months[f.to])}; total value at the right. Sorted by share older than 90 days` : 'Month-end inventory value by age bucket'}
              actions={<Segmented size="sm" label="Ageing view" value={ageView} onChange={setAgeView} options={[{ value: 'category', label: 'By category' }, { value: 'time', label: 'Over time' }]} />}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-fg-2 mb-0.5">
                {BUCKETS.map((b, i) => <span key={b} className="inline-flex items-center gap-[6px]"><i className="inline-block h-[8px] w-[8px] rounded-[2px] border border-line" style={{ background: ramp[i] }} />{b}</span>)}
              </div>
              <Chart option={ageOpt} loading={loading} height={288} chartKey={ageView} label="Inventory value by age bucket." />
            </Card>

            <Card className="col-span-12" title="Stock-out calendar" subtitle="Weekly share of store-SKUs with demand that ran out of stock, by category. Darker = more stock-outs">
              <Chart option={heatOpt} loading={loading} height={292} label="Calendar heatmap of weekly stock-out rate by category." />
              <Note>Stock-outs are weekly: a cell is dark when many store-SKUs in the category had demand but no stock that week.</Note>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
