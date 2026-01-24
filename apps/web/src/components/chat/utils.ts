/**
 * Chat utility functions
 */

import type { Step, StepGroup, ReasoningStep, ToolCallStep } from './types'

/**
 * Group consecutive reasoning/tool-call steps into CoT groups, keeping text separate
 */
export function groupSteps(steps: Step[]): StepGroup[] {
  const groups: StepGroup[] = []
  let currentCotSteps: (ReasoningStep | ToolCallStep)[] = []

  for (const step of steps) {
    if (step.type === 'text') {
      // Flush any pending CoT steps
      if (currentCotSteps.length > 0) {
        groups.push({ type: 'cot', steps: currentCotSteps })
        currentCotSteps = []
      }
      groups.push({ type: 'text', content: step.content })
    } else {
      // Reasoning or tool-call - accumulate
      currentCotSteps.push(step)
    }
  }

  // Flush remaining CoT steps
  if (currentCotSteps.length > 0) {
    groups.push({ type: 'cot', steps: currentCotSteps })
  }

  return groups
}

// Parse content to extract data-table tags
export type ContentPart =
  | { type: 'text'; content: string }
  | { type: 'data-table'; queryId: string }

export function parseContentWithDataTables(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  // Match <data-table query-id="xxx" /> or <data-table query-id="xxx"></data-table>
  const dataTableRegex = /<data-table\s+query-id="([^"]+)"\s*\/?>(?:<\/data-table>)?/g
  let lastIndex = 0
  let match

  // Using regex.exec for iterating over matches (standard JS string matching, not child_process)
  while ((match = dataTableRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        parts.push({ type: 'text', content: textContent })
      }
    }
    // Add the data-table
    parts.push({ type: 'data-table', queryId: match[1] as string })
    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim()
    if (textContent) {
      parts.push({ type: 'text', content: textContent })
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }]
}

/**
 * Format date for display in conversation history
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString()
}
