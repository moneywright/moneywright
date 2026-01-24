/**
 * AI Chat Service Types
 *
 * Shared types for the AI chat agent system.
 */

import type { ModelMessage } from 'ai'

/**
 * AI Provider IDs
 */
export const AI_PROVIDER_IDS = ['openai', 'anthropic', 'google', 'vercel', 'ollama'] as const

/**
 * AI Provider type
 */
export type AIProvider = (typeof AI_PROVIDER_IDS)[number]

/**
 * Reasoning/Thinking effort level for OpenAI models
 */
export type ReasoningEffort = 'low' | 'medium' | 'high'

/**
 * Thinking level for Google Gemini models
 */
export type GoogleThinkingLevel = 'low' | 'medium' | 'high'

/**
 * Thinking configuration for AI models
 */
export interface ThinkingConfig {
  enabled: boolean
  /** Budget tokens for Anthropic and Google Gemini 2.5 (min 1024, recommended 10000+) */
  budgetTokens?: number
  /** Reasoning effort for OpenAI ('low' | 'medium' | 'high') */
  reasoningEffort?: ReasoningEffort
  /** Thinking level for Google Gemini 3 models */
  thinkingLevel?: GoogleThinkingLevel
}

/**
 * Step types for streaming response
 */
export type ReasoningStep = { type: 'reasoning'; content: string }
export type ToolCallStep = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: unknown
}
export type TextStep = { type: 'text'; content: string }
export type Step = ReasoningStep | ToolCallStep | TextStep

/**
 * Message format for storing in database
 */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider?: AIProvider
  model?: string
  toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }>
  toolResults?: Array<{ toolCallId: string; toolName: string; result: unknown }>
  approvalState?: Array<{
    type: 'pending'
    toolCallId: string
    toolName: string
    confirmationData?: unknown
  }>
  /** Reasoning/thinking steps from the model */
  reasoning?: string // JSON array of steps
}

/**
 * Convert stored messages to AI SDK v6 ModelMessage format
 *
 * AI SDK v6 ModelMessage format:
 * - user: { role: 'user', content: string }
 * - assistant: { role: 'assistant', content: string | ContentPart[] }
 *   - ToolCallPart: { type: 'tool-call', toolCallId, toolName, input }
 * - tool: { role: 'tool', content: ToolResultPart[] }
 *   - ToolResultPart: { type: 'tool-result', toolCallId, toolName, output: { type: 'json', value } }
 */
export function storedToModelMessages(messages: StoredMessage[]): ModelMessage[] {
  const result: ModelMessage[] = []

  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content } as ModelMessage)
    } else if (msg.role === 'assistant') {
      const contentParts: unknown[] = []

      // Add text content if present
      if (msg.content) {
        contentParts.push({ type: 'text' as const, text: msg.content })
      }

      // Add tool calls
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          contentParts.push({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.args,
          })
        }
      }

      if (contentParts.length > 0) {
        result.push({
          role: 'assistant',
          content: contentParts,
        } as ModelMessage)
      } else {
        result.push({ role: 'assistant', content: msg.content || '' } as ModelMessage)
      }

      // Add tool result messages for each tool call (if tool results exist)
      if (msg.toolResults && msg.toolResults.length > 0) {
        result.push({
          role: 'tool',
          content: msg.toolResults.map((tr) => ({
            type: 'tool-result' as const,
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: { type: 'json' as const, value: tr.result },
          })),
        } as ModelMessage)
      }
    } else if (msg.role === 'tool') {
      // Tool result message (legacy format)
      if (msg.toolResults && msg.toolResults.length > 0) {
        result.push({
          role: 'tool',
          content: msg.toolResults.map((tr) => ({
            type: 'tool-result' as const,
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: { type: 'json' as const, value: tr.result },
          })),
        } as ModelMessage)
      }
    }
  }

  return result
}

/**
 * Agent creation options
 */
export interface CreateAgentOptions {
  provider: AIProvider
  model: string
  apiKey: string
  profileId: string
  userId: string
  profileSummary?: string
  thinking?: ThinkingConfig
}

/**
 * Confirmation data returned by tools requiring user approval
 */
export interface ToolConfirmation {
  confirmation_required: true
  action: string
  description: string
  warning: string
  [key: string]: unknown
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
