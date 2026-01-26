/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Chat Routes
 *
 * Endpoints for AI chat conversations and streaming responses.
 * All routes require authentication.
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { eq } from 'drizzle-orm'
import { db, tables, dbType } from '../db'
import { auth, type AuthVariables } from '../middleware/auth'
import { getLLMSettings } from '../services/config'
import { AI_PROVIDERS, type LLMProvider } from '../lib/ai'
import { logger } from '../lib/logger'
import { getProfileById } from '../services/profiles'
import { findUserById } from '../services/user'

import {
  storedToModelMessages,
  createChatAgent,
  type StoredMessage,
  type ThinkingConfig,
  type ReasoningEffort,
  listConversations,
  createConversation,
  getOrCreateConversation,
  getConversation,
  getConversationMessages,
  addMessage,
  updateMessage,
  clearConversation,
  deleteConversation,
  toStoredMessages,
} from '../services/chat'
import { getQueryData, getQueryMetadata } from '../services/chat/query-cache'

const chat = new Hono<{ Variables: AuthVariables }>()

// Apply auth middleware to all routes
chat.use('*', auth())

// ============================================================================
// Conversation Endpoints
// ============================================================================

/**
 * GET /api/chat/profiles/:profileId/conversations
 * List all conversations for a profile
 */
chat.get('/profiles/:profileId/conversations', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('profileId')

  // Verify profile ownership
  const profile = await getProfileById(profileId, userId)
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  const conversations = await listConversations(profileId, userId)
  return c.json(conversations)
})

/**
 * GET /api/chat/query/:queryId
 * Fetch full query data for displaying in data-table components
 * Returns the cached query results for rendering interactive tables
 */
chat.get('/query/:queryId', async (c) => {
  const userId = c.get('userId')
  const queryId = c.req.param('queryId')

  // Get query metadata first to validate
  const metadata = await getQueryMetadata(queryId)
  if (!metadata) {
    return c.json({ error: 'Query not found or expired' }, 404)
  }

  // Get the full data
  const data = await getQueryData(queryId)
  if (!data) {
    return c.json({ error: 'Query data not found or expired' }, 404)
  }

  return c.json({
    queryId,
    dataType: metadata.dataType,
    count: metadata.count,
    schema: metadata.schema,
    data,
  })
})

/**
 * POST /api/chat/profiles/:profileId/conversations
 * Create a new conversation for a profile
 */
chat.post('/profiles/:profileId/conversations', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('profileId')

  // Verify profile ownership
  const profile = await getProfileById(profileId, userId)
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  const conversation = await createConversation(profileId, userId)
  return c.json(conversation, 201)
})

/**
 * GET /api/chat/profiles/:profileId/conversation
 * Get or create conversation for a profile (legacy - returns most recent)
 */
chat.get('/profiles/:profileId/conversation', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('profileId')

  // Verify profile ownership
  const profile = await getProfileById(profileId, userId)
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  const conversation = await getOrCreateConversation(profileId, userId)

  // Get messages
  const messages = await getConversationMessages(conversation.id, userId)

  return c.json({
    ...conversation,
    messages,
  })
})

/**
 * GET /api/chat/conversations/:id
 * Get a specific conversation with messages
 */
chat.get('/conversations/:id', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  const conversation = await getConversation(conversationId, userId)
  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404)
  }

  const messages = await getConversationMessages(conversationId, userId)

  return c.json({
    ...conversation,
    messages,
  })
})

/**
 * DELETE /api/chat/conversations/:id
 * Delete a conversation entirely
 */
chat.delete('/conversations/:id', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  try {
    await deleteConversation(conversationId, userId)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Conversation not found' }, 404)
  }
})

/**
 * DELETE /api/chat/conversations/:id/messages
 * Clear all messages in a conversation (but keep the conversation)
 */
chat.delete('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  try {
    await clearConversation(conversationId, userId)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Conversation not found' }, 404)
  }
})

// ============================================================================
// Streaming Message Endpoint
// ============================================================================

/**
 * POST /api/chat/conversations/:id/messages
 * Send a message and stream the AI response
 */
