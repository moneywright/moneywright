/**
 * Active sessions section component
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Monitor, Smartphone, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { revokeSession, revokeOtherSessions } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Session } from './types'

interface SessionsSectionProps {
  sessions: Session[] | undefined
  isLoading: boolean
}

export function SessionsSection({ sessions, isLoading }: SessionsSectionProps) {
  const queryClient = useQueryClient()

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session revoked')
    },
    onError: () => {
      toast.error('Failed to revoke session')
    },
  })

  // Revoke other sessions mutation
  const revokeOthersMutation = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(`Revoked ${data.revokedCount} other sessions`)
    },
    onError: () => {
      toast.error('Failed to revoke sessions')
    },
  })

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />
    if (userAgent.toLowerCase().includes('mobile')) return <Smartphone className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  const getDeviceName = (session: Session) => {
    if (session.current) return 'This device'
    return session.userAgent?.split(' ')[0] || 'Unknown device'
  }

  return (
    <Card className="border-border-subtle hover:border-border-hover transition-colors animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Active Sessions
          </CardTitle>
          {sessions && sessions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => revokeOthersMutation.mutate()}
              disabled={revokeOthersMutation.isPending}
            >
              <LogOut className="mr-1 h-3 w-3" />
              Sign out others
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {sessions?.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3 transition-colors',
                  session.current
                    ? 'border-primary/20 bg-primary/5'
                    : 'border-border-subtle bg-surface-elevated hover:border-border-hover'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border',
                      session.current
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-border-subtle bg-card text-muted-foreground'
                    )}
                  >
                    {getDeviceIcon(session.userAgent)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{getDeviceName(session)}</p>
                      {session.current && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last active: {new Date(session.lastUsedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => revokeSessionMutation.mutate(session.id)}
                    disabled={revokeSessionMutation.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
