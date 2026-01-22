import * as React from 'react'
import { cn } from '@/lib/utils'
import { ProcessingStatus } from '@/components/domain/processing-status'

export interface PageHeaderProps {
  /** Page title */
  title: string
  /** Optional description below the title */
  description?: string
  /** Actions slot (buttons, selectors, etc.) - aligned to the right */
  actions?: React.ReactNode
  /** Additional class name for the container */
  className?: string
}

/**
 * PageHeader - Consistent page header component
 *
 * Design spec:
 * - Title: text-2xl font-semibold tracking-tight
 * - Description: text-sm text-muted-foreground
 * - Actions: right-aligned flex container
 * - Responsive: stacks on mobile, row on larger screens
 * - Bottom margin: mb-6 or mb-8
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8 animate-fade-in',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ProcessingStatus />
        {actions}
      </div>
    </div>
  )
}
