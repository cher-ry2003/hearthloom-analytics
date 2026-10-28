import { useMemo, useState } from 'react'
import { Card, PageHeader, Segmented } from '../components/Card'
import { Chart } from '../components/Chart'
import { DataTable, VarianceCell, type Col, type SortState } from '../components/DataTable'
import { Icon } from '../components/Icon'
import { KpiCard } from '../components/KpiCard'
import { KpiSkeleton, TableSkeleton } from '../components/Skeleton'
import { addVar, emptyVar, sumVar, varCube, varMonthly, type Var } from '../lib/aggregate'
import { catAxis, grid, MONO, mix, tooltip, valAxis } from '../lib/chartKit'
import { useTable } from '../lib/data'
import { periodLabel, useFilters } from '../lib/filters'
import { monthLong, monthShort, pct, signedPct, signedPp, signedUsd, usd } from '../lib/format'
import { useTheme } from '../lib/theme'
import { tipHtml } from '../lib/tip'

const rel = (a: number, b: number) => (b ? (a - b) / b : 0)
const gm = (rev: number, cogs: number) => (rev ? (rev - cogs) / rev : 0)

interface Row { id: string; label: string; depth: 0 | 1; v: Var; parent?: string; hasKids?: boolean }

export default function Budget() {
  const { meta, f } = useFilters()
  const { tokens: t } = useTheme()
  const tbl = useTable('variance')
  const [by, setBy] = useState<'region' | 'category'>('region')
  const [hier, setHier] = useState<'region' | 'category'>('region')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortState>({ key: 'a', dir: 'desc' })
  const sel = useMemo(() => ({ region: f.region, channel: f.channel }), [f.region, f.channel])
  const regions = meta.dicts.region.slice(0, 4)
  const cats = meta.dicts.category

  const m = useMemo(() => {
    if (!tbl.data) return null
    const cube = varCube(tbl.data, f, sel)
    const monthly = varMonthly(tbl.data, f, sel)
    const byRegion = cube.map((row) => sumVar(row))
    const byCat = cats.map((_, c) => cube.reduce((o, row) => addVar(o, row[c]), emptyVar()))
    return { cube, monthly, byRegion, byCat, total: sumVar(byRegion) }
  }, [tbl.data, f, sel, cats])

  const loading = !m
  const labels = useMemo(() => meta.months.slice(f.from, f.to + 1).map(monthShort), [meta, f.from, f.to])

  // ---- waterfall ----
  const waterfall = useMemo(() => {
    if (!m) return {}
    const groups = by === 'region' ? m.byRegion.map((v, i) => ({ n: regions[i], v })) : m.byCat.map((v, i) => ({ n: cats[i], v }))
    const used = groups.filter((g) => g.v.a || g.v.b)
    const names = ['Budget', ...used.map((g) => g.n), 'Actual']
    const base: number[] = [], total: (number | string)[] = [], up: (number | string)[] = [], down: (number | string)[] = []
    let run = m.total.b
    const deltas: (number | null)[] = [null]
    base.push(0); total.push(Math.round(m.total.b)); up.push('-'); down.push('-')
    for (const g of used) {
      const d = g.v.a - g.v.b
      deltas.push(d)
      if (d >= 0) { base.push(Math.round(run)); up.push(Math.round(d)); down.push('-') } else { base.push(Math.round(run + d)); down.push(Math.round(-d)); up.push('-') }
      total.push('-')
      run += d
    }
    deltas.push(null)
    base.push(0); total.push(Math.round(m.total.a)); up.push('-'); down.push('-')
    const lo = Math.min(m.total.a, m.total.b, ...base.slice(1, -1).map(Number).filter((x) => x > 0))
    const min = Math.floor((lo * 0.94) / 1e6) * 1e6
    const lab = (kind: 'up' | 'down' | 'total') => ({
      show: true, position: 'top', fontFamily: MONO, fontSize: 11, color: kind === 'total' ? t.fg : kind === 'up' ? t.good : t.bad,
      formatter: (p: any) => (p.value === '-' ? '' : kind === 'total' ? usd(p.value) : `${kind === 'up' ? '▲ +' : '▼ −'}${usd(p.value).replace('−', '')}`),
    })
    return {
      grid: grid({ top: 28, right: 8 }),
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex
        if (i === 0) return tipHtml('Budget', [{ name: 'Net sales', value: usd(m.total.b, 2) }])
        if (i === names.length - 1) return tipHtml('Actual', [{ name: 'Net sales', value: usd(m.total.a, 2) }, { name: 'vs budget', value: signedPct(rel(m.total.a, m.total.b)) }])
        const g = used[i - 1]
        return tipHtml(g.n, [{ name: 'Actual', value: usd(g.v.a, 2), share: m.total.a ? g.v.a / m.total.a : null },
          { name: 'Budget', value: usd(g.v.b, 2) }, { name: 'Variance', value: `${signedUsd(g.v.a - g.v.b, 2)} (${signedPct(rel(g.v.a, g.v.b))})` }])
      }, 'axis', t),
      xAxis: catAxis(names, t, { axisLabel: { color: t.fg2, fontSize: 12, fontFamily: 'Geist Variable', interval: 0, hideOverlap: false, margin: 10, width: 84, overflow: 'break' } }),
      yAxis: valAxis(t, (v) => usd(v, 0), { min }),
      series: [
        { name: 'base', type: 'bar', stack: 'w', data: base, itemStyle: { color: 'transparent' }, silent: true, tooltip: { show: false } },
        { name: 'Total', type: 'bar', stack: 'w', data: total, barMaxWidth: 44, itemStyle: { color: t.accent, borderRadius: [5, 5, 0, 0] }, label: lab('total') },
        { name: 'Above budget', type: 'bar', stack: 'w', data: up, barMaxWidth: 44, itemStyle: { color: t.good, borderRadius: [5, 5, 0, 0], opacity: 0.88 }, label: lab('up') },
        { name: 'Below budget', type: 'bar', stack: 'w', data: down, barMaxWidth: 44, itemStyle: { color: t.bad, borderRadius: [5, 5, 0, 0], opacity: 0.88 }, label: lab('down') },
      ],
    }
  }, [m, by, regions, cats, t])

  // ---- monthly lines + variance bars ----
  const lines = useMemo(() => {
    if (!m) return {}
    const varp = m.monthly.map((v) => +rel(v.a, v.b).toFixed(4))
    return {
      grid: [grid({ top: 12, height: '50%', right: 8 }), grid({ top: '67%', height: '20%', right: 8 })],
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex
        const v = m.monthly[i]
        return tipHtml(monthLong(meta.months[f.from + i]), [
          { color: t.accent, name: 'Actual', value: usd(v.a, 2) },
          { color: t.cats[7], name: 'Budget', value: usd(v.b, 2), sub: `Actual vs budget  ${signedPct(rel(v.a, v.b))}` },
          { color: t.cats[1], name: 'Forecast', value: usd(v.f, 2), sub: `Actual vs forecast  ${signedPct(rel(v.a, v.f))}` },
        ])
      }, 'axis', t),
      xAxis: [catAxis(labels, t, { gridIndex: 0, axisLabel: { show: false }, axisLine: { show: false } }), catAxis(labels, t, { gridIndex: 1, axisLine: { show: false } })],
      yAxis: [valAxis(t, (v) => usd(v, 1), { gridIndex: 0, scale: true, splitNumber: 4 }),
        valAxis(t, (v) => `${Math.round(v * 100)}%`, { gridIndex: 1, splitNumber: 1, min: (v: any) => Math.min(-0.04, v.min), max: (v: any) => Math.max(0.04, v.max) })],
      series: [
        { name: 'Actual', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: m.monthly.map((v) => Math.round(v.a)), smooth: 0.2, symbol: 'none', lineStyle: { width: 2.4, color: t.accent } },
        { name: 'Budget', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: m.monthly.map((v) => Math.round(v.b)), smooth: 0.2, symbol: 'none', lineStyle: { width: 1.8, color: t.cats[7], type: [5, 4] } },
        { name: 'Forecast', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: m.monthly.map((v) => Math.round(v.f)), smooth: 0.2, symbol: 'none', lineStyle: { width: 1.8, color: t.cats[1], type: [1.5, 3.5] } },
        { name: 'Variance vs budget', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 16,
          data: varp.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? t.good : t.bad, opacity: 0.85, borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })) },
      ],
    }
  }, [m, labels, t, meta, f.from])

  // ---- heatmap ----
  const heat = useMemo(() => {
    if (!m) return {}
    const cells: [number, number, number][] = []
    m.cube.forEach((row, r) => row.forEach((v, c) => { if (v.b) cells.push([c, r, +rel(v.a, v.b).toFixed(4)]) }))
    const lim = 0.1
    return {
      grid: grid({ left: 4, right: 4, top: 4, bottom: 28 }),
      tooltip: tooltip((p: any) => {
        const [c, r] = p.value
        const v = m.cube[r][c]
        return tipHtml(`${regions[r]} · ${cats[c]}`, [{ name: 'Variance vs budget', value: signedPct(rel(v.a, v.b)) },
          { name: 'Actual', value: usd(v.a, 2) }, { name: 'Budget', value: usd(v.b, 2) }], 'Difference ' + signedUsd(v.a - v.b, 2))
      }, 'item', t),
      xAxis: { type: 'category', data: cats, position: 'bottom', splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 11, interval: 0, width: 72, overflow: 'break', margin: 8 } },
      yAxis: { type: 'category', data: regions, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, margin: 10 } },
      visualMap: { show: false, min: -lim, max: lim, dimension: 2, inRange: { color: [mix(t.bad, t.surface, 0.45), t.surface, mix(t.good, t.surface, 0.45)] }, outOfRange: { color: t.surface } },
      series: [{
        type: 'heatmap', data: cells, itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 6 },
        label: { show: true, fontFamily: MONO, fontSize: 11.5, color: t.fg, formatter: (p: any) => signedPct(p.value[2], 1).replace('+0.0%', '0.0%') },
        emphasis: { itemStyle: { borderColor: t.fg2, borderWidth: 1.5 } },
      }],
    }
  }, [m, regions, cats, t])

  // ---- drill-down table ----
  const parentNames = hier === 'region' ? regions : cats
  const childNames = hier === 'region' ? cats : regions
  const rows = useMemo<Row[]>(() => {
    if (!m) return []
    const val = (p: number, c: number) => (hier === 'region' ? m.cube[p][c] : m.cube[c][p])
    const parents = parentNames.map((n, p) => {
      const v = childNames.reduce((o, _, c) => addVar(o, val(p, c)), emptyVar())
      return { n, p, v }
    }).filter((x) => x.v.a || x.v.b)
    const key = (v: Var): Record<string, number> => ({
      a: v.a, b: v.b, var: v.a - v.b, varp: rel(v.a, v.b), f: v.f, varf: rel(v.a, v.f), gma: gm(v.a, v.ac), gmb: gm(v.b, v.bc), gmd: gm(v.a, v.ac) - gm(v.b, v.bc),
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    const cmp = (x: Var, y: Var) => (key(x)[sort.key] - key(y)[sort.key]) * dir
    parents.sort((x, y) => cmp(x.v, y.v))
    const out: Row[] = [{ id: 'total', label: 'Total', depth: 0, v: m.total, hasKids: false }]
    for (const P of parents) {
      out.push({ id: `p${P.p}`, label: P.n, depth: 0, v: P.v, hasKids: true })
      if (open.has(`p${P.p}`)) {
        const kids = childNames.map((n, c) => ({ n, c, v: val(P.p, c) })).filter((x) => x.v.a || x.v.b)
        kids.sort((x, y) => cmp(x.v, y.v))
        kids.forEach((K) => out.push({ id: `p${P.p}c${K.c}`, label: K.n, depth: 1, v: K.v, parent: `p${P.p}` }))
      }
    }
    return out
  }, [m, hier, open, sort, parentNames, childNames])

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  const allOpen = open.size >= parentNames.length

  const cols: Col<Row>[] = [
    { key: 'label', header: hier === 'region' ? 'Region → category' : 'Category → region', width: 200, render: (r) => (
      <span className={`inline-flex items-center gap-[4px] ${r.depth ? 'pl-3 text-fg-2' : r.id === 'total' ? 'font-semibold' : 'font-medium'}`}>
        {r.hasKids && (
          <button onClick={(e) => { e.stopPropagation(); toggle(r.id) }} aria-expanded={open.has(r.id)} aria-label={`${open.has(r.id) ? 'Collapse' : 'Expand'} ${r.label}`}
            className="t-fast grid place-items-center h-[20px] w-[20px] rounded-md text-muted hover:bg-surface-2 hover:text-fg">
            <Icon name="caret" size={13} style={{ transform: open.has(r.id) ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }} />
          </button>
        )}
        {r.label}
      </span>
    ) },
    { key: 'a', header: 'Actual', align: 'right', numeric: true, sortable: true, render: (r) => usd(r.v.a, 2) },
    { key: 'b', header: 'Budget', align: 'right', numeric: true, sortable: true, render: (r) => usd(r.v.b, 2) },
    { key: 'var', header: 'Var $', align: 'right', numeric: true, sortable: true, render: (r) => <VarianceCell value={rel(r.v.a, r.v.b)} text={signedUsd(r.v.a - r.v.b, 2)} scale={0.1} /> },
    { key: 'varp', header: 'Var %', align: 'right', numeric: true, sortable: true, render: (r) => <VarianceCell value={rel(r.v.a, r.v.b)} text={signedPct(rel(r.v.a, r.v.b))} scale={0.1} /> },
    { key: 'f', header: 'Forecast', align: 'right', numeric: true, sortable: true, render: (r) => usd(r.v.f, 2) },
    { key: 'varf', header: 'vs fcst', align: 'right', numeric: true, sortable: true, render: (r) => <VarianceCell value={rel(r.v.a, r.v.f)} text={signedPct(rel(r.v.a, r.v.f))} scale={0.1} /> },
    { key: 'gma', header: 'Margin', align: 'right', numeric: true, sortable: true, title: 'Actual gross margin before returns', render: (r) => pct(gm(r.v.a, r.v.ac)) },
    { key: 'gmb', header: 'Bud. margin', align: 'right', numeric: true, sortable: true, render: (r) => pct(gm(r.v.b, r.v.bc)) },
    { key: 'gmd', header: 'Margin Δ', align: 'right', numeric: true, sortable: true, render: (r) => <VarianceCell value={gm(r.v.a, r.v.ac) - gm(r.v.b, r.v.bc)} text={signedPp(gm(r.v.a, r.v.ac) - gm(r.v.b, r.v.bc))} scale={0.05} /> },
  ]

  const T = m?.total
  const gpA = T ? T.a - T.ac : 0, gpB = T ? T.b - T.bc : 0
  const scope = [f.region == null ? 'all regions' : regions[f.region], f.channel == null ? 'all channels' : meta.dicts.channel[f.channel]].join(' · ')

  return (
    <>
      <PageHeader title="Budget, actual and forecast"
        lede={<>Net sales and gross margin (before returns) against the annual budget and the quarterly re-forecast, for <span className="text-fg-2">{scope}</span>, {periodLabel(meta, f)}.</>} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-3">
        {loading ? Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard label="Net sales" value={usd(T!.a)} delta={rel(T!.a, T!.b)} sub={<>vs budget <span className="num">{usd(T!.b)}</span></>} spark={m!.monthly.slice(-12).map((v) => v.a)} />
            <KpiCard label="Net sales vs forecast" value={signedUsd(T!.a - T!.f)} delta={rel(T!.a, T!.f)} sub={<>forecast <span className="num">{usd(T!.f)}</span></>} spark={m!.monthly.slice(-12).map((v) => rel(v.a, v.f))} />
            <KpiCard label="Gross profit" value={usd(gpA)} delta={rel(gpA, gpB)} sub={<>vs budget <span className="num">{usd(gpB)}</span></>} spark={m!.monthly.slice(-12).map((v) => v.a - v.ac)} />
            <KpiCard label="Gross margin" value={pct(gm(T!.a, T!.ac))} unit="pp" delta={gm(T!.a, T!.ac) - gm(T!.b, T!.bc)} sub={<>budget <span className="num">{pct(gm(T!.b, T!.bc))}</span></>} spark={m!.monthly.slice(-12).map((v) => gm(v.a, v.ac))} />
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-7" title="Variance waterfall" subtitle="From budget to actual net sales, by contributor. The value axis does not start at zero"
          actions={<Segmented size="sm" label="Waterfall breakdown" value={by} onChange={setBy} options={[{ value: 'region', label: 'By region' }, { value: 'category', label: 'By category' }]} />}>
          <Chart option={waterfall} loading={loading} height={304} chartKey={by}
            label={m ? `Waterfall from budget ${usd(m.total.b)} to actual ${usd(m.total.a)}, a variance of ${signedUsd(m.total.a - m.total.b)}, by ${by}.` : 'Variance waterfall'} />
        </Card>
        <Card className="col-span-12 xl:col-span-5" title="Actual, budget and forecast" subtitle={<span className="inline-flex flex-wrap items-center gap-x-2"><span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[3px] w-[14px] rounded-full" style={{ background: t.accent }} />Actual</span><span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[0px] w-[14px] border-t-2 border-dashed" style={{ borderColor: t.cats[7] }} />Budget</span><span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[0px] w-[14px] border-t-2 border-dotted" style={{ borderColor: t.cats[1] }} />Forecast</span></span>}>
          <Chart option={lines} loading={loading} height={328} label={`Monthly net sales actual versus budget and forecast, ${periodLabel(meta, f)}.`} />
        </Card>

        <Card className="col-span-12 xl:col-span-7" title="Where are we missing? Variance by region and category" subtitle="Actual vs budget net sales. Cells show the signed % variance; tint strength shows size">
          <Chart option={heat} loading={loading} height={248} label="Heatmap of net sales variance versus budget, by region and category." />
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted">
            <span className="inline-block h-[10px] w-[10px] rounded-[3px]" style={{ background: mix(t.bad, t.surface, 0.45) }} /> below budget (▼)
            <span className="inline-block h-[10px] w-[10px] rounded-[3px] border border-line" style={{ background: t.surface }} /> on budget
            <span className="inline-block h-[10px] w-[10px] rounded-[3px]" style={{ background: mix(t.good, t.surface, 0.45) }} /> above budget (▲)
            <span className="ml-auto">Scale ±10%</span>
          </div>
        </Card>
        <Card className="col-span-12 xl:col-span-5" title="Reading the variance" subtitle="What the budget and forecast represent">
          <ul className="m-0 pl-2.5 text-[13px] text-fg-2 leading-[20px] flex flex-col gap-1 list-disc marker:text-muted">
            <li><b className="text-fg font-medium">Budget</b> is set once a year, by month, region, channel and category, and is slightly optimistic by design.</li>
            <li><b className="text-fg font-medium">Forecast</b> is refreshed each quarter: the budget scaled by 80% of the prior quarter’s attainment, so it trails sudden shifts by a quarter.</li>
            <li>A small structural miss (about 1–3%) is normal here. Look for variances far outside that band, then ask whether they sit in a region, a category, or both.</li>
            <li>Margins here are <i>before returns</i>; the Overview and Products pages show them after returns.</li>
          </ul>
        </Card>

        <Card className="col-span-12" title="Drill-down" subtitle="Expand a row to see its contributors. Click a column header to sort."
          actions={<div className="flex items-center gap-1">
            <Segmented size="sm" label="Hierarchy" value={hier} onChange={(v) => { setHier(v); setOpen(new Set()) }} options={[{ value: 'region', label: 'Region → category' }, { value: 'category', label: 'Category → region' }]} />
            <button onClick={() => setOpen(allOpen ? new Set() : new Set(parentNames.map((_, i) => `p${i}`)))}
              className="t-fast h-[24px] rounded-md px-1.5 text-[12px] font-medium text-fg-2 bg-surface-2 hover:text-fg">{allOpen ? 'Collapse all' : 'Expand all'}</button>
          </div>}>
          {loading ? <TableSkeleton rows={8} /> : (
            <DataTable caption="Actual versus budget and forecast with drill-down" columns={cols} rows={rows} rowKey={(r) => r.id} sort={sort} onSort={onSort} maxHeight={460}
              rowClass={(r) => (r.id === 'total' ? 'bg-surface-2/60 font-semibold' : r.depth ? 'bg-[color-mix(in_srgb,var(--surface-2)_35%,transparent)]' : '')}
              onRowClick={(r) => r.hasKids && toggle(r.id)} />
          )}
        </Card>
      </div>
    </>
  )
}
