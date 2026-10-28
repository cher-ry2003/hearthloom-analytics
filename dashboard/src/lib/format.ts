const compact = (n: number, digits = 1) => {
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(digits) + 'B'
  if (a >= 1e6) return (n / 1e6).toFixed(digits) + 'M'
  if (a >= 1e4) return (n / 1e3).toFixed(0) + 'K'
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Math.round(n).toString()
}

export const compactNum = (n: number, digits = 2) => compact(n, digits)
export const usd = (n: number, digits = 1) => (n < 0 ? '−$' : '$') + compact(Math.abs(n), digits)
export const usdFull = (n: number) => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US')
export const usd2 = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const int = (n: number) => Math.round(n).toLocaleString('en-US')
export const num = (n: number, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const pct = (x: number, d = 1) => (x * 100).toFixed(d) + '%'
export const signedPct = (x: number, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(d) + '%'
export const signedUsd = (n: number, digits = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + '$' + compact(Math.abs(n), digits)
export const signedPp = (x: number, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(d) + ' pp'
export const times = (n: number, d = 1) => n.toFixed(d) + '×'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** '2024-03-01' -> 'Mar 24' */
export const monthShort = (iso: string) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(2, 4)}`
/** '2024-03-01' -> 'Mar 2024' */
export const monthLong = (iso: string) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`
export const monthName = (iso: string) => MONTHS[+iso.slice(5, 7) - 1]
export const safeDiv = (a: number, b: number) => (b ? a / b : 0)
