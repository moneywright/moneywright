import { createFileRoute } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthLayout, type AuthStep } from '@/components/auth/auth-layout'
import { useCountrySelection, getCountryFlag } from '@/hooks/useOnboarding'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/onboarding/country')({
  component: CountrySelectionPage,
})

// Step definitions for AuthLayout
const ONBOARDING_STEPS: AuthStep[] = [
  { id: 'country', label: 'Country' },
  { id: 'profile', label: 'Profile' },
]

function CountrySelectionPage() {
  const { countries, selectedCountry, isLoading, isSaving, error, handleSelect, handleContinue } =
    useCountrySelection()

  return (
    <AuthLayout
      currentStep={1}
      steps={ONBOARDING_STEPS}
      title="Your finances,"
      subtitle="simplified"
    >
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="mb-8">
          <motion.h1
            className="text-2xl font-semibold text-white tracking-tight font-display mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Where are you based?
          </motion.h1>
          <motion.p
            className="text-zinc-500 text-[15px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            We'll format currencies and provide localized insights
          </motion.p>
        </div>

        {/* Error message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Country options */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
          </div>
        ) : (
          <motion.div
            className="space-y-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {countries?.map((country, index) => (
              <CountryOption
                key={country.code}
                country={country}
                isSelected={selectedCountry === country.code}
                onSelect={() => handleSelect(country.code)}
                index={index}
              />
            ))}
          </motion.div>
        )}

        {/* Continue button */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Button
            onClick={handleContinue}
            disabled={!selectedCountry || isSaving}
            className={cn(
              'w-full h-12 rounded-xl text-[15px] font-medium transition-all duration-300',
              selectedCountry
                ? 'bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </motion.div>
      </motion.div>
    </AuthLayout>
  )
}

interface CountryOptionProps {
  country: {
    code: string
    name: string
    currency: string
    currencySymbol: string
  }
  isSelected: boolean
  onSelect: () => void
  index: number
}

function CountryOption({ country, isSelected, onSelect, index }: CountryOptionProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left group',
        isSelected
          ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
          : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 * index }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Flag */}
      <div
        className={cn(
          'flex items-center justify-center w-12 h-12 rounded-xl text-2xl transition-colors',
          isSelected ? 'bg-emerald-500/20' : 'bg-zinc-800/80 group-hover:bg-zinc-800'
        )}
      >
        {getCountryFlag(country.code)}
      </div>

      {/* Country info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-medium transition-colors',
            isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'
          )}
        >
          {country.name}
        </div>
        <div
          className={cn(
            'text-sm mt-0.5 transition-colors',
            isSelected ? 'text-emerald-400/80' : 'text-zinc-500'
          )}
        >
          {country.currencySymbol} {country.currency}
        </div>
      </div>

      {/* Selection indicator */}
      <div
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200',
          isSelected
            ? 'bg-emerald-500 text-white'
            : 'border-2 border-zinc-700 group-hover:border-zinc-600'
        )}
      >
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </motion.div>
        )}
      </div>
    </motion.button>
  )
}
