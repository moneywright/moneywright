import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base styles
        'flex h-11 w-full min-w-0 rounded-xl px-4 text-sm font-medium',
        'bg-surface-elevated border-0',
        'placeholder:text-muted-foreground/60',
        'transition-all duration-200 outline-none',
        // Focus states
        'focus-visible:ring-2 focus-visible:ring-primary/20',
        // File input styles
        'file:text-foreground file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        // Disabled styles
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        // Invalid styles
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:ring-2',
        // Selection
        'selection:bg-primary selection:text-primary-foreground',
        className
      )}
      {...props}
    />
  )
}

export { Input }
