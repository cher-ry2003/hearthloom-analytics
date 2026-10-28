import type { SVGProps } from 'react'

const P: Record<string, string> = {
  overview: 'M3 13h4v8H3zM10 3h4v18h-4zM17 9h4v12h-4z',
  budget: 'M4 19V9m5 10V5m5 14v-8m5 8V7M3 19h18',
  marketing: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6m2.5-9a8 8 0 0 1 0 12',
  products: 'M21 8 12 3 3 8v8l9 5 9-5V8zM3 8l9 5m0 0 9-5m-9 5v8',
  inventory: 'M12 3 3 7.5 12 12l9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  sun: 'M12 4V2m0 20v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13',
  github: 'M9 19c-4 1.2-4-2-6-2.5m12 4.5v-3.1a2.7 2.7 0 0 0-.8-2.1c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.3 3.3 5.3 3.6 5.3 3.6a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.9 10c0 4.6 2.8 5.7 5.5 6a2.7 2.7 0 0 0-.8 2.1V21',
  chevron: 'm6 9 6 6 6-6',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  sortUp: 'm7 14 5-5 5 5',
  sortDown: 'm7 10 5 5 5-5',
  caret: 'm9 6 6 6-6 6',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5',
}

export function Icon({ name, size = 16, ...rest }: { name: keyof typeof P | string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  )
}
