import type { ReactNode } from 'react'
import { Icon } from './Icon'

export interface Col<R> {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  width?: number | string
  render: (row: R) => ReactNode
  sortable?: boolean
  numeric?: boolean
  sticky?: boolean
  title?: string
}

export interface SortState { key: string; dir: 'asc' | 'desc' }

export function DataTable<R>({ columns, rows, rowKey, sort, onSort, maxHeight = 420, rowClass, onRowClick, caption, empty = 'No data for the current filters.' }: {
  columns: Col<R>[]; rows: R[]; rowKey: (r: R) => string; sort?: SortState; onSort?: (key: string) => void
  maxHeight?: number | string; rowClass?: (r: R) => string; onRowClick?: (r: R) => void; caption: string; empty?: string
}) {
  return (
    <div className="overflow-auto rounded-lg border border-line-soft" style={{ maxHeight }} tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c, ci) => {
              const active = sort?.key === c.key
              const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined
              return (
                <th key={c.key} scope="col" aria-sort={ariaSort as 'ascending' | 'descending' | 'none' | undefined}
                  title={c.title}
                  style={{ width: c.width, minWidth: c.width }}
                  className={`sticky top-0 z-10 bg-surface-2 border-b border-line text-[12px] font-medium text-muted px-2 py-0 h-[36px] whitespace-nowrap
                    ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'} ${ci === 0 ? 'left-0 z-20' : ''}`}>
                  {c.sortable && onSort ? (
                    <button onClick={() => onSort(c.key)}
                      className={`t-fast inline-flex items-center gap-[4px] rounded-md hover:text-fg ${active ? 'text-fg' : ''} ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      <span>{c.header}</span>
                      <span className={`inline-flex flex-col -space-y-1 ${active ? 'opacity-100' : 'opacity-0'}`}>
                        <Icon name={active && sort!.dir === 'asc' ? 'sortUp' : 'sortDown'} size={12} />
                      </span>
                    </button>
                  ) : c.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="text-center text-muted py-4">{empty}</td></tr>
          )}
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`group t-fast hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] ${onRowClick ? 'cursor-pointer' : ''} ${rowClass?.(r) ?? ''}`}>
              {columns.map((c, ci) => (
                <td key={c.key}
                  className={`border-b border-line-soft px-2 h-[40px] whitespace-nowrap ${c.numeric ? 'num' : ''}
                    ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}
                    ${ci === 0 ? 'sticky left-0 bg-surface group-hover:bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] t-fast' : ''}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Variance cell with conditional formatting: tint + sign + arrow, never colour alone. */
export function VarianceCell({ value, text, goodWhen = 'up', scale = 0.1 }: { value: number; text: string; goodWhen?: 'up' | 'down'; scale?: number }) {
  const flat = Math.abs(value) < scale * 0.02
  const good = goodWhen === 'up' ? value > 0 : value < 0
  const strength = Math.min(1, Math.abs(value) / scale)
  const bg = flat ? 'transparent' : `color-mix(in srgb, var(${good ? '--good' : '--bad'}) ${Math.round(8 + strength * 22)}%, transparent)`
  const fg = flat ? 'var(--muted)' : `var(${good ? '--good' : '--bad'})`
  return (
    <span className="inline-flex items-center justify-end gap-[4px] rounded-md px-[8px] py-[2px] font-medium" style={{ background: bg, color: fg }}>
      <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
        {flat ? <path d="M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : value > 0 ? <path d="M5 1.5 9 8H1z" fill="currentColor" /> : <path d="M5 8.5 1 2h8z" fill="currentColor" />}
      </svg>
      {text}
    </span>
  )
}
