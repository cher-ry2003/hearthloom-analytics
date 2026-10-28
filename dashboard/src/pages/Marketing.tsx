import { useMemo, useState } from 'react'
import { Card, Note, PageHeader, Segmented } from '../components/Card'
import { Chart } from '../components/Chart'
import { DataTable, VarianceCell, type Col, type SortState } from '../components/DataTable'
import { Delta } from '../components/Delta'
import { KpiCard } from '../components/KpiCard'
import { Sparkline } from '../components/Sparkline'
import { KpiSkeleton, TableSkeleton } from '../components/Skeleton'
import { change } from '../lib/aggregate'
import { catAxis, grid, MONO, tooltip, valAxis } from '../lib/chartKit'
import { useTable, type Table } from '../lib/data'
import { periodLabel, useFilters, type Range } from '../lib/filters'
import { monthLong, monthShort, pct, signedPct, signedUsd, times, usd } from '../lib/format'
import { useTheme } from '../lib/theme'
import { MKT_LABEL } from '../lib/tokens'
import { tipHtml } from '../lib/tip'

const NCH = 5
interface Ch { spend: number; rev: number; orders: number; clicks: number; budget: number; forecast: number }
const emptyCh = (): Ch => ({ spend: 0, rev: 0, orders: 0, clicks: 0, budget: 0, forecast: 0 })

function aggregate(t: Table, r: Range) {
  const byCh = Array.from({ length: NCH }, emptyCh)
  const monthly = Array.from({ length: r.to - r.from + 1 }, () => Array.from({ length: NCH }, emptyCh))
  const c = t.c
  for (let i = 0; i < t.n; i++) {
    const m = c.month[i]
    if (m < r.from || m > r.to) continue
    for (const o of [byCh[c.channel[i]], monthly[m - r.from][c.channel[i]]]) {
      o.spend += c.spend[i]; o.rev += c.attributed_revenue[i]; o.orders += c.attributed_orders[i]; o.clicks += c.clicks[i]
      o.budget += c.budget_spend[i] || 0; o.forecast += c.forecast_spend[i] || 0
    }
  }
  return { byCh, monthly }
}
const sum = (rows: Ch[]) => rows.reduce((o, r) => { o.spend += r.spend; o.rev += r.rev; o.orders += r.orders; o.clicks += r.clicks; o.budget += r.budget; o.forecast += r.forecast; return o }, emptyCh())
const roas = (c: Ch) => (c.spend ? c.rev / c.spend : 0)

