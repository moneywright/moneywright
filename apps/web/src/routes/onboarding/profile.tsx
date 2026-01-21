import { createFileRoute } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, ArrowRight, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthLayout, type AuthStep } from '@/components/auth/auth-layout'
import { useProfileCreation, RELATIONSHIP_OPTIONS } from '@/hooks/useOnboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/onboarding/profile')({
  component: ProfileCreationPage,
})

// Step definitions for AuthLayout
const ONBOARDING_STEPS: AuthStep[] = [
  { id: 'country', label: 'Country' },
  { id: 'profile', label: 'Profile' },
]

function ProfileCreationPage() {
  const {
    name,
    relationship,
    isCreating,
    error,
    handleNameChange,
    handleRelationshipChange,
    handleSubmit,
  } = useProfileCreation()

  return (
    <AuthLayout currentStep={2} steps={ONBOARDING_STEPS} title="Almost there," subtitle="let's go">
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
            Create your profile
          </motion.h1>
          <motion.p
            className="text-zinc-500 text-[15px]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Organize finances for yourself or family members
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile name input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <label className="block text-sm font-medium text-zinc-400 mb-2.5">Profile name</label>
            <div className="relative">
              <Input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Personal, John, Family"
                maxLength={50}
                autoFocus
                className="h-12 px-4 rounded-xl text-[15px] bg-zinc-900/50 border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 transition-all duration-200"
              />
              <AnimatePresence>
                {name.length > 0 && (
                  <motion.div
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              Choose a name that helps you identify this profile
            </p>
          </motion.div>

          {/* Relationship selector */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <label className="block text-sm font-medium text-zinc-400 mb-2.5">
              Who is this profile for?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RELATIONSHIP_OPTIONS.map((option, index) => (
                <RelationshipOption
                  key={option.value}
                  option={option}
                  isSelected={relationship === option.value}
                  onSelect={() => handleRelationshipChange(option.value)}
                  index={index}
                />
              ))}
            </div>
          </motion.div>

          {/* Submit button */}
          <motion.div
            className="pt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <Button
              type="submit"
              disabled={!name.trim() || isCreating}
              className={cn(
                'w-full h-12 rounded-xl text-[15px] font-medium transition-all duration-300',
                name.trim()
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              )}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </motion.div>

          {/* Footer note */}
          <motion.p
            className="text-center text-xs text-zinc-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            You can add more profiles anytime from settings
          </motion.p>
        </form>
      </motion.div>
    </AuthLayout>
  )
}

interface RelationshipOptionProps {
  option: {
    value: string
    label: string
    icon: string
    description: string
  }
  isSelected: boolean
  onSelect: () => void
  index: number
}

function RelationshipOption({ option, isSelected, onSelect, index }: RelationshipOptionProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left group',
        isSelected
          ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
          : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700'
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: 0.03 * index }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg text-base transition-colors',
          isSelected ? 'bg-emerald-500/20' : 'bg-zinc-800/80 group-hover:bg-zinc-800'
        )}
      >
        {option.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm font-medium transition-colors',
            isSelected ? 'text-white' : 'text-zinc-300 group-hover:text-white'
          )}
        >
          {option.label}
        </div>
        <div
          className={cn(
            'text-[11px] mt-0.5 transition-colors truncate',
            isSelected ? 'text-emerald-400/70' : 'text-zinc-600'
          )}
        >
          {option.description}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          className="absolute top-2 right-2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </div>
        </motion.div>
      )}
    </motion.button>
  )
}
