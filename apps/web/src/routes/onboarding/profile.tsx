import { createFileRoute } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, ArrowRight, Check, Sparkles, Users, Link2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthLayout, type AuthStep } from '@/components/auth/auth-layout'
import { useProfileCreation, RELATIONSHIP_OPTIONS } from '@/hooks/useOnboarding'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/onboarding/profile')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
  component: ProfileCreationPage,
})

// Step definitions for AuthLayout
const ONBOARDING_STEPS: AuthStep[] = [
  { id: 'country', label: 'Country' },
  { id: 'profile', label: 'Profile' },
  { id: 'statements', label: 'Statements' },
]

function ProfileCreationPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const {
    name,
    relationship,
    summary,
    isCreating,
    error,
    handleNameChange,
    handleRelationshipChange,
    handleSummaryChange,
    handleSubmit,
  } = useProfileCreation(redirectTo)

  return (
    <AuthLayout
      currentStep={2}
      steps={ONBOARDING_STEPS}
      title="Create your"
      subtitle="profile"
      description="Create your profile to start tracking finances for yourself or your entire household."
      features={[
        {
          icon: <Users className="w-4 h-4" />,
          title: 'Multiple Profiles',
          description: 'Track spending for family members separately',
        },
        {
          icon: <Link2 className="w-4 h-4" />,
          title: 'Family View',
          description: 'See combined spending across all household members',
        },
        {
          icon: <BarChart3 className="w-4 h-4" />,
          title: 'Individual Insights',
          description: 'See spending patterns per person',
        },
      ]}
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
            <div className="flex flex-wrap gap-2">
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

          {/* Profile summary */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <label className="block text-sm font-medium text-zinc-400 mb-2.5">
              About this profile <span className="text-zinc-600">(optional)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => handleSummaryChange(e.target.value)}
              placeholder="e.g., Software engineer at Acme. Has rental property income. Pays home loan EMI and school fees for 2 kids."
              maxLength={1000}
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-[15px] bg-zinc-900/50 border border-zinc-800/80 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all duration-200 resize-none"
            />
            <p className="mt-2 text-xs text-zinc-600">
              Mention occupation, income sources, and regular expenses to improve categorization
            </p>
          </motion.div>

          {/* Submit button */}
          <motion.div
            className="pt-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Button
              type="submit"
              disabled={!name.trim() || isCreating}
              className={cn(
                'w-full h-12 rounded-xl text-[15px] font-medium transition-none',
                name.trim()
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110'
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
            transition={{ duration: 0.4, delay: 0.45 }}
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
        'flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-200 text-left',
        isSelected
          ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
          : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800/50 hover:border-zinc-700 hover:text-zinc-300'
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: 0.03 * index }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="text-sm">{option.icon}</span>
      <span className="text-sm font-medium">{option.label}</span>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
        </motion.div>
      )}
    </motion.button>
  )
}
