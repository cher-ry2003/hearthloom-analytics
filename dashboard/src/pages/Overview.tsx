import { useMemo, useState } from 'react'
import { Card, PageHeader, Segmented } from '../components/Card'
import { Chart } from '../components/Chart'
import { Delta } from '../components/Delta'
import { KpiCard } from '../components/KpiCard'
import { KpiSkeleton, Skeleton } from '../components/Skeleton'
import { change, ordersMonthly, pnlGroup, pnlMonthly, productAgg, sumPnl } from '../lib/aggregate'
import { catAxis, grid, MONO, roundRight, roundTop, tooltip, valAxis } from '../lib/chartKit'
import { useTable, useTables } from '../lib/data'
import { periodLabel, useFilters } from '../lib/filters'
import { monthLong, monthShort, pct, signedPct, signedPp, signedUsd, usd } from '../lib/format'
import { useTheme } from '../lib/theme'
import { tipHtml } from '../lib/tip'

export default function Overview() {
  const { meta, f, prior, yoy } = useFilters()
  const { tokens: t } = useTheme()
  const core = useTables(['pnl', 'orders'] as const)
  const products = useTable('product_monthly')
  const [mixBy, setMixBy] = useState<'region' | 'channel' | 'category'>('region')

  const sel = useMemo(() => ({ region: f.region, channel: f.channel }), [f.region, f.channel])
  const model = useMemo(() => {
    if (!core.data) return null
    const { pnl, orders } = core.data
    const months = pnlMonthly(pnl, f, sel)
    const cur = sumPnl(months)
    const pri = prior ? sumPnl(pnlMonthly(pnl, prior, sel)) : null
    const ord = ordersMonthly(orders, f, sel)
    const ordSum = ord.reduce((a, b) => a + b, 0)
    const ordPri = prior ? ordersMonthly(orders, prior, sel).reduce((a, b) => a + b, 0) : null
    // sparklines always cover the trailing 12 months ending at the selected end month
    const sr = { from: Math.max(0, f.to - 11), to: f.to }
    const sm = pnlMonthly(pnl, sr, sel)
    const so = ordersMonthly(orders, sr, sel)
    const yoyMonths = yoy ? pnlMonthly(pnl, yoy, sel) : null
    return { months, cur, pri, ordSum, ordPri, sm, so, yoyMonths, ord }
  }, [core.data, f, prior, yoy, sel])

  const labels = useMemo(() => meta.months.slice(f.from, f.to + 1).map(monthShort), [meta, f.from, f.to])
  const loading = !model
  const aov = model ? model.cur.net_sales / (model.ordSum || 1) : 0
  const aovPri = model && model.pri && model.ordPri ? model.pri.net_sales / model.ordPri : null
  const scope = [f.region == null ? 'all regions' : meta.dicts.region[f.region], f.channel == null ? 'all channels' : meta.dicts.channel[f.channel]].join(' · ')

  // ----- revenue & margin trend -----
  const trend = useMemo(() => {
    if (!model) return {}
    const total = model.cur.net_revenue
    const rev = model.months.map((m) => Math.round(m.net_revenue))
    const gm = model.months.map((m) => +(m.gm * 100).toFixed(2))
    return {
      grid: grid({ top: 28, right: 8 }),
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex
        const m = model.months[i]
        const prev = i > 0 ? model.months[i - 1] : null
        return tipHtml(monthLong(meta.months[f.from + i]), [
          { color: t.accent, name: 'Net revenue', value: usd(m.net_revenue, 2), share: total ? m.net_revenue / total : null, delta: prev ? change(m.net_revenue, prev.net_revenue) : null },
          { color: t.cats[1], name: 'Gross margin', value: pct(m.gm), delta: prev ? m.gm - prev.gm : null },
        ], 'Changes are vs the previous month')
      }, 'axis', t),
      xAxis: catAxis(labels, t),
      yAxis: [
        valAxis(t, (v) => usd(v, 0), { max: (v: any) => v.max * 1.5 }),
        valAxis(t, (v) => `${v}%`, { position: 'right', splitLine: { show: false },
          interval: 5,
          min: (v: any) => Math.floor((v.min - 2.4 * Math.max(v.max - v.min, 2)) / 5) * 5, max: (v: any) => Math.ceil((v.max + 0.4 * Math.max(v.max - v.min, 2)) / 5) * 5 }),
      ],
      series: [
        { name: 'Net revenue', type: 'bar', data: rev, barMaxWidth: 26, itemStyle: { color: t.accent, borderRadius: [4, 4, 0, 0] }, emphasis: { itemStyle: { opacity: 0.85 } } },
        { name: 'Gross margin', type: 'line', yAxisIndex: 1, data: gm, smooth: 0.3, symbol: 'circle', symbolSize: 5, showSymbol: model.months.length < 20,
          lineStyle: { width: 2, color: t.cats[1] }, itemStyle: { color: t.cats[1], borderColor: t.surface, borderWidth: 1.5 } },
      ],
      graphic: [],
    }
  }, [model, labels, t, meta, f.from])

  // ----- mix -----
  const mix = useMemo(() => {
    if (!core.data) return { names: [] as string[], option: {}, label: '' }
    const dictName = mixBy
    const names = meta.dicts[dictName].filter((_, i) => dictName !== 'region' || i < 4)
    const s2 = { ...sel, region: dictName === 'region' ? null : sel.region, channel: dictName === 'channel' ? null : sel.channel }
    const cur = pnlGroup(core.data.pnl, f, s2, dictName, names.length)
    const pri = prior ? pnlGroup(core.data.pnl, prior, s2, dictName, names.length) : null
    const total = cur.reduce((a, r) => a + r.net_revenue, 0)
    const order = names.map((n, i) => i).sort((a, b) => cur[a].net_revenue - cur[b].net_revenue)
    const label = `Net revenue by ${dictName}: ` + order.slice().reverse().map((i) => `${names[i]} ${usd(cur[i].net_revenue)} (${pct(total ? cur[i].net_revenue / total : 0, 0)})`).join('; ')
    return {
      names, label,
      option: {
        grid: grid({ left: 4, right: 96, top: 4, bottom: 4 }),
        tooltip: tooltip((p: any) => {
          const i = order[p.dataIndex]
          return tipHtml(names[i], [{ color: p.color, name: 'Net revenue', value: usd(cur[i].net_revenue, 2), share: total ? cur[i].net_revenue / total : null,
            delta: pri ? change(cur[i].net_revenue, pri[i].net_revenue) : null }, { name: 'Gross margin', value: pct(cur[i].gm) }])
        }, 'item', t),
        xAxis: { type: 'value', show: false, max: (v: any) => v.max * 1.02 },
        yAxis: { type: 'category', data: order.map((i) => names[i]), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.fg2, fontSize: 12, margin: 12 } },
        series: [{
          type: 'bar', barWidth: 16, data: order.map((i) => ({ value: Math.round(cur[i].net_revenue), itemStyle: { color: dictName === 'category' ? t.cats[i % 8] : dictName === 'channel' ? t.cats[i === 0 ? 0 : 3] : t.cats[i], borderRadius: [0, 5, 5, 0] } })),
          label: { show: true, position: 'right', color: t.fg, fontFamily: MONO, fontSize: 11,
            formatter: (p: any) => `${usd(p.value)}  ${pct(total ? cur[order[p.dataIndex]].net_revenue / total : 0, 0)}` },
          showBackground: true, backgroundStyle: { color: t.lineSoft, borderRadius: [0, 5, 5, 0] },
        }],
      },
    }
  }, [core.data, mixBy, f, prior, sel, meta, t])

  // ----- YoY -----
  const yoyOpt = useMemo(() => {
    if (!model || !model.yoyMonths) return null
    const cur = model.months.map((m) => Math.round(m.net_revenue))
    const old = model.yoyMonths.map((m) => Math.round(m.net_revenue))
    const g = cur.map((v, i) => (old[i] ? v / old[i] - 1 : 0))
    return {
      grid: [grid({ top: 12, height: '54%', right: 72 }), grid({ top: '72%', height: '17%', right: 72 })],
      tooltip: tooltip((ps: any[]) => {
        const i = ps[0].dataIndex
        return tipHtml(monthLong(meta.months[f.from + i]), [
          { color: t.accent, name: 'This period', value: usd(cur[i], 2), delta: g[i] },
          { color: t.cats[7], name: 'Same month, prior year', value: usd(old[i], 2) },
        ], 'Change is year over year')
      }, 'axis', t),
      xAxis: [catAxis(labels, t, { gridIndex: 0, axisLabel: { show: false }, axisLine: { show: false } }), catAxis(labels, t, { gridIndex: 1, axisLine: { show: false } })],
      yAxis: [valAxis(t, (v) => usd(v, 1), { gridIndex: 0, scale: true, splitNumber: 4 }), valAxis(t, (v) => `${Math.round(v * 100)}%`, { gridIndex: 1, splitNumber: 1, min: (v: any) => Math.min(-0.05, v.min), max: (v: any) => Math.max(0.05, v.max) })],
      series: [
        { name: 'This period', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: cur, smooth: 0.25, symbol: 'none', lineStyle: { width: 2.4, color: t.accent },
          endLabel: { show: true, formatter: 'This period', color: t.accent, fontSize: 11, fontWeight: 600, distance: 6 } },
        { name: 'Prior year', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: old, smooth: 0.25, symbol: 'none', lineStyle: { width: 1.8, color: t.cats[7], type: [5, 4] },
          endLabel: { show: true, formatter: 'Prior year', color: t.muted, fontSize: 11, distance: 6 } },
        { name: 'YoY %', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 18,
          data: g.map((v) => ({ value: +v.toFixed(4), itemStyle: { color: v >= 0 ? t.good : t.bad, borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3], opacity: 0.85 } })) },
      ],
    }
  }, [model, labels, t, meta, f.from])

  // ----- movers -----
  const movers = useMemo(() => {
    if (!products.data || !prior) return null
    const n = meta.products.length
    const cur = productAgg(products.data, f, sel, n)
    const pri = productAgg(products.data, prior, sel, n)
    const rows = meta.products.map((p, i) => ({ p, d: cur[i].net_sales - pri[i].net_sales, cur: cur[i].net_sales, pri: pri[i].net_sales }))
      .filter((r) => r.cur > 0 || r.pri > 0)
    rows.sort((a, b) => b.d - a.d)
    const up = rows.slice(0, 5)
    const down = rows.slice(-5).reverse()
    const max = Math.max(...up.map((r) => Math.abs(r.d)), ...down.map((r) => Math.abs(r.d)), 1)
    return { up, down, max }
  }, [products.data, prior, f, sel, meta])

  const spark = (fn: (i: number) => number) => (model ? model.sm.map((_, i) => fn(i)) : undefined)

  return (
    <>
      <PageHeader title="Executive overview" lede={<>How Hearthloom is trading across <span className="text-fg-2">{scope}</span>. Everything on this page responds to the filters above.</>} />

      {/* Hero */}
      <Card className="mb-3" bodyClass="!p-0">
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-12 lg:col-span-7 p-3 flex flex-col justify-center">
            <div className="text-[12px] font-medium text-muted uppercase tracking-[0.06em]">Net revenue · {periodLabel(meta, f)}</div>
            {loading ? <Skeleton className="h-8 w-64 mt-1" /> : (
              <div className="flex items-end gap-2 flex-wrap mt-0.5">
                <span className="serif text-[72px] leading-[72px] text-fg">{usd(model!.cur.net_revenue)}</span>
                <span className="pb-1"><Delta value={model!.pri ? change(model!.cur.net_revenue, model!.pri.net_revenue) : null} /></span>
              </div>
            )}
            <p className="text-[13px] text-muted mt-1 mb-0 max-w-[520px]">
              {loading ? '' : model!.pri
                ? <>Up from <span className="num text-fg-2">{usd(model!.pri.net_revenue)}</span> in the {f.to - f.from + 1}-month period before. Net revenue is net sales after discounts and refunds.</>
                : 'No earlier period of equal length exists in the data, so there is no comparison. Net revenue is net sales after discounts and refunds.'}
            </p>
          </div>
          <div className="col-span-12 lg:col-span-5 grid grid-cols-3 border-t lg:border-t-0 lg:border-l border-line-soft">
            {[
              { l: 'Marketing spend', v: model ? usd(model.cur.marketing) : '', d: model?.pri ? change(model.cur.marketing, model.pri.marketing) : null, gw: 'neutral' as const },
              { l: 'Contribution', v: model ? usd(model.cur.contribution) : '', d: model?.pri ? change(model.cur.contribution, model.pri.contribution) : null },
              { l: 'Contribution margin', v: model ? pct(model.cur.net_revenue ? model.cur.contribution / model.cur.net_revenue : 0) : '', d: model?.pri ? (model.cur.contribution / model.cur.net_revenue) - (model.pri.contribution / model.pri.net_revenue) : null, unit: 'pp' as const },
            ].map((x, i) => (
              <div key={x.l} className={`p-2.5 flex flex-col justify-center gap-0.5 ${i ? 'border-l border-line-soft' : ''}`}>
                <span className="text-[12px] text-muted">{x.l}</span>
                {loading ? <Skeleton className="h-3 w-16" /> : <span className="num text-[20px] font-medium">{x.v}</span>}
                {!loading && <Delta value={x.d} goodWhen={x.gw ?? 'up'} unit={x.unit ?? 'pct'} compact />}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
        {loading ? Array.from({ length: 6 }, (_, i) => <KpiSkeleton key={i} />) : (
          <>
            <KpiCard label="Net revenue" value={usd(model!.cur.net_revenue)} delta={model!.pri ? change(model!.cur.net_revenue, model!.pri.net_revenue) : null}
              spark={spark((i) => model!.sm[i].net_revenue)} />
            <KpiCard label="Gross profit" value={usd(model!.cur.gross_profit)} delta={model!.pri ? change(model!.cur.gross_profit, model!.pri.gross_profit) : null}
              spark={spark((i) => model!.sm[i].gross_profit)} />
            <KpiCard label="Gross margin" value={pct(model!.cur.gm)} unit="pp" delta={model!.pri ? model!.cur.gm - model!.pri.gm : null}
              spark={spark((i) => model!.sm[i].gm)} hint="Gross profit ÷ net revenue, after refunds and restocked-return COGS recovery" />
            <KpiCard label="Orders" value={(model!.ordSum / 1000).toFixed(1) + 'K'} delta={change(model!.ordSum, model!.ordPri)}
              spark={spark((i) => model!.so[i])} />
            <KpiCard label="Avg order value" value={'$' + aov.toFixed(0)} delta={aovPri ? change(aov, aovPri) : null}
              spark={spark((i) => model!.sm[i].net_sales / (model!.so[i] || 1))} />
            <KpiCard label="Return rate" value={pct(model!.cur.return_rate)} unit="pp" goodWhen="down" delta={model!.pri ? model!.cur.return_rate - model!.pri.return_rate : null}
              spark={spark((i) => model!.sm[i].return_rate)} hint="Units returned ÷ units sold, attributed to the month of the original sale" />
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-12 xl:col-span-8" title="Net revenue and gross margin" subtitle={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0"><span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[8px] w-[8px] rounded-[2px]" style={{ background: t.accent }} />Net revenue (bars)</span><span className="inline-flex items-center gap-[6px]"><i className="inline-block h-[3px] w-[12px] rounded-full" style={{ background: t.cats[1] }} />Gross margin % (line, right axis)</span></span>}>
          <Chart option={trend} loading={loading} height={304} label={`Monthly net revenue and gross margin, ${periodLabel(meta, f)}. Total ${model ? usd(model.cur.net_revenue) : ''} at ${model ? pct(model.cur.gm) : ''} gross margin.`} />
        </Card>
        <Card className="col-span-12 xl:col-span-4" title="Revenue mix" subtitle={`Net revenue by ${mixBy}`}
          actions={<Segmented size="sm" label="Breakdown" value={mixBy} onChange={setMixBy} options={[{ value: 'region', label: 'Region' }, { value: 'channel', label: 'Channel' }, { value: 'category', label: 'Category' }]} />}>
          <Chart option={mix.option} loading={loading} height={mixBy === 'category' ? 304 : 304} chartKey={mixBy} label={mix.label} />
        </Card>

        <Card className="col-span-12 xl:col-span-7" title="Year-over-year comparison" subtitle="Selected months vs the same months a year earlier, with YoY growth below">
          {yoyOpt ? (
            <Chart option={yoyOpt} height={372} label={`Year over year net revenue comparison. This period ${usd(model!.cur.net_revenue)} versus ${usd(sumPnl(model!.yoyMonths!).net_revenue)} a year earlier.`} />
          ) : (
            <div className="h-[372px] grid place-items-center text-center text-muted text-[13px] px-4">
              {loading ? <Skeleton className="h-full w-full" /> : <span>The data starts in {monthLong(meta.first_month)}, so a year-earlier comparison isn’t available for this range. Choose a start month 12 or more months in.</span>}
            </div>
          )}
        </Card>

        <Card className="col-span-12 xl:col-span-5" title="Top movers" subtitle={prior ? `Biggest product changes in net sales vs the prior ${f.to - f.from + 1} months` : 'Needs an equal-length prior period'}>
          {!prior ? <div className="h-[304px] grid place-items-center text-muted text-[13px] text-center px-3">No prior period available for this range.</div> :
            !movers ? <div className="flex flex-col gap-1.5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-3" />)}</div> : (
              <div className="flex flex-col gap-1.5">
                {[{ title: 'Gaining', rows: movers.up }, { title: 'Slipping', rows: movers.down }].map((g) => (
                  <div key={g.title}>
                    <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted mb-0.5">{g.title}</div>
                    {g.rows.map((r) => {
                      const up = r.d >= 0
                      return (
                        <div key={r.p.id} className="grid grid-cols-[1fr_auto] items-center gap-1 h-[30px] t-fast hover:bg-surface-2 rounded-md px-0.5 -mx-0.5" title={`${r.p.name} · ${r.p.category} · ${r.p.supplier}`}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[13px] text-fg truncate">{r.p.name}</span>
                              <span className="text-[11px] text-muted truncate hidden sm:inline">{r.p.category}</span>
                            </div>
                            <div className="h-[4px] rounded-full bg-line-soft mt-[3px] overflow-hidden">
                              <div className="h-full rounded-full t-fast" style={{ width: `${Math.max(3, (Math.abs(r.d) / movers.max) * 100)}%`, background: up ? t.good : t.bad, opacity: 0.75 }} />
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-1">
                            <span className="num text-[13px] font-medium w-[64px]">{signedUsd(r.d)}</span>
                            <span className="num text-[11px] text-muted w-[52px]">{r.pri > 0 ? signedPct(r.d / r.pri, 0) : 'new'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>
    </>
  )
}
