import { signedPct, signedPp } from '../lib/format'

/** Period-over-period delta. Direction is shown with an arrow AND a sign, not by colour alone. */
export function Delta({ value, goodWhen = 'up', unit = 'pct', compact = false, label }: {
  value: number | null | undefined; goodWhen?: 'up' | 'down' | 'neutral'; unit?: 'pct' | 'pp'; compact?: boolean; label?: string
}) {
  if (value == null || !isFinite(value)) return <span className="num text-[12px] text-muted">n/a</span>
  const flat = Math.abs(value) < (unit === 'pp' ? 0.0005 : 0.0005)
  const up = value > 0
  const good = goodWhen === 'neutral' ? null : goodWhen === 'up' ? up : !up
  const tone = flat || good == null ? 'text-muted bg-surface-2' : good ? 'text-good bg-good-soft' : 'text-bad bg-bad-soft'
  const text = unit === 'pp' ? signedPp(value) : signedPct(value)
  return (
    <span className={`num inline-flex items-center whitespace-nowrap gap-[4px] rounded-md ${compact ? 'px-[6px] py-0 text-[11px]' : 'px-[8px] py-[2px] text-[12px]'} font-medium ${tone}`}
      title={label}>
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
        {flat ? <path d="M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> :
          up ? <path d="M5 1.5 9 8H1z" fill="currentColor" /> : <path d="M5 8.5 1 2h8z" fill="currentColor" />}
      </svg>
      {text}
      <span className="sr-only">{flat ? 'unchanged' : up ? 'increase' : 'decrease'}{good == null ? '' : good ? ', favourable' : ', unfavourable'}</span>
    </span>
  )
}
