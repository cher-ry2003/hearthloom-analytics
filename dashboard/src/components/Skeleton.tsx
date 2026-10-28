export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-2" style={{ height }} role="status" aria-label="Loading chart">
      <div className="flex items-end gap-1.5 flex-1 pt-2">
        {Array.from({ length: 24 }, (_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${28 + ((i * 37) % 55)}%`, borderRadius: 4 }} />
        ))}
      </div>
      <Skeleton className="h-2 w-full" />
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 flex flex-col gap-1.5">
      <Skeleton className="h-1.5 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-2 w-16" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-label="Loading table">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-3" />)}
    </div>
  )
}
