/**
 * Assistant message component with chain of thought rendering
 */

import { Brain, BrainCircuit, MessageSquare } from 'lucide-react'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/components/ai-elements/chain-of-thought'
import { DynamicChart, type ChartConfig } from '@/components/ai-elements/dynamic-chart'
import { DynamicTable, type TableOutput } from '@/components/ai-elements/dynamic-table'
import { MessageContentWithDataTables } from './message-content'
import { ReasoningCollapsible } from './message-content'
import { TOOL_CONFIG } from './tool-config'
import { groupSteps } from './utils'
import type { Step, ToolCallStep, UIMessage } from './types'

interface StreamState {
  steps: Array<{
    type: string
    content?: string
    toolCallId?: string
    toolName?: string
    args?: unknown
  }>
  currentText: string
  currentReasoning: string
  isLoading: boolean
  toolCalls: Map<string, { result?: unknown }>
}

interface AssistantMessageProps {
  message: UIMessage
  isLastMessage: boolean
  isReasoningStreaming: boolean
  streamState: StreamState
  onToolCallClick: (toolName: string, args: unknown, result: unknown) => void
}

export function AssistantMessage({
  message,
  isLastMessage,
  isReasoningStreaming,
  streamState,
  onToolCallClick,
}: AssistantMessageProps) {
  const hasStreamingContent = streamState.steps.length > 0 || streamState.currentText

  // Build steps from streaming state if this is the last message
  let allSteps: Step[] = message.steps || []

  // If streaming and this is the last message, use stream state
  if (isLastMessage && hasStreamingContent) {
    allSteps = streamState.steps.map((s) => {
      if (s.type === 'reasoning') {
        return { type: 'reasoning' as const, content: s.content || '' }
      } else if (s.type === 'tool-call') {
        return {
          type: 'tool-call' as const,
          toolCallId: s.toolCallId || '',
          toolName: s.toolName || '',
          args: s.args,
        }
      } else {
        return { type: 'text' as const, content: s.content || '' }
      }
    })

    // Add current streaming text if any
    if (streamState.currentText) {
      const lastStep = allSteps[allSteps.length - 1]
      if (lastStep?.type === 'text') {
        allSteps[allSteps.length - 1] = {
          ...lastStep,
          content: streamState.currentText,
        }
      } else {
        allSteps.push({ type: 'text', content: streamState.currentText })
      }
    }

    // Add current reasoning if any
    if (streamState.currentReasoning) {
      const hasReasoning = allSteps.some((s) => s.type === 'reasoning')
      if (!hasReasoning) {
        allSteps.unshift({ type: 'reasoning', content: streamState.currentReasoning })
      }
    }
  }

  // Also include content from the message itself
  if (
    message.content &&
    !allSteps.some((s) => s.type === 'text' && s.content === message.content)
  ) {
    allSteps.push({ type: 'text', content: message.content })
  }

  // Group steps
  const groups = groupSteps(allSteps)

  // Show loading indicator
  if (groups.length === 0 && isLastMessage && streamState.isLoading) {
    return (
      <div className="w-full lg:w-3xl lg:mx-auto">
        <div className="shimmer-group text-sm">
          <BrainCircuit className="size-4" />
          <span>Working on it</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {groups.map((group, groupIdx) => {
        if (group.type === 'text') {
          return (
            <div key={`text-group-${groupIdx}`} className="w-full lg:w-3xl lg:mx-auto">
              <Message from="assistant">
                <MessageContent>
                  <MessageContentWithDataTables content={group.content} />
                </MessageContent>
              </Message>
            </div>
          )
        }

        // Render CoT group (reasoning + tool calls)
        const isLastGroup = groupIdx === groups.length - 1
        const hasNoTextAfter = !groups.slice(groupIdx + 1).some((g) => g.type === 'text')
        const isProcessing = isLastMessage && streamState.isLoading && isLastGroup && hasNoTextAfter

        return (
          <div key={`cot-group-${groupIdx}`} className="w-full lg:w-3xl lg:mx-auto">
            <ChainOfThought defaultOpen={true}>
              <ChainOfThoughtHeader isLoading={isProcessing}>
                {isProcessing ? 'Working on it' : 'Chain of thought'}
              </ChainOfThoughtHeader>
              <ChainOfThoughtContent>
                {group.steps.map((step, stepIdx) => (
                  <StepRenderer
                    key={`step-${groupIdx}-${stepIdx}`}
                    step={step}
                    message={message}
                    streamState={streamState}
                    isActiveReasoning={
                      isReasoningStreaming &&
                      isLastMessage &&
                      groupIdx === groups.length - 1 &&
                      stepIdx === group.steps.length - 1
                    }
                    onToolCallClick={onToolCallClick}
                  />
                ))}
              </ChainOfThoughtContent>
            </ChainOfThought>
          </div>
        )
      })}
    </>
  )
}

interface StepRendererProps {
  step: Step
  message: UIMessage
  streamState: StreamState
  isActiveReasoning: boolean
  onToolCallClick: (toolName: string, args: unknown, result: unknown) => void
}

function StepRenderer({
  step,
  message,
  streamState,
  isActiveReasoning,
  onToolCallClick,
}: StepRendererProps) {
  if (step.type === 'reasoning') {
    return (
      <ChainOfThoughtStep
        icon={Brain}
        label={
          <ReasoningCollapsible
            label={isActiveReasoning ? 'Thinking...' : 'Thought process'}
            content={step.content}
            isActive={isActiveReasoning}
          />
        }
        description=""
        status="complete"
      />
    )
  }

  // Tool call step
  const toolCall = step as ToolCallStep
  const toolResult = message.toolResults?.find((r) => r.toolCallId === toolCall.toolCallId)
  const streamingResult = streamState.toolCalls.get(toolCall.toolCallId)
  const hasResult = toolResult || streamingResult?.result !== undefined

  const toolConfig = TOOL_CONFIG[toolCall.toolName]
  const Icon = toolConfig?.icon || MessageSquare
  const label = hasResult
    ? toolConfig?.completed || toolCall.toolName
    : toolConfig?.pending || toolCall.toolName

  // Check if executeCode returned chart or table
  const result = (toolResult?.result || streamingResult?.result) as
    | Record<string, unknown>
    | undefined
  const isExecuteCode = toolCall.toolName === 'executeCode'
  const hasChartResult = Boolean(
    isExecuteCode && result?.success && result?.outputType === 'chart' && result?.chart
  )
  const hasTableResult = Boolean(
    isExecuteCode && result?.success && result?.outputType === 'table' && result?.table
  )

  return (
    <ChainOfThoughtStep
      icon={Icon}
      label={
        <button
          type="button"
          className="hover:text-foreground transition-colors cursor-pointer text-left"
          onClick={() => onToolCallClick(toolCall.toolName, toolCall.args, result)}
        >
          {label}
        </button>
      }
      status={hasResult ? 'complete' : 'active'}
    >
      {hasChartResult && !!result?.chart && (
        <div className="mt-4 p-4 rounded-xl bg-surface-elevated border border-border-subtle">
          <DynamicChart chart={result.chart as ChartConfig} />
        </div>
      )}
      {hasTableResult && !!result?.table && (
        <div className="mt-4">
          <DynamicTable table={result.table as TableOutput} />
        </div>
      )}
    </ChainOfThoughtStep>
  )
}
