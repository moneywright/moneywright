/**
 * Chat Hooks
 *
 * React Query hooks for chat functionality.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useRef } from 'react'
import {
  listConversations,
  createConversation,
  getConversationById,
  getConversation,
  deleteConversation,
  clearConversation,
  sendChatMessage,
  type ChatStep,
} from '@/lib/api'

/**
 * Hook to list all conversations for a profile
 */
export function useConversations(profileId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', profileId],
    queryFn: () => listConversations(profileId!),
    enabled: !!profileId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Hook to create a new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (profileId: string) => createConversation(profileId),
    onSuccess: (_data, profileId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', profileId] })
    },
  })
}

/**
 * Hook to get a specific conversation by ID
 */
export function useConversationById(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversationById(conversationId!),
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Hook to get or create conversation for a profile (legacy)
 */
export function useConversation(profileId: string | undefined) {
  return useQuery({
    queryKey: ['conversation-default', profileId],
    queryFn: () => getConversation(profileId!),
    enabled: !!profileId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Hook to delete a conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
  })
}

/**
 * Hook to clear conversation messages
 */
export function useClearConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => clearConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation'] })
    },
  })
}

/**
 * State for streaming chat
 */
export interface ChatStreamState {
  isLoading: boolean
  error: string | null
  steps: ChatStep[]
  currentText: string
  currentReasoning: string
  toolCalls: Map<string, { toolName: string; args: unknown; result?: unknown }>
}

/**
 * Hook for streaming chat messages
 */
export function useChatStream(conversationId: string | undefined, profileId: string | undefined) {
  const queryClient = useQueryClient()
  const abortControllerRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<ChatStreamState>({
    isLoading: false,
    error: null,
    steps: [],
    currentText: '',
    currentReasoning: '',
    toolCalls: new Map(),
  })

  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      steps: [],
      currentText: '',
      currentReasoning: '',
      toolCalls: new Map(),
    })
  }, [])

  const sendMessage = useCallback(
    async (
      content: string,
      options: {
        provider: string
        model: string
        thinkingEnabled?: boolean
        thinkingBudget?: number
        reasoningEffort?: 'low' | 'medium' | 'high'
        thinkingLevel?: 'low' | 'medium' | 'high'
        conversationId?: string // Allow overriding the conversation ID
      }
    ) => {
      // Use provided conversationId or fall back to hook's conversationId
      const targetConversationId = options.conversationId || conversationId
      if (!targetConversationId) return

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        steps: [],
        currentText: '',
        currentReasoning: '',
        toolCalls: new Map(),
      }))

      try {
        await sendChatMessage(targetConversationId, content, {
          ...options,
          signal: abortController.signal,
          onEvent: (event) => {
            switch (event.type) {
              case 'text':
                setState((prev) => {
                  const newSteps = [...prev.steps]
                  const lastStep = newSteps[newSteps.length - 1]
                  if (lastStep?.type === 'text') {
                    // Create a new object instead of mutating
                    newSteps[newSteps.length - 1] = {
                      ...lastStep,
                      content: lastStep.content + event.text,
                    }
                  } else {
                    newSteps.push({ type: 'text', content: event.text })
                  }
                  return {
                    ...prev,
                    steps: newSteps,
                    currentText: prev.currentText + event.text,
                  }
                })
                break

              case 'reasoning':
                setState((prev) => {
                  const newSteps = [...prev.steps]
                  const lastStep = newSteps[newSteps.length - 1]
                  if (lastStep?.type === 'reasoning') {
                    // Create a new object instead of mutating
                    newSteps[newSteps.length - 1] = {
                      ...lastStep,
                      content: lastStep.content + event.text,
                    }
                  } else {
                    newSteps.push({ type: 'reasoning', content: event.text })
                  }
                  return {
                    ...prev,
                    steps: newSteps,
                    currentReasoning: prev.currentReasoning + event.text,
                  }
                })
                break

              case 'tool-call':
                setState((prev) => {
                  const newSteps = [...prev.steps]
                  newSteps.push({
                    type: 'tool-call',
                    toolCallId: event.toolCallId,
                    toolName: event.toolName,
                    args: event.args,
                  })
                  const newToolCalls = new Map(prev.toolCalls)
                  newToolCalls.set(event.toolCallId, {
                    toolName: event.toolName,
                    args: event.args,
                  })
                  return {
                    ...prev,
                    steps: newSteps,
                    toolCalls: newToolCalls,
                  }
                })
                break

              case 'tool-result':
                setState((prev) => {
                  const newToolCalls = new Map(prev.toolCalls)
                  const existing = newToolCalls.get(event.toolCallId)
                  if (existing) {
                    newToolCalls.set(event.toolCallId, {
                      ...existing,
                      result: event.result,
                    })
                  }
                  return {
                    ...prev,
                    toolCalls: newToolCalls,
                  }
                })
                break

              case 'done':
                setState((prev) => ({
                  ...prev,
                  isLoading: false,
                }))
                // Invalidate conversation to refresh messages
                queryClient.invalidateQueries({ queryKey: ['conversation', profileId] })
                break

              case 'error':
                setState((prev) => ({
                  ...prev,
                  isLoading: false,
                  error: event.error,
                }))
                break
            }
          },
        })
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return
        }
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        }))
      }
    },
    [conversationId, profileId, queryClient]
  )

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState((prev) => ({
      ...prev,
      isLoading: false,
    }))
  }, [])

  return {
    ...state,
    sendMessage,
    cancel,
    resetState,
  }
}