export default function Marketing() {
  const { meta, f, prior } = useFilters()
  const { tokens: t } = useTheme()
  const tbl = useTable('marketing')
  const [mixMode, setMixMode] = useState<'spend' | 'share'>('spend')
  const [sort, setSort] = useState<SortState>({ key: 'spend', dir: 'desc' })
  const chNames = meta.dicts.mkt_channel
  const label = (i: number) => MKT_LABEL[chNames[i]] ?? chNames[i]
  const colors = [t.cats[0], t.cats[4], t.cats[3], t.cats[2], t.cats[1]]

  const m = useMemo(() => {
    if (!tbl.data) return null
    const cur = aggregate(tbl.data, f)
    const pri = prior ? aggregate(tbl.data, prior) : null
    const spark = aggregate(tbl.data, { from: Math.max(0, f.to - 11), to: f.to }).monthly
    return { cur, pri, total: sum(cur.byCh), priTotal: pri ? sum(pri.byCh) : null, spark }
  }, [tbl.data, f, prior])
  const loading = !m
  const labels = useMemo(() => meta.months.slice(f.from, f.to + 1).map(monthShort), [meta, f.from, f.to])

  const bars = useMemo(() => {
    if (!m) return {}
    const order = [...Array(NCH).keys()].sort((a, b) => m.cur.byCh[a].spend - m.cur.byCh[b].spend)
    return {
      grid: grid({ left: 4, right: 70, top: 6, bottom: 4 }),
      tooltip: tooltip((p: any) => {
        const i = order[p.dataIndex]
        const c = m.cur.byCh[i], pc = m.pri?.byCh[i]
        return tipHtml(label(i), [
          { color: t.fg2, name: 'Spend', value: usd(c.spend, 2), share: m.total.spend ? c.spend / m.total.spend : null, delta: pc ? change(c.spend, pc.spend) : null },
          { color: colors[i], name: 'Attributed revenue', value: usd(c.rev, 2), share: m.total.rev ? c.rev / m.total.rev : null, delta: pc ? change(c.rev, pc.rev) : null },
          { name: 'ROAS', value: times(roas(c), 2), delta: pc ? change(roas(c), roas(pc)) : null },
        ])
      }, 'item', t),
      xAxis: { type: 'value', show: false },
      yAxis: { type: 'category', data: order.map(label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, margin: 10 } },
      series: [
        { name: 'Spend', type: 'bar', barWidth: 11, barGap: '30%', data: order.map((i) => Math.round(m.cur.byCh[i].spend)), itemStyle: { color: t.cats[7], borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', fontFamily: MONO, fontSize: 10.5, color: t.muted, formatter: (p: any) => usd(p.value) } },
        { name: 'Attributed revenue', type: 'bar', barWidth: 11, data: order.map((i) => ({ value: Math.round(m.cur.byCh[i].rev), itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', fontFamily: MONO, fontSize: 10.5, color: t.fg, formatter: (p: any) => `${usd(p.value)} · ${times(roas(m.cur.byCh[order[p.dataIndex]]))}` } },
      ],
    }
  }, [m, t])

  const roasTrend = useMemo(() => {
    if (!m) return {}
    return {
      grid: grid({ top: 14, right: 78 }),
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex
        return tipHtml(monthLong(meta.months[f.from + i]), [...Array(NCH).keys()].sort((a, b) => roas(m.cur.monthly[i][b]) - roas(m.cur.monthly[i][a])).map((c) => ({
          color: colors[c], name: label(c), value: times(roas(m.cur.monthly[i][c]), 2),
          delta: i > 0 ? change(roas(m.cur.monthly[i][c]), roas(m.cur.monthly[i - 1][c])) : null,
        })), 'Return on ad spend = attributed revenue ÷ spend. Changes vs previous month')
      }, 'axis', t),
      xAxis: catAxis(labels, t),
      yAxis: valAxis(t, (v) => `${v}×`, { min: 0 }),
      series: [...Array(NCH).keys()].map((c) => ({
        name: label(c), type: 'line', smooth: 0.3, symbol: 'none', data: m.cur.monthly.map((row) => +roas(row[c]).toFixed(2)),
        lineStyle: { width: chNames[c] === 'social' ? 2.6 : 1.9, color: colors[c] }, emphasis: { focus: 'series' },
        endLabel: { show: true, formatter: label(c), color: colors[c] === t.cats[1] ? t.fg2 : colors[c], fontSize: 11, distance: 6 }, labelLayout: { moveOverlap: 'shiftY' },
      })),
    }
  }, [m, labels, t, meta, f.from])

  const area = useMemo(() => {
    if (!m) return {}
    const share = mixMode === 'share'
    const tot = m.cur.monthly.map((row) => row.reduce((a, c) => a + c.spend, 0))
    return {
      grid: grid({ top: 12, right: 82 }),
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex
        return tipHtml(monthLong(meta.months[f.from + i]), [...Array(NCH).keys()].map((c) => {
          const v = m.cur.monthly[i][c].spend
          return { color: colors[c], name: label(c), value: usd(v, 2), share: tot[i] ? v / tot[i] : null, delta: i > 0 ? change(v, m.cur.monthly[i - 1][c].spend) : null }
        }), `Total ${usd(tot[i], 2)}`)
      }, 'axis', t),
      xAxis: catAxis(labels, t, { boundaryGap: false }),
      yAxis: valAxis(t, share ? (v) => `${Math.round(v * 100)}%` : (v) => usd(v, 0), share ? { max: 1 } : {}),
      series: [...Array(NCH).keys()].map((c) => ({
        name: label(c), type: 'line', stack: 'mix', smooth: 0.25, symbol: 'none', lineStyle: { width: 1, color: colors[c] },
        areaStyle: { color: colors[c], opacity: 0.82 }, emphasis: { focus: 'series' },
        data: m.cur.monthly.map((row, i) => (share ? (tot[i] ? row[c].spend / tot[i] : 0) : Math.round(row[c].spend))),
        endLabel: { show: true, formatter: label(c), color: t.fg2, fontSize: 11, distance: 6, valueAnimation: false }, labelLayout: { moveOverlap: 'shiftY' },
      })),
    }
  }, [m, labels, t, meta, f.from, mixMode])

  interface R { i: number; c: Ch; p: Ch | null; spark: number[] }
  const rows = useMemo<R[]>(() => {
    if (!m) return []
    const r = [...Array(NCH).keys()].map((i) => ({ i, c: m.cur.byCh[i], p: m.pri ? m.pri.byCh[i] : null, spark: m.spark.map((row) => roas(row[i])) }))
    const val = (x: R): number => ({ spend: x.c.spend, rev: x.c.rev, roas: roas(x.c), cpo: x.c.orders ? x.c.spend / x.c.orders : 0, bud: x.c.budget ? x.c.spend / x.c.budget - 1 : 0, name: x.i })[sort.key as 'spend'] ?? 0
    return r.sort((a, b) => (val(a) - val(b)) * (sort.dir === 'asc' ? 1 : -1))
  }, [m, sort])
  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  const cols: Col<R>[] = [
    { key: 'name', header: 'Channel', width: 150, render: (r) => <span className="inline-flex items-center gap-1 font-medium"><i className="inline-block h-[8px] w-[8px] rounded-[2px]" style={{ background: colors[r.i] }} />{label(r.i)}</span> },
    { key: 'spend', header: 'Spend', align: 'right', numeric: true, sortable: true, render: (r) => usd(r.c.spend, 2) },
    { key: 'rev', header: 'Attributed revenue', align: 'right', numeric: true, sortable: true, render: (r) => usd(r.c.rev, 2) },
    { key: 'roas', header: 'ROAS', align: 'right', numeric: true, sortable: true, render: (r) => <span className="inline-flex items-center gap-1 justify-end">{times(roas(r.c), 2)}{r.p && <Delta value={change(roas(r.c), roas(r.p))} compact />}</span> },
    { key: 'trend', header: 'ROAS, last 12 mo', align: 'right', render: (r) => <div className="w-[96px] ml-auto"><Sparkline values={r.spark} color={colors[r.i] === t.cats[1] ? t.fg2 : colors[r.i]} height={24} label={`${label(r.i)} ROAS trend`} /></div> },
    { key: 'cpo', header: 'Cost / order', align: 'right', numeric: true, sortable: true, render: (r) => (r.c.orders ? '$' + (r.c.spend / r.c.orders).toFixed(2) : '–') },
    { key: 'bud', header: 'Spend vs budget', align: 'right', numeric: true, sortable: true, render: (r) => r.c.budget ? <VarianceCell value={r.c.spend / r.c.budget - 1} text={signedPct(r.c.spend / r.c.budget - 1)} goodWhen="down" scale={0.15} /> : '–' },
  ]

  const T = m?.total, P = m?.priTotal
  const sparkOf = (fn: (c: Ch[]) => number) => m?.spark.map(fn)

  return (
    <>
      <PageHeader title="Marketing effectiveness"
        lede={<>Spend, attributed revenue and return on ad spend across five channels, {periodLabel(meta, f)}. Spend is national, so only the date range applies on this page.</>} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mb-3">
        {loading ? Array.from({ length: 5 }, (_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard label="Marketing spend" value={usd(T!.spend)} goodWhen="neutral" delta={P ? change(T!.spend, P.spend) : null} spark={sparkOf((r) => r.reduce((a, c) => a + c.spend, 0))} />
            <KpiCard label="Attributed revenue" value={usd(T!.rev)} delta={P ? change(T!.rev, P.rev) : null} spark={sparkOf((r) => r.reduce((a, c) => a + c.rev, 0))} hint="Revenue credited to marketing by each channel’s own attribution model" />
            <KpiCard label="Blended ROAS" value={times(roas(T!), 2)} delta={P ? change(roas(T!), roas(P)) : null} spark={sparkOf((r) => roas(sum(r)))} />
            <KpiCard label="Cost per order" value={'$' + (T!.orders ? T!.spend / T!.orders : 0).toFixed(2)} goodWhen="down" delta={P && P.orders ? change(T!.spend / T!.orders, P.spend / P.orders) : null} spark={sparkOf((r) => { const s = sum(r); return s.orders ? s.spend / s.orders : 0 })} />
            <KpiCard label="Spend vs budget" value={signedUsd(T!.spend - T!.budget)} goodWhen="down" delta={T!.budget ? T!.spend / T!.budget - 1 : null} sub={<>budget <span className="num">{usd(T!.budget)}</span></>} spark={sparkOf((r) => { const s = sum(r); return s.budget ? s.spend / s.budget - 1 : 0 })} />
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-6" title="Spend vs attributed revenue" subtitle="By channel. Revenue bars are labelled with value and ROAS">
          <Chart option={bars} loading={loading} height={296} label={m ? `Spend versus attributed revenue by channel. Blended ROAS ${times(roas(m.total), 2)}.` : 'Spend versus revenue'} />
        </Card>
        <Card className="col-span-12 xl:col-span-6" title="Return on ad spend over time" subtitle="Monthly attributed revenue per dollar of spend">
          <Chart option={roasTrend} loading={loading} height={296} label="Monthly ROAS trend by marketing channel." />
        </Card>
        <Card className="col-span-12 xl:col-span-7" title="Channel mix" subtitle={mixMode === 'spend' ? 'Monthly spend, stacked by channel' : 'Share of monthly spend by channel'}
          actions={<Segmented size="sm" label="Mix view" value={mixMode} onChange={setMixMode} options={[{ value: 'spend', label: 'Spend' }, { value: 'share', label: 'Share' }]} />}>
          <Chart option={area} loading={loading} height={296} chartKey={mixMode} label="Stacked area chart of monthly marketing spend by channel." />
        </Card>
        <Card className="col-span-12 xl:col-span-5" title="How to read this">
          <ul className="m-0 pl-2.5 mb-1.5 text-[13px] text-fg-2 leading-[20px] flex flex-col gap-1 list-disc marker:text-muted">
            <li><b className="text-fg font-medium">ROAS</b> is attributed revenue divided by spend. It is self-reported by channel, so treat levels with care and trends with more trust.</li>
            <li>Channels differ structurally: email is cheap and high-return, TV builds demand and shows low direct ROAS.</li>
            <li>Compare <b className="text-fg font-medium">spend vs budget</b> with the ROAS trend: money flowing to a channel whose return is falling is the first thing to question.</li>
          </ul>
          <Note>Attribution windows and overlap between channels mean attributed revenue can exceed what any single channel truly caused.</Note>
        </Card>
        <Card className="col-span-12" title="Channel scorecard" subtitle="Click a column to sort. Δ badges compare with the prior period.">
          {loading ? <TableSkeleton rows={5} /> : <DataTable caption="Marketing channel scorecard" columns={cols} rows={rows} rowKey={(r) => String(r.i)} sort={sort} onSort={onSort} maxHeight={360} />}
        </Card>
      </div>
    </>
  )
}
