/**
 * Account info section component
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Mail } from 'lucide-react'

interface AccountSectionProps {
  user: {
    name?: string | null
    email?: string | null
  } | null
}

export function AccountSection({ user }: AccountSectionProps) {
  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Account
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Name</p>
              <p className="truncate text-sm font-medium">{user?.name || 'Local User'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border-subtle">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="truncate text-sm font-medium">{user?.email || 'No authentication'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
