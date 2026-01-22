/**
 * Category color mapping for Tailwind classes
 * Uses muted colors appropriate for dark themes
 */

export interface CategoryColorClasses {
  /** Muted dot color for category identification */
  dot: string
  /** Background color for badges/indicators */
  bg: string
  /** Text color for badges/indicators */
  text: string
  /** Bar/progress color */
  bar: string
}

/**
 * Muted color palette for dark theme
 * Uses -600 shades which are subtle but still distinguishable
 */
export const CATEGORY_COLOR_MAP: Record<string, CategoryColorClasses> = {
  orange: {
    dot: 'bg-orange-700',
    bg: 'bg-orange-500/10',
    text: 'text-orange-600/70',
    bar: 'bg-orange-600/60',
  },
  lime: {
    dot: 'bg-lime-700',
    bg: 'bg-lime-500/10',
    text: 'text-lime-600/70',
    bar: 'bg-lime-600/60',
  },
  blue: {
    dot: 'bg-blue-700',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500/70',
    bar: 'bg-blue-500/60',
  },
  cyan: {
    dot: 'bg-cyan-700',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-500/70',
    bar: 'bg-cyan-500/60',
  },
  rose: {
    dot: 'bg-rose-700',
    bg: 'bg-rose-500/10',
    text: 'text-rose-500/70',
    bar: 'bg-rose-500/60',
  },
  purple: {
    dot: 'bg-purple-700',
    bg: 'bg-purple-500/10',
    text: 'text-purple-500/70',
    bar: 'bg-purple-500/60',
  },
  amber: {
    dot: 'bg-amber-700',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500/70',
    bar: 'bg-amber-500/60',
  },
  pink: {
    dot: 'bg-pink-700',
    bg: 'bg-pink-500/10',
    text: 'text-pink-500/70',
    bar: 'bg-pink-500/60',
  },
  sky: { dot: 'bg-sky-700', bg: 'bg-sky-500/10', text: 'text-sky-500/70', bar: 'bg-sky-500/60' },
  red: { dot: 'bg-red-700', bg: 'bg-red-500/10', text: 'text-red-500/70', bar: 'bg-red-500/60' },
  fuchsia: {
    dot: 'bg-fuchsia-700',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-500/70',
    bar: 'bg-fuchsia-500/60',
  },
  indigo: {
    dot: 'bg-indigo-700',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-500/70',
    bar: 'bg-indigo-500/60',
  },
  slate: {
    dot: 'bg-slate-600',
    bg: 'bg-slate-500/10',
    text: 'text-slate-500/70',
    bar: 'bg-slate-500/60',
  },
  violet: {
    dot: 'bg-violet-700',
    bg: 'bg-violet-500/10',
    text: 'text-violet-500/70',
    bar: 'bg-violet-500/60',
  },
  zinc: {
    dot: 'bg-zinc-600',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-500/70',
    bar: 'bg-zinc-500/60',
  },
  emerald: {
    dot: 'bg-emerald-700',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500/70',
    bar: 'bg-emerald-500/60',
  },
  teal: {
    dot: 'bg-teal-700',
    bg: 'bg-teal-500/10',
    text: 'text-teal-500/70',
    bar: 'bg-teal-500/60',
  },
}

/**
 * Default color for unknown categories
 */
export const DEFAULT_CATEGORY_COLOR: CategoryColorClasses = {
  dot: 'bg-zinc-500',
  bg: 'bg-zinc-500/15',
  text: 'text-zinc-400',
  bar: 'bg-zinc-500',
}

/**
 * Get color classes for a category color name
 */
export function getCategoryColorClasses(colorName: string): CategoryColorClasses {
  return CATEGORY_COLOR_MAP[colorName] || DEFAULT_CATEGORY_COLOR
}
