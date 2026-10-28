import type { Tokens } from './tokens'

export const MONO = '"Geist Mono Variable", ui-monospace, monospace'
export const SANS = '"Geist Variable", system-ui, sans-serif'

export const grid = (o: Record<string, unknown> = {}) => ({ left: 4, right: 12, top: 16, bottom: 4, containLabel: true, ...o })

export const catAxis = (data: string[], t: Tokens, o: Record<string, unknown> = {}) => ({
  type: 'category', data,
  axisLine: { lineStyle: { color: t.line } },
  axisTick: { show: false },
  axisLabel: { color: t.muted, fontSize: 11, fontFamily: MONO, margin: 10, hideOverlap: true },
  ...o,
})

export const valAxis = (t: Tokens, fmt: (v: number) => string, o: Record<string, unknown> = {}) => ({
  type: 'value',
  splitLine: { lineStyle: { color: t.lineSoft, width: 1 } },
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: t.muted, fontSize: 11, fontFamily: MONO, formatter: fmt, margin: 8 },
  ...o,
})

export const tooltip = (formatter: (p: any) => string, trigger: 'axis' | 'item' = 'axis', t?: Tokens) => ({
  trigger, confine: true, backgroundColor: 'transparent', borderWidth: 0, padding: 0,
  extraCssText: 'box-shadow:none;', transitionDuration: 0.12, formatter,
  axisPointer: { type: 'line', lineStyle: { color: t?.muted ?? '#888', width: 1, type: 'dashed' }, z: 0 },
})

/** Rounded top bars. */
export const roundTop = (r = 4) => ({ borderRadius: [r, r, 0, 0] })
export const roundRight = (r = 4) => ({ borderRadius: [0, r, r, 0] })

/** Pick black or white text for >= 4.5:1 contrast on a #rrggbb fill. */
export function textOn(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return (L + 0.05) / 0.0125 >= 4.5 ? '#111110' : '#ffffff'
}

/** Linear mix of two #rrggbb colours (t = 0 -> a, t = 1 -> b). */
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b)
  const h = (x: number) => Math.round(x).toString(16).padStart(2, '0')
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`
}
