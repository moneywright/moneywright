import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from './__root'
import { getUserSessions, revokeSession, revokeOtherSessions, deleteAccount } from '@/lib/api'
import { AppLayout } from '@/components/domain/app-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Monitor, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const queryClient = useQueryClient()
  const { user, logout, authEnabled } = useAuthContext()

  // Fetch sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: getUserSessions,
  })

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

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success('Account deleted')
      logout()
    },
    onError: () => {
      toast.error('Failed to delete account')
    },
  })

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />
    if (userAgent.toLowerCase().includes('mobile')) return <Smartphone className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Name</span>
              <p>{user?.name || 'Local User'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Email</span>
              <p>{user?.email || 'No authentication'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Sessions - only show when auth is enabled */}
        {authEnabled && (
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your active sessions across devices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {sessions?.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between py-2 border-b last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(session.userAgent)}
                        <div>
                          <p className="text-sm font-medium">
                            {session.current
                              ? 'This device'
                              : session.userAgent?.split(' ')[0] || 'Unknown device'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last active: {new Date(session.lastUsedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeSessionMutation.mutate(session.id)}
                          disabled={revokeSessionMutation.isPending}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}

                  {sessions && sessions.length > 1 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => revokeOthersMutation.mutate()}
                      disabled={revokeOthersMutation.isPending}
                    >
                      Sign out of all other sessions
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Danger zone - only show when auth is enabled */}
        {authEnabled && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your account and
                      remove all your data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteAccountMutation.mutate()}
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  )
}
