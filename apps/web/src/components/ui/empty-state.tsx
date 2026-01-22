import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type LinkProps = React.ComponentProps<typeof Link>

export interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon
  /** Main title */
  title: string
  /** Description text */
  description: string
  /** Primary action button */
  action?: {
    label: string
    onClick?: () => void
    href?: string
    linkOptions?: Omit<LinkProps, 'children'>
    icon?: LucideIcon
  }
  /** Secondary action button */
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
    linkOptions?: Omit<LinkProps, 'children'>
    icon?: LucideIcon
  }
  /** Size variant */
  size?: 'sm' | 'default' | 'lg'
  /** Additional class name */
  className?: string
}

/**
 * Shared EmptyState component for consistent empty states across the app
 *
 * Design spec:
 * - Centered layout with icon, title, description, and optional actions
 * - Icon in a circular container with elevated surface background
 * - Dashed border container
 * - Consistent padding and spacing
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  className,
}: EmptyStateProps) {
  const sizeClasses = {
    sm: 'py-8',
    default: 'py-12',
    lg: 'py-16',
  }

  const iconSizeClasses = {
    sm: 'h-12 w-12',
    default: 'h-14 w-14',
    lg: 'h-16 w-16',
  }

  const iconInnerClasses = {
    sm: 'h-6 w-6',
    default: 'h-7 w-7',
    lg: 'h-8 w-8',
  }

  return (
    <div
      className={cn(
        'rounded-xl text-center bg-card border border-dashed border-border-subtle',
        sizeClasses[size],
        className
      )}
    >
      <div
        className={cn(
          'mx-auto rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center mb-4',
          iconSizeClasses[size]
        )}
      >
        <Icon className={cn('text-muted-foreground', iconInnerClasses[size])} />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto px-4">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action &&
            (action.href || action.linkOptions ? (
              <Button asChild>
                <Link to={action.href || action.linkOptions?.to} {...action.linkOptions}>
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button onClick={action.onClick}>
                {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
            ))}
          {secondaryAction &&
            (secondaryAction.href || secondaryAction.linkOptions ? (
              <Button variant="outline" asChild>
                <Link
                  to={secondaryAction.href || secondaryAction.linkOptions?.to}
                  {...secondaryAction.linkOptions}
                >
                  {secondaryAction.icon && <secondaryAction.icon className="mr-2 h-4 w-4" />}
                  {secondaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.icon && <secondaryAction.icon className="mr-2 h-4 w-4" />}
                {secondaryAction.label}
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

/**
 * Inline empty state for use within cards (like dashboard sections)
 * Smaller and without border
 */
export function InlineEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
      <div className="h-12 w-12 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-50">{description}</p>
    </div>
  )
}
