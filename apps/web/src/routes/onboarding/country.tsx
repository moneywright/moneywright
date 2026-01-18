import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCountries, setUserCountry } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Check, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/onboarding/country')({
  component: CountrySelectionPage,
})

function CountrySelectionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch supported countries
  const { data: countries, isLoading: countriesLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
  })

  // Save country mutation
  const saveMutation = useMutation({
    mutationFn: (country: string) => setUserCountry(country),
    onSuccess: () => {
      // Invalidate auth status to reflect the change
      queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
      // Navigate to profile creation
      navigate({ to: '/onboarding/profile', replace: true })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save country')
    },
  })

  const handleContinue = () => {
    if (!selectedCountry) return
    setError(null)
    saveMutation.mutate(selectedCountry)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Select Your Country</CardTitle>
          <CardDescription>
            This helps us format currencies and provide relevant financial insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          {countriesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3">
              {countries?.map((country) => (
                <button
                  key={country.code}
                  onClick={() => setSelectedCountry(country.code)}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border-2 transition-all text-left',
                    selectedCountry === country.code
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCountryFlag(country.code)}</span>
                    <div>
                      <div className="font-medium">{country.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {country.currencySymbol} {country.currency}
                      </div>
                    </div>
                  </div>
                  {selectedCountry === country.code && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleContinue}
            disabled={!selectedCountry || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper to get country flag emoji
function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    IN: '\u{1F1EE}\u{1F1F3}', // India
    US: '\u{1F1FA}\u{1F1F8}', // USA
    GB: '\u{1F1EC}\u{1F1E7}', // UK
    CA: '\u{1F1E8}\u{1F1E6}', // Canada
    AU: '\u{1F1E6}\u{1F1FA}', // Australia
  }
  return flags[countryCode] || '\u{1F30D}' // Default globe
}
