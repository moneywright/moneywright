/**
 * Chat Welcome Screen - Premium empty state with centered input
 *
 * Design: Refined minimalism with purposeful depth
 * - Penny the owl mascot as the centerpiece
 * - Floating prompt cards with hover lift effects
 * - Suggestions for analysis beyond what dashboard shows
 */

import { cn } from '@/lib/utils'
import { Search, TrendingDown, Calendar, Lightbulb, type LucideIcon } from 'lucide-react'

interface PromptSuggestion {
  icon: LucideIcon
  label: string
  prompt: string
  gradient: string
}

// Suggestions for things NOT shown on dashboard:
// Dashboard shows: trends, category breakdown, subscriptions, balances
// Chat can do: comparisons, anomalies, projections, specific queries, advice
const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    icon: Search,
    label: 'Find transactions',
    prompt: 'Find all my grocery orders from last month',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    icon: TrendingDown,
    label: 'Spot unusual spending',
    prompt: 'Are there any unusual or unexpected charges in the last month?',
    gradient: 'from-rose-500/20 to-pink-500/20',
  },
  {
    icon: Calendar,
    label: 'Compare periods',
    prompt: 'How does my spending this month compare to my 3-month average?',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: Lightbulb,
    label: 'Get insights',
    prompt: 'What are my top 3 areas where I could reduce spending?',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
]

interface ChatWelcomeProps {
  onSelectPrompt: (prompt: string) => void
  className?: string
}

export function ChatWelcome({ onSelectPrompt, className }: ChatWelcomeProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] px-4 py-8',
        'opacity-0 animate-fade-in',
        className
      )}
    >
      {/* Ambient gradient orb - creates depth without being distracting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[100px]"
          style={{
            background: 'radial-gradient(ellipse at center, var(--primary) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Hero section */}
      <div className="relative text-center mb-10 max-w-xl">
        {/* Penny the Owl */}
        <div
          className="inline-flex items-center justify-center mb-6 opacity-0 animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          <img src="/logo.png" alt="Penny" className="w-20 h-20 object-contain drop-shadow-lg" />
        </div>

        {/* Headline */}
        <h1
          className="font-display text-3xl sm:text-4xl font-semibold text-foreground mb-3 tracking-tight opacity-0 animate-fade-in"
          style={{ animationDelay: '150ms' }}
        >
          Ask Penny
        </h1>

        {/* Subheadline */}
        <p
          className="text-muted-foreground text-base sm:text-lg leading-relaxed opacity-0 animate-fade-in"
          style={{ animationDelay: '200ms' }}
        >
          Your wise financial companion. Ask questions, find transactions, and get personalized
          insights.
        </p>
      </div>

      {/* Prompt suggestions grid */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mb-10">
        {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={suggestion.label}
            onClick={() => onSelectPrompt(suggestion.prompt)}
            className={cn(
              'group relative flex items-start gap-3 p-4 rounded-xl text-left',
              'bg-card/80 backdrop-blur-sm border border-border-subtle',
              'hover:bg-card hover:border-border-hover hover:shadow-lg hover:shadow-black/5',
              'dark:hover:shadow-black/20',
              'transition-all duration-300 ease-out',
              'hover:-translate-y-0.5',
              'opacity-0 animate-fade-in'
            )}
            style={{ animationDelay: `${250 + idx * 50}ms` }}
          >
            {/* Icon container with gradient background */}
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                'bg-gradient-to-br border border-border-subtle',
                'group-hover:scale-105 transition-transform duration-300',
                suggestion.gradient
              )}
            >
              <suggestion.icon className="w-5 h-5 text-foreground/80" />
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <span className="block text-sm font-medium text-foreground mb-0.5">
                {suggestion.label}
              </span>
              <span className="block text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {suggestion.prompt}
              </span>
            </div>

            {/* Hover arrow indicator */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <svg
                className="w-4 h-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Disclaimer - subtle and non-intrusive */}
      <p
        className="text-xs text-muted-foreground/60 text-center max-w-md leading-relaxed opacity-0 animate-fade-in"
        style={{ animationDelay: '500ms' }}
      >
        Penny analyzes your transaction data to provide insights. For important financial decisions,
        please consult a qualified professional.
      </p>
    </div>
  )
}
