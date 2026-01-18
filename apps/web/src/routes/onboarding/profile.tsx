import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, User, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/onboarding/profile')({
  component: ProfileCreationPage,
})

const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Self', description: 'This is my personal profile' },
  { value: 'spouse', label: 'Spouse', description: "My partner's finances" },
  { value: 'parent', label: 'Parent', description: "A parent's finances" },
  { value: 'child', label: 'Child', description: "A child's finances" },
  { value: 'sibling', label: 'Sibling', description: "A sibling's finances" },
  { value: 'other', label: 'Other', description: 'Other family member' },
] as const

function ProfileCreationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<string>('self')
  const [error, setError] = useState<string | null>(null)

  // Create profile mutation
  const createMutation = useMutation({
    mutationFn: () =>
      createProfile({
        name: name.trim(),
        relationship,
        isDefault: true, // First profile is always default
      }),
    onSuccess: () => {
      // Invalidate auth status and profiles
      queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      // Navigate to dashboard
      navigate({ to: '/', replace: true })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a profile name')
      return
    }
    setError(null)
    createMutation.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Your First Profile</CardTitle>
          <CardDescription>
            Profiles help you organize finances for yourself and family members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Profile Name</Label>
              <Input
                id="name"
                placeholder="e.g., Personal, My Finances, John"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Choose a name that helps you identify this profile
              </p>
            </div>

            <div className="space-y-3">
              <Label>Relationship</Label>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRelationship(option.value)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left',
                      relationship === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div>
                      <div className="font-medium text-sm">{option.label}</div>
                    </div>
                    {relationship === option.value && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Profile & Continue'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You can add more profiles later from the settings
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
