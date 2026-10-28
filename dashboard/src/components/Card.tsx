import type { ReactNode } from 'react'

export function Card({ title, subtitle, actions, children, className = '', bodyClass = '', id }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string
}) {
  return (
    <section id={id} className={`rounded-xl border border-line bg-surface shadow-[var(--shadow-1)] min-w-0 fade-up ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-2 px-3 pt-2.5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[14px] font-semibold leading-[20px] text-fg m-0">{title}</h2>}
            {subtitle && <p className="text-[12px] text-muted leading-[16px] mt-0.5 mb-0">{subtitle}</p>}
          </div>
          {actions && <div className="flex-none">{actions}</div>}
        </header>
      )}
      <div className={`px-3 pb-3 ${title || actions ? 'pt-2' : 'pt-3'} ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, label, size = 'md' }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-surface-2 p-[2px] gap-[2px]">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={String(o.value)} role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`t-fast rounded-md ${size === 'sm' ? 'px-1.5 h-[24px] text-[12px]' : 'px-1.5 h-[28px] text-[13px]'} font-medium whitespace-nowrap
              ${on ? 'bg-surface text-fg shadow-[var(--shadow-1)]' : 'text-muted hover:text-fg'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function PageHeader({ title, lede, right }: { title: string; lede: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
      <div className="min-w-0 max-w-[720px]">
        <h1 className="serif text-[40px] leading-[44px] m-0 text-fg">{title}</h1>
        <p className="text-[14px] text-muted mt-1 mb-0 leading-[20px]">{lede}</p>
      </div>
      {right}
    </div>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-muted leading-[16px] m-0">{children}</p>
}
