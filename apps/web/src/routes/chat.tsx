import { useState, useRef, useEffect, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  useAuth,
  usePreferences,
  useSetPreference,
  useChatConfig,
  useConversations,
  useCreateConversation,
  useConversationById,
  useDeleteConversation,
  useChatStream,
} from '@/hooks'
import { AppLayout } from '@/components/domain/app-layout'
import { ProfileSelector } from '@/components/domain/profile-selector'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CardSkeleton } from '@/components/ui/skeleton'
import { ToolCallModal } from '@/components/ai-elements/tool-call-modal'
import { PREFERENCE_KEYS } from '@/lib/api'
import type { ChatMessage } from '@/lib/api'
import { Plus, AlertCircle } from 'lucide-react'

import {
  type Step,
  type UIMessage,
  type ThinkingLevel,
  ConversationHistory,
  ChatMessageList,
  ChatInput,
  ChatWelcome,
} from '@/components/chat'

const searchSchema = z.object({
  conversationId: z.string().optional(),
})

export const Route = createFileRoute('/chat')({
  component: ChatPage,
  validateSearch: searchSchema,
})

function ChatPage() {
  const navigate = useNavigate()
  const { conversationId: urlConversationId } = Route.useSearch()
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isSendingRef = useRef(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Local messages state for optimistic updates
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [isReasoningStreaming, setIsReasoningStreaming] = useState(false)

  // Tool call modal state
  const [toolCallModal, setToolCallModal] = useState<{
    open: boolean
    toolName: string
    args: unknown
    result: unknown
  }>({ open: false, toolName: '', args: null, result: null })

  // Track active conversation ID locally
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    urlConversationId
  )

  // Sync local state when URL changes
  useEffect(() => {
    setActiveConversationId(urlConversationId)
  }, [urlConversationId])

  // Profiles and preferences
  const { defaultProfile } = useAuth()
  const { data: preferences } = usePreferences()
  const setPreference = useSetPreference()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  const activeProfileId = selectedProfileId || defaultProfile?.id

  // Chat config
  const { data: chatConfig, isLoading: configLoading } = useChatConfig()

  // Selected provider and model from preferences or defaults
  const selectedProvider =
    (preferences?.[PREFERENCE_KEYS.CHAT_PROVIDER] as string | undefined) ||
    chatConfig?.defaultProvider ||
    'openai'
  const selectedModel =
    (preferences?.[PREFERENCE_KEYS.CHAT_MODEL] as string | undefined) ||
    chatConfig?.defaultModel ||
    'gpt-4o'
  const thinkingLevel =
    (preferences?.[PREFERENCE_KEYS.CHAT_THINKING_LEVEL] as ThinkingLevel | undefined) || 'off'

  const currentProvider = chatConfig?.providers.find((p) => p.id === selectedProvider)
  const currentModel = currentProvider?.models.find((m) => m.id === selectedModel)

  // Conversations
  const { data: conversations, isLoading: conversationsLoading } = useConversations(activeProfileId)
  const createConversation = useCreateConversation()
  const deleteConversation = useDeleteConversation()

  const { data: conversation } = useConversationById(
    isSendingRef.current ? undefined : urlConversationId
  )

  const chatStream = useChatStream(activeConversationId, activeProfileId)

  // Load messages from conversation
  useEffect(() => {
    if (conversation?.messages && !isSendingRef.current) {
      const loadedMessages: UIMessage[] = conversation.messages.map((msg: ChatMessage) => {
        const steps: Step[] = (msg.reasoning || []).map((r) => {
          if (r.type === 'reasoning') {
            return { type: 'reasoning' as const, content: r.content }
          } else if (r.type === 'tool-call') {
            return {
              type: 'tool-call' as const,
              toolCallId: r.toolCallId,
              toolName: r.toolName,
              args: r.args,
            }
          } else {
            return { type: 'text' as const, content: r.content }
          }
        })

        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'tool',
          content: msg.content || '',
          steps,
          toolCalls: msg.toolCalls || undefined,
          toolResults: msg.toolResults || undefined,
        }
      })
      setMessages(loadedMessages)
    } else if (!urlConversationId) {
      setMessages([])
    }
  }, [conversation?.messages, urlConversationId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatStream.currentText])

  // Handle model change
  const handleModelSelect = useCallback(
    (providerId: string, modelId: string) => {
      if (selectedProvider !== providerId) {
        setPreference.mutate({ key: PREFERENCE_KEYS.CHAT_PROVIDER, value: providerId })
      }
      setPreference.mutate({ key: PREFERENCE_KEYS.CHAT_MODEL, value: modelId })
    },
    [selectedProvider, setPreference]
  )

  // Handle thinking level change
  const handleThinkingLevelChange = useCallback(
    (level: ThinkingLevel) => {
      setPreference.mutate({ key: PREFERENCE_KEYS.CHAT_THINKING_LEVEL, value: level })
    },
    [setPreference]
  )

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || chatStream.isLoading || !activeProfileId) return

    const messageContent = input.trim()
    setInput('')
    isSendingRef.current = true

    let conversationIdToUse = activeConversationId
    if (!conversationIdToUse) {
      try {
        const newConv = await createConversation.mutateAsync(activeProfileId)
        conversationIdToUse = newConv.id
        setActiveConversationId(newConv.id)
        window.history.replaceState(null, '', `/chat?conversationId=${newConv.id}`)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        isSendingRef.current = false
        return
      }
    }

    const userMessage: UIMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: messageContent,
    }

    const assistantMessage: UIMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      steps: [],
      toolCalls: [],
      toolResults: [],
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsReasoningStreaming(true)

    const thinkingEnabled = thinkingLevel !== 'off' && currentModel?.supportsThinking
    const thinkingOptions: {
      thinkingEnabled?: boolean
      thinkingBudget?: number
      reasoningEffort?: 'low' | 'medium' | 'high'
      thinkingLevel?: 'low' | 'medium' | 'high'
    } = {}

    if (thinkingEnabled) {
      thinkingOptions.thinkingEnabled = true

      const budgetMap: Record<ThinkingLevel, number> = {
        off: 0,
        low: 5000,
        medium: 10000,
        high: 20000,
      }

      if (selectedProvider === 'vercel') {
        thinkingOptions.thinkingBudget = budgetMap[thinkingLevel]
        thinkingOptions.reasoningEffort = thinkingLevel as 'low' | 'medium' | 'high'
        thinkingOptions.thinkingLevel = thinkingLevel as 'low' | 'medium' | 'high'
      } else if (selectedProvider === 'anthropic') {
        thinkingOptions.thinkingBudget = budgetMap[thinkingLevel]
      } else if (selectedProvider === 'openai') {
        thinkingOptions.reasoningEffort = thinkingLevel as 'low' | 'medium' | 'high'
      } else if (selectedProvider === 'google') {
        thinkingOptions.thinkingLevel = thinkingLevel as 'low' | 'medium' | 'high'
      }
    }

    try {
      await chatStream.sendMessage(messageContent, {
        provider: selectedProvider,
        model: selectedModel,
        conversationId: conversationIdToUse,
        ...thinkingOptions,
      })
    } finally {
      isSendingRef.current = false
      setIsReasoningStreaming(false)
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationIdToUse] })
      queryClient.invalidateQueries({ queryKey: ['conversations', activeProfileId] })
    }
  }, [
    input,
    chatStream,
    activeConversationId,
    activeProfileId,
    selectedProvider,
    selectedModel,
    thinkingLevel,
    currentModel,
    queryClient,
    createConversation,
  ])

  // Handle new chat
  const handleNewChat = useCallback(() => {
    chatStream.resetState()
    setMessages([])
    setActiveConversationId(undefined)
    navigate({ to: '/chat', search: {}, replace: true })
  }, [chatStream, navigate])

  // Handle selecting a conversation
  const handleSelectConversation = useCallback(
    (convId: string) => {
      chatStream.resetState()
      setMessages([])
      setActiveConversationId(convId)
      setHistoryOpen(false)
      navigate({ to: '/chat', search: { conversationId: convId }, replace: true })
    },
    [chatStream, navigate]
  )

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(
    async (convId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      await deleteConversation.mutateAsync(convId)
      if (convId === urlConversationId) {
        handleNewChat()
      }
    },
    [deleteConversation, urlConversationId, handleNewChat]
  )

  // Handle tool call click
  const handleToolCallClick = useCallback((toolName: string, args: unknown, result: unknown) => {
    setToolCallModal({ open: true, toolName, args, result })
  }, [])

  // Loading state
  if (configLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader title="Ask Penny" description="Your wise financial companion" />
          <CardSkeleton />
        </div>
      </AppLayout>
    )
  }

  // Not configured state
  if (!chatConfig?.isConfigured) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageHeader title="Ask Penny" description="Your wise financial companion" />
          <EmptyState
            icon={AlertCircle}
            title="Chat Not Configured"
            description="Please configure your LLM provider in settings to use the chat feature."
            action={{ label: 'Go to Settings', href: '/settings/llm' }}
          />
        </div>
      </AppLayout>
    )
  }

  const isNewChat = !urlConversationId
  const hasMessages = messages.length > 0 || chatStream.steps.length > 0 || chatStream.currentText
  const showWelcome = isNewChat && !hasMessages

  // Build stream state for child components
  const streamState = {
    steps: chatStream.steps,
    currentText: chatStream.currentText,
    currentReasoning: chatStream.currentReasoning,
    isLoading: chatStream.isLoading,
    toolCalls: chatStream.toolCalls,
    error: chatStream.error,
  }

  // Handle selecting a prompt from welcome screen
  const handleSelectPrompt = (prompt: string) => {
    setInput(prompt)
  }

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-4rem)]">
        {/* Header - only show when not in welcome state */}
        {!showWelcome && (
          <div className="flex flex-col gap-6 pb-48">
            <PageHeader
              title="Ask Penny"
              description="Your wise financial companion"
              actions={
                <>
                  <ProfileSelector
                    selectedProfileId={activeProfileId || null}
                    onProfileChange={(profile) => setSelectedProfileId(profile.id)}
                  />
                  <ConversationHistory
                    open={historyOpen}
                    onOpenChange={setHistoryOpen}
                    conversations={conversations}
                    isLoading={conversationsLoading}
                    currentConversationId={urlConversationId}
                    onSelectConversation={handleSelectConversation}
                    onDeleteConversation={handleDeleteConversation}
                  />
                  {!isNewChat && (
                    <Button variant="outline" onClick={handleNewChat}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Chat
                    </Button>
                  )}
                </>
              }
            />

            {/* Messages */}
            <div className="space-y-6 w-full">
              <ChatMessageList
                ref={messagesEndRef}
                messages={messages}
                isReasoningStreaming={isReasoningStreaming}
                streamState={streamState}
                onToolCallClick={handleToolCallClick}
              />
            </div>
          </div>
        )}

        {/* Welcome screen for empty state */}
        {showWelcome && (
          <div className="pb-48">
            {/* Minimal header for welcome state */}
            <div className="flex items-center justify-end gap-2 mb-4">
              <ProfileSelector
                selectedProfileId={activeProfileId || null}
                onProfileChange={(profile) => setSelectedProfileId(profile.id)}
              />
              <ConversationHistory
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                conversations={conversations}
                isLoading={conversationsLoading}
                currentConversationId={urlConversationId}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
              />
            </div>
            <ChatWelcome onSelectPrompt={handleSelectPrompt} />
          </div>
        )}

        {/* Input */}
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSendMessage}
          isLoading={chatStream.isLoading}
          onCancel={chatStream.cancel}
          providers={chatConfig?.providers || []}
          currentProvider={currentProvider}
          currentModel={currentModel}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onModelSelect={handleModelSelect}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={handleThinkingLevelChange}
        />
      </div>

      {/* Tool Call Modal */}
      <ToolCallModal
        open={toolCallModal.open}
        onOpenChange={(open) => setToolCallModal((prev) => ({ ...prev, open }))}
        toolName={toolCallModal.toolName}
        args={toolCallModal.args}
        result={toolCallModal.result}
      />
    </AppLayout>
  )
}
