import { useMemo, useState } from 'react'
import { Card, Note, PageHeader } from '../components/Card'
import { Chart } from '../components/Chart'
import { DataTable, VarianceCell, type Col, type SortState } from '../components/DataTable'
import { KpiCard } from '../components/KpiCard'
import { KpiSkeleton, TableSkeleton } from '../components/Skeleton'
import { change, pnlGroup, pnlMonthly, productAgg, sumPnl } from '../lib/aggregate'
import { grid, MONO, mix, textOn, tooltip } from '../lib/chartKit'
import { useTable, useTables } from '../lib/data'
import { periodLabel, useFilters } from '../lib/filters'
import { compactNum, int, pct, usd } from '../lib/format'
import { useTheme } from '../lib/theme'
import { tipHtml } from '../lib/tip'

interface Off { id: string; name: string; category: string; supplier: string; units: number; rr: number; idx: number; refunds: number; gm: number }

export default function Products() {
  const { meta, f, prior } = useFilters()
  const { tokens: t } = useTheme()
  const core = useTables(['pnl', 'returns_reason'] as const)
  const prod = useTable('product_monthly')
  const [sort, setSort] = useState<SortState>({ key: 'rr', dir: 'desc' })
  const sel = useMemo(() => ({ region: f.region, channel: f.channel }), [f.region, f.channel])
  const cats = meta.dicts.category
  const channels = meta.dicts.channel

  const m = useMemo(() => {
    if (!core.data) return null
    const cur = pnlGroup(core.data.pnl, f, sel, 'category', cats.length)
    const pri = prior ? pnlGroup(core.data.pnl, prior, sel, 'category', cats.length) : null
    const total = sumPnl(cur)
    const priTotal = pri ? sumPnl(pri) : null
    // by category x channel (respecting the channel filter)
    const byChan = channels.map((_, ci) => (f.channel != null && f.channel !== ci ? null : pnlGroup(core.data!.pnl, f, { region: f.region, channel: ci }, 'category', cats.length)))
    // return reasons
    const rr = core.data.returns_reason.c
    const reasons = new Array(meta.dicts.reason.length).fill(0)
    const refundsByReason = new Array(meta.dicts.reason.length).fill(0)
    for (let i = 0; i < core.data.returns_reason.n; i++) {
      if (rr.month[i] < f.from || rr.month[i] > f.to) continue
      if (f.region != null && rr.region[i] !== f.region) continue
      if (f.channel != null && rr.channel[i] !== f.channel) continue
      reasons[rr.return_reason[i]] += rr.units_returned[i]
      refundsByReason[rr.return_reason[i]] += rr.refunds[i]
    }
    const monthly = pnlMonthly(core.data.pnl, { from: Math.max(0, f.to - 11), to: f.to }, sel)
    return { cur, pri, total, priTotal, byChan, reasons, refundsByReason, monthly }
  }, [core.data, f, prior, sel, cats.length, channels, meta.dicts.reason.length])
  const loading = !m

  const pa = useMemo(() => (prod.data ? { cur: productAgg(prod.data, f, sel, meta.products.length), pri: prior ? productAgg(prod.data, prior, sel, meta.products.length) : null } : null), [prod.data, f, prior, sel, meta.products])

  // ---- treemap ----
  const treemap = useMemo(() => {
    if (!m) return {}
    const tot = m.total.net_revenue
    const data = cats.map((name, i) => {
      const fill = t.cats[i % 8]
      return { name, value: Math.round(m.cur[i].net_revenue), gm: m.cur[i].gm, idx: i, fill, itemStyle: { color: fill }, label: { color: textOn(fill) } }
    }).filter((d) => d.value > 0)
    return {
      tooltip: tooltip((p: any) => {
        const d = p.data
        return tipHtml(d.name, [{ color: d.fill, name: 'Net revenue', value: usd(d.value, 2), share: tot ? d.value / tot : null, delta: m.pri ? change(m.cur[d.idx].net_revenue, m.pri[d.idx].net_revenue) : null },
          { name: 'Gross margin', value: pct(d.gm) }, { name: 'Return rate', value: pct(m.cur[d.idx].return_rate) }])
      }, 'item', t),
      series: [{
        type: 'treemap', data, roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, right: 0, top: 0, bottom: 0, squareRatio: 1.1,
        itemStyle: { borderColor: t.surface, borderWidth: 3, gapWidth: 3, borderRadius: 8 },
        label: { show: true, position: 'insideTopLeft', padding: [12, 14], overflow: 'truncate' as const,
          formatter: (p: any) => `{n|${p.name}}\n{v|${usd(p.value)}}\n{g|${pct(p.data.gm, 0)} GM · ${pct(tot ? p.value / tot : 0, 0)}}`,
          rich: { n: { fontSize: 13, fontWeight: 600, lineHeight: 20, }, v: { fontSize: 18, fontFamily: MONO, lineHeight: 26 }, g: { fontSize: 11, lineHeight: 16, opacity: 0.85 } } },
        animationDurationUpdate: 400,
      }],
    }
  }, [m, cats, t])

  // ---- return rate by category & channel ----
  const rrOpt = useMemo(() => {
    if (!m) return {}
    const order = [...cats.keys()].sort((a, b) => (m.cur[a].return_rate) - (m.cur[b].return_rate))
    const mk = (ci: number, color: string) => ({
      name: channels[ci], type: 'bar', barWidth: 8, barGap: '25%', barCategoryGap: '34%', data: order.map((i) => m.byChan[ci] ? +(m.byChan[ci]![i].return_rate * 100).toFixed(2) : null),
      itemStyle: { color, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', fontFamily: MONO, fontSize: 10.5, color: t.fg2, formatter: (p: any) => (p.value == null ? '' : p.value.toFixed(1) + '%') },
    })
    return {
      grid: grid({ left: 4, right: 40, top: 6, bottom: 4 }),
      tooltip: tooltip((ps: any[]) => {
        const i = order[ps[0].dataIndex]
        return tipHtml(cats[i], channels.map((c, ci) => m.byChan[ci] ? { color: ci === 0 ? t.cats[0] : t.accent, name: c, value: pct(m.byChan[ci]![i].return_rate, 2), sub: `${int(m.byChan[ci]![i].units_returned)} of ${int(m.byChan[ci]![i].units)} units` } : null).filter(Boolean) as any,
          m.pri ? `All channels: ${pct(m.cur[i].return_rate, 2)} (prior ${pct(m.pri[i].return_rate, 2)})` : undefined)
      }, 'axis', t),
      xAxis: { type: 'value', show: false },
      yAxis: { type: 'category', data: order.map((i) => cats[i]), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, width: 124, overflow: 'truncate', margin: 10 } },
      series: [mk(0, t.cats[0]), mk(1, t.accent)],
    }
  }, [m, cats, channels, t])

  // ---- reasons: one 100% stacked bar with direct labels ----
  const reasonOpt = useMemo(() => {
    if (!m) return {}
    const names = meta.dicts.reason
    const total = m.reasons.reduce((a: number, b: number) => a + b, 0)
    const order = [...names.keys()].sort((a, b) => m.reasons[b] - m.reasons[a])
    const greys = [0, 0.14, 0.26, 0.38, 0.5, 0.6]
    return {
      grid: grid({ left: 0, right: 0, top: 0, bottom: 0, containLabel: false }),
      tooltip: tooltip((p: any) => {
        const i = names.indexOf(p.seriesName)
        return tipHtml(names[i], [{ color: p.color, name: 'Units returned', value: int(m.reasons[i]), share: total ? m.reasons[i] / total : null }, { name: 'Refunds', value: usd(m.refundsByReason[i], 2) }])
      }, 'item', t),
      xAxis: { type: 'value', show: false, max: 1 }, yAxis: { type: 'category', show: false, data: ['r'] },
      series: order.map((i, k) => {
        const fill = names[i] === 'Defective' ? t.accent : mix(t.cats[7], t.surface, greys[k])
        return { name: names[i], type: 'bar', stack: 'r', barWidth: 44, data: [total ? m.reasons[i] / total : 0], itemStyle: { color: fill, borderColor: t.surface, borderWidth: 2, borderRadius: 6 },
          label: { show: true, position: 'insideLeft', color: textOn(fill), fontSize: 11.5, fontFamily: 'Geist Variable', padding: [0, 0, 0, 6], overflow: 'truncate' as const,
            formatter: () => ((total ? m.reasons[i] / total : 0) < 0.1 ? '' : `{n|${names[i]}}  {v|${pct(total ? m.reasons[i] / total : 0, 0)}}`), rich: { n: { fontWeight: 600, fontSize: 11.5 }, v: { fontFamily: MONO, fontSize: 11 } } } }
      }),
    }
  }, [m, meta.dicts.reason, t])

  // ---- worst offenders ----
  const offenders = useMemo<{ rows: Off[]; total: number }>(() => {
    if (!pa) return { rows: [], total: 0 }
    const catAvg = new Map<string, { u: number; r: number }>()
    meta.products.forEach((p, k) => { const c = catAvg.get(p.category) ?? { u: 0, r: 0 }; c.u += pa.cur[k].units; c.r += pa.cur[k].units_returned; catAvg.set(p.category, c) })
    const units = pa.cur.map((x) => x.units).filter((u) => u > 0).sort((a, b) => a - b)
    const minUnits = Math.max(25, units.length ? units[Math.floor(units.length * 0.25)] : 25)
    const all: Off[] = []
    meta.products.forEach((p, k) => {
      const c = pa.cur[k]
      if (c.units < minUnits) return
      const ca = catAvg.get(p.category)!
      const rr = c.units_returned / c.units
      const net = c.net_sales - c.refunds
      all.push({ id: p.id, name: p.name, category: p.category, supplier: p.supplier, units: c.units, rr, idx: ca.r ? rr / (ca.r / ca.u) : 0, refunds: c.refunds, gm: net ? (net - c.cogs) / net : 0 })
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = (o: Off): number | string => ({ name: o.name, category: o.category, supplier: o.supplier, units: o.units, rr: o.rr, idx: o.idx, refunds: o.refunds, gm: o.gm })[sort.key as 'rr']
    all.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * dir })
    return { rows: all.slice(0, 25), total: all.length }
  }, [pa, meta.products, sort])

  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' || key === 'category' || key === 'supplier' ? 'asc' : 'desc' }))
  const cols: Col<Off>[] = [
    { key: 'name', header: 'Product', width: 190, sortable: true, render: (r) => <span className="font-medium">{r.name}<span className="ml-1 text-[11px] text-muted num">{r.id}</span><span className="block text-[11px] text-muted font-normal leading-[14px]">{r.category}</span></span> },
    { key: 'supplier', header: 'Supplier', sortable: true, render: (r) => <span className="text-fg-2">{r.supplier}</span> },
    { key: 'units', header: 'Units', align: 'right', numeric: true, sortable: true, render: (r) => int(r.units) },
    { key: 'rr', header: 'Return %', align: 'right', numeric: true, sortable: true, render: (r) => pct(r.rr) },
    { key: 'idx', header: 'vs category', align: 'right', numeric: true, sortable: true, title: 'Return rate ÷ category average (1.0× = typical for its category)', render: (r) => <VarianceCell value={r.idx - 1} text={`${r.idx.toFixed(1)}×`} goodWhen="down" scale={0.6} /> },
    { key: 'refunds', header: 'Refunds', align: 'right', numeric: true, sortable: true, render: (r) => usd(r.refunds, 1) },
    { key: 'gm', header: 'Margin', align: 'right', numeric: true, sortable: true, render: (r) => pct(r.gm) },
  ]

  const T = m?.total, P = m?.priTotal
  const defective = m ? (m.reasons[meta.dicts.reason.indexOf('Defective')] / (m.reasons.reduce((a: number, b: number) => a + b, 0) || 1)) : 0
  const sp = (fn: (i: number) => number) => m?.monthly.map((_, i) => fn(i))

  return (
    <>
      <PageHeader title="Products and returns" lede={<>What sells, what comes back, and which products drive the returns, {periodLabel(meta, f)}. Returns are attributed to the month of the original sale.</>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-3">
        {loading ? Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard label="Units sold" value={compactNum(T!.units)} delta={P ? change(T!.units, P.units) : null} spark={sp((i) => m!.monthly[i].units)} />
            <KpiCard label="Return rate" value={pct(T!.return_rate)} unit="pp" goodWhen="down" delta={P ? T!.return_rate - P.return_rate : null} spark={sp((i) => m!.monthly[i].return_rate)} />
            <KpiCard label="Refunds" value={usd(T!.refunds)} goodWhen="down" delta={P ? change(T!.refunds, P.refunds) : null} spark={sp((i) => m!.monthly[i].refunds)} />
            <KpiCard label="Returns coded defective" value={pct(defective, 0)} sub="of units returned" spark={undefined} />
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-7" title="Category treemap" subtitle="Tile area = net revenue after returns, with gross margin and share of total">
          <Chart option={treemap} loading={loading} height={360} label={m ? `Treemap of net revenue by category. Largest is ${cats[[...cats.keys()].sort((a, b) => m.cur[b].net_revenue - m.cur[a].net_revenue)[0]]}.` : 'Category treemap'} />
        </Card>
        <Card className="col-span-12 xl:col-span-5" title="Return rate by category and channel" subtitle="Units returned ÷ units sold">
          <div className="flex items-center gap-2 text-[12px] text-fg-2 mb-0.5">
            <span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[8px] w-[8px] rounded-[2px]" style={{ background: t.cats[0] }} />In-store</span>
            <span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[8px] w-[8px] rounded-[2px]" style={{ background: t.accent }} />E-commerce</span>
          </div>
          <Chart option={rrOpt} loading={loading} height={326} label="Return rate by category, in-store versus e-commerce." />
        </Card>

        <Card className="col-span-12" title="Why items come back" subtitle="Share of units returned by reason. Shipping-related reasons only occur on e-commerce orders">
          <Chart option={reasonOpt} loading={loading} height={52} label="Share of units returned by reason code." />
          {m && (() => {
            const tot = m.reasons.reduce((a: number, b: number) => a + b, 0) || 1
            const order = [...meta.dicts.reason.keys()].sort((a, b) => m.reasons[b] - m.reasons[a])
            return (
              <ul className="m-0 mt-1.5 p-0 list-none flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-fg-2">
                {order.map((i, k) => (
                  <li key={i} className="inline-flex items-center gap-[6px]">
                    <i className="inline-block h-[8px] w-[8px] rounded-[2px]" style={{ background: meta.dicts.reason[i] === 'Defective' ? t.accent : mix(t.cats[7], t.surface, [0, 0.14, 0.26, 0.38, 0.5, 0.6][k]) }} />
                    {meta.dicts.reason[i]} <span className="num text-muted">{int(m.reasons[i])} · {pct(m.reasons[i] / tot, 1)}</span>
                  </li>
                ))}
              </ul>
            )
          })()}
        </Card>
        <Card className="col-span-12" title="Worst offenders" subtitle={offenders.total ? `Top 25 of ${offenders.total} products with meaningful volume, by ${sort.key === 'rr' ? 'return rate' : sort.key}` : 'Highest-returning products with meaningful volume'}>
          {!pa ? <TableSkeleton rows={8} /> : <DataTable caption="Products ranked by return rate" columns={cols} rows={offenders.rows} rowKey={(r) => r.id} sort={sort} onSort={onSort} maxHeight={380} />}
        </Card>
      </div>
    </>
  )
}
