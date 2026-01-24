/**
 * Chat component types
 */

// Step types for ordered display
export type ReasoningStep = { type: 'reasoning'; content: string }
export type ToolCallStep = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: unknown
}
export type TextStep = { type: 'text'; content: string }
export type Step = ReasoningStep | ToolCallStep | TextStep

// UI Message type for optimistic updates
export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  steps?: Step[]
  toolCalls?: Array<{
    toolCallId: string
    toolName: string
    args: unknown
  }>
  toolResults?: Array<{
    toolCallId: string
    toolName: string
    result: unknown
  }>
}

// Group consecutive reasoning/tool-call steps into CoT groups, keeping text separate
export type StepGroup =
  | { type: 'cot'; steps: (ReasoningStep | ToolCallStep)[] }
  | { type: 'text'; content: string }

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high'
