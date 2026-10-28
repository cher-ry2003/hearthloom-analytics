import ReactEChartsCoreModule from 'echarts-for-react/lib/core'
import { useMemo } from 'react'
import { echarts } from '../lib/echarts'
import { useTheme } from '../lib/theme'
import { ChartSkeleton } from './Skeleton'

type Opt = Record<string, unknown>
// echarts-for-react ships CommonJS; unwrap the default export when the bundler hands back the module object.
const ReactEChartsCore: typeof ReactEChartsCoreModule = (ReactEChartsCoreModule as any).default ?? ReactEChartsCoreModule

export function Chart({ option, height = 280, label, loading = false, chartKey }: {
  option: Opt; height?: number; label: string; loading?: boolean; chartKey?: string
}) {
  const { tokens } = useTheme()
  const merged = useMemo(() => ({
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 350,
    animationEasingUpdate: 'cubicInOut',
    textStyle: { fontFamily: '"Geist Variable", system-ui, sans-serif', color: tokens.muted, fontSize: 11 },
    ...option,
  }), [option, tokens])
  if (loading) return <ChartSkeleton height={height} />
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ReactEChartsCore key={chartKey} echarts={echarts} option={merged} style={{ height }} opts={{ renderer: 'svg' }} notMerge={false} lazyUpdate />
    </div>
  )
}