chat.post('/conversations/:id/messages', async (c) => {
  const userId = c.get('userId')
  const conversationId = c.req.param('id')

  const body = await c.req.json<{
    content: string
    provider: LLMProvider
    model: string
    thinkingEnabled?: boolean
    thinkingBudget?: number
    reasoningEffort?: ReasoningEffort
    thinkingLevel?: 'low' | 'medium' | 'high'
  }>()

  const {
    content,
    provider,
    model,
    thinkingEnabled,
    thinkingBudget,
    reasoningEffort,
    thinkingLevel,
  } = body

  // Build thinking config if enabled
  const thinking: ThinkingConfig | undefined = thinkingEnabled
    ? {
        enabled: true,
        budgetTokens: thinkingBudget,
        reasoningEffort: reasoningEffort,
        thinkingLevel: thinkingLevel,
      }
    : undefined

  if (!content || !provider || !model) {
    return c.json({ error: 'Content, provider, and model are required' }, 400)
  }

  // Get conversation and verify ownership
  const conversation = await getConversation(conversationId, userId)

  if (!conversation) {
    return c.json({ error: 'Conversation not found' }, 404)
  }

  // Get LLM settings to find API key
  const settings = await getLLMSettings()
  let apiKey: string | undefined

  switch (provider) {
    case 'openai':
      apiKey = settings.openaiApiKey || undefined
      break
    case 'anthropic':
      apiKey = settings.anthropicApiKey || undefined
      break
    case 'google':
      apiKey = settings.googleAiApiKey || undefined
      break
    case 'vercel':
      apiKey = settings.vercelApiKey || undefined
      break
    case 'ollama':
      // Ollama doesn't need API key
      break
  }

  if (!apiKey && provider !== 'ollama') {
    return c.json({ error: `No API key configured for ${provider}` }, 400)
  }

  // Save user message
  logger.debug(`[Chat] Received message from user`, {
    conversationId,
    provider,
    model,
    contentLength: content.length,
    thinkingEnabled: thinkingEnabled || false,
  })
  await addMessage(conversationId, {
    role: 'user',
    content,
    provider,
    model,
  })

  // Get profile for context
  const profile = await getProfileById(conversation.profileId, userId)

  // Get user for country code
  const user = await findUserById(userId)
  const countryCode = (user?.country as 'IN' | 'US') || 'IN'

  // Get existing messages for context
  const existingMessages = await getConversationMessages(conversationId, userId)

  // Convert to StoredMessage format
  const storedMessages = toStoredMessages(existingMessages)

  // Convert to ModelMessage format for the agent
  const modelMessages = storedToModelMessages(storedMessages)

  // Create agent and stream response
  const agent = createChatAgent({
    provider: provider as any,
    model,
    apiKey,
    profileId: conversation.profileId,
    userId,
    profileSummary: profile?.summary || undefined,
    thinking,
    countryCode,
  })

  return streamSSE(c, async (stream) => {
    logger.debug(`[Chat] Starting LLM stream`, { conversationId, provider, model })
    const startTime = Date.now()
    let assistantContent = ''
    const toolCalls: unknown[] = []
    const toolResults: unknown[] = []
    // Track steps in order (reasoning, tool calls, and text interleaved)
    const steps: Array<
      | { type: 'reasoning'; content: string }
      | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
      | { type: 'text'; content: string }
    > = []

    try {
      const streamResult = await agent.stream({ messages: modelMessages })

      for await (const event of streamResult.fullStream) {
        const eventType = (event as any).type as string

        // Handle reasoning/thinking events (unified across providers)
        // AI SDK uses 'reasoning-delta' for streaming reasoning content
        if (eventType === 'reasoning-delta' || eventType === 'reasoning') {
          const reasoningEvent = event as any
          const text = reasoningEvent.textDelta || reasoningEvent.text || reasoningEvent.delta || ''
          if (text) {
            // Add to steps array - append to last reasoning step or create new one
            const lastStep = steps[steps.length - 1]
            if (lastStep?.type === 'reasoning') {
              lastStep.content += text
            } else {
              steps.push({ type: 'reasoning', content: text })
            }
            await stream.writeSSE({
              event: 'reasoning',
              data: JSON.stringify({ text }),
            })
          }
        } else if (eventType === 'text-delta') {
          const textEvent = event as { type: 'text-delta'; text: string }
          assistantContent += textEvent.text

          const lastStep = steps[steps.length - 1]
          if (lastStep?.type === 'text') {
            lastStep.content += textEvent.text
          } else {
            steps.push({ type: 'text', content: textEvent.text })
          }

          await stream.writeSSE({
            event: 'text',
            data: JSON.stringify({ text: textEvent.text }),
          })
        } else if (eventType === 'tool-call') {
          const toolEvent = event as any

          logger.debug(`[Chat] Tool call: ${toolEvent.toolName}`, {
            toolCallId: toolEvent.toolCallId,
            args: toolEvent.input,
          })

          const toolCallData = {
            toolCallId: toolEvent.toolCallId,
            toolName: toolEvent.toolName,
            args: toolEvent.input,
          }
          toolCalls.push(toolCallData)
          steps.push({ type: 'tool-call', ...toolCallData })

          await stream.writeSSE({
            event: 'tool-call',
            data: JSON.stringify(toolCallData),
          })
        } else if (eventType === 'tool-result') {
          const resultEvent = event as any

          logger.debug(`[Chat] Tool result: ${resultEvent.toolName}`, {
            toolCallId: resultEvent.toolCallId,
          })

          toolResults.push({
            toolCallId: resultEvent.toolCallId,
            toolName: resultEvent.toolName,
            result: resultEvent.output,
          })

          await stream.writeSSE({
            event: 'tool-result',
            data: JSON.stringify({
              toolCallId: resultEvent.toolCallId,
              toolName: resultEvent.toolName,
              result: resultEvent.output,
            }),
          })
        } else if (eventType === 'error') {
          logger.error('[Chat] Stream error event:', event)
        }
      }

      // Get final text if needed
      const finalText = await streamResult.text
      if (finalText && !assistantContent) {
        assistantContent = finalText
      }

      // Save assistant message
      await addMessage(conversationId, {
        role: 'assistant',
        content: assistantContent,
        provider,
        model,
        toolCalls: toolCalls.length > 0 ? (toolCalls as any) : null,
        toolResults: toolResults.length > 0 ? (toolResults as any) : null,
        reasoning: steps.length > 0 ? (steps as any) : null,
      })

      const duration = Date.now() - startTime
      logger.debug(`[Chat] LLM stream completed`, {
        conversationId,
        provider,
        model,
        durationMs: duration,
        toolCallCount: toolCalls.length,
        responseLength: assistantContent.length,
        hasReasoning: steps.some((s) => s.type === 'reasoning'),
      })

      await stream.writeSSE({ event: 'done', data: '{}' })
    } catch (error) {
      logger.error('[Chat] Streaming error:', error)
      try {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: error instanceof Error ? error.message : 'An error occurred',
          }),
        })
      } catch {
        // Failed to send error via SSE
      }
    }
  })
})

export default chat
