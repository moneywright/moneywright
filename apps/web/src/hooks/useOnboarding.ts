import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCountries, setUserCountry, createProfile } from '@/lib/api'
import { toast } from 'sonner'

export const ONBOARDING_STEPS = ['Country', 'Profile'] as const

export const RELATIONSHIP_OPTIONS = [
  {
    value: 'self',
    label: 'Self',
    icon: '👤',
    description: 'Your personal finances',
  },
  {
    value: 'spouse',
    label: 'Spouse',
    icon: '💑',
    description: "Partner's finances",
  },
  {
    value: 'parent',
    label: 'Parent',
    icon: '👨‍👩‍👧',
    description: "Parent's finances",
  },
  {
    value: 'child',
    label: 'Child',
    icon: '👶',
    description: "Child's finances",
  },
  {
    value: 'sibling',
    label: 'Sibling',
    icon: '👫',
    description: "Sibling's finances",
  },
  {
    value: 'other',
    label: 'Other',
    icon: '👥',
    description: 'Other family member',
  },
] as const

// Country flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  IN: '🇮🇳',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
  DE: '🇩🇪',
  FR: '🇫🇷',
  JP: '🇯🇵',
  SG: '🇸🇬',
  AE: '🇦🇪',
}

export function getCountryFlag(countryCode: string): string {
  return COUNTRY_FLAGS[countryCode] || '🌍'
}

export function useCountrySelection() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    data: countries,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
  })

  const saveMutation = useMutation({
    mutationFn: (country: string) => setUserCountry(country),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
      navigate({ to: '/onboarding/profile', replace: true })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save country')
      toast.error('Failed to save country selection')
    },
  })

  const handleSelect = useCallback((countryCode: string) => {
    setSelectedCountry(countryCode)
    setError(null)
  }, [])

  const handleContinue = useCallback(() => {
    if (!selectedCountry) {
      setError('Please select a country')
      return
    }
    saveMutation.mutate(selectedCountry)
  }, [selectedCountry, saveMutation])

  return {
    countries,
    selectedCountry,
    isLoading,
    isError,
    isSaving: saveMutation.isPending,
    error,
    handleSelect,
    handleContinue,
  }
}

export function useProfileCreation() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<string>('self')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createProfile({
        name: name.trim(),
        relationship,
        isDefault: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile created successfully!')
      navigate({ to: '/', replace: true })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
      toast.error('Failed to create profile')
    },
  })

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!name.trim()) {
        setError('Please enter a profile name')
        return
      }
      setError(null)
      createMutation.mutate()
    },
    [name, createMutation]
  )

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setError(null)
  }, [])

  const handleRelationshipChange = useCallback((value: string) => {
    setRelationship(value)
  }, [])

  return {
    name,
    relationship,
    isCreating: createMutation.isPending,
    error,
    handleNameChange,
    handleRelationshipChange,
    handleSubmit,
  }
}
