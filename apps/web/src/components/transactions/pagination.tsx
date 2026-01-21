import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Showing{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {(page - 1) * limit + 1}
        </span>{' '}
        to{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {Math.min(page * limit, total)}
        </span>{' '}
        of{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {total.toLocaleString()}
        </span>{' '}
        transactions
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="h-8"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <div className="px-3 py-1 text-sm text-zinc-600 dark:text-zinc-400">
          Page <span className="font-medium text-zinc-800 dark:text-zinc-200">{page}</span> of{' '}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {Math.max(totalPages, 1)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-8"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
