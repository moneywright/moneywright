import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="skeleton" className={cn('animate-shimmer rounded-md', className)} {...props} />
  )
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl p-5 bg-card border border-border-subtle">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  )
}

function StatCardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-20' : i === 1 ? 'flex-1' : 'w-24')} />
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card overflow-hidden">
      <div className="bg-surface-elevated px-4 py-3 border-b border-border-subtle">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn('h-3', i === 0 ? 'w-16' : i === 1 ? 'flex-1' : 'w-20')}
            />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  )
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl p-5 bg-card border border-border-subtle', className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border-subtle space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      {/* Stats skeleton */}
      <StatCardGridSkeleton />
      {/* Content skeleton */}
      <TableSkeleton />
    </div>
  )
}

export {
  Skeleton,
  StatCardSkeleton,
  StatCardGridSkeleton,
  ListItemSkeleton,
  TableRowSkeleton,
  TableSkeleton,
  CardSkeleton,
  PageSkeleton,
}
