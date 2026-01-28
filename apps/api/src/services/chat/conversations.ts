/**
 * Chat Conversations Service
 *
 * Manages chat conversations and messages in the database.
 */

import { eq, and, desc, sql } from 'drizzle-orm'
import { db, tables, dbType } from '../../db'
import type { ChatConversation, ChatMessage, NewChatMessage } from '../../db'
import { nanoid } from '../../lib/id'
import { createLLMClientFromSettings } from '../../llm'
import { generateText } from 'ai'
import { logger } from '../../lib/logger'
import type { StoredMessage } from './types'
/**
 * Conversation response type
 */
export interface ConversationResponse {
  id: string
  profileId: string | null // null = family view (all profiles)
  userId: string
  title: string | null
  summary: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Message response type
 */
export interface MessageResponse {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  provider: string | null
  model: string | null
  toolCalls: unknown[] | null
  toolResults: unknown[] | null
  reasoning: unknown[] | null
  approvalState: unknown | null
  createdAt: string | Date
}

/**
 * Transform conversation to response format
 */
function toConversationResponse(conv: ChatConversation): ConversationResponse {
  return {
    id: conv.id,
    profileId: conv.profileId,
    userId: conv.userId,
    title: conv.title,
    summary: conv.summary,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  }
}

/**
 * Transform message to response format
 */
function toMessageResponse(msg: ChatMessage): MessageResponse {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role as 'user' | 'assistant' | 'tool',
    content: msg.content,
    provider: msg.provider,
    model: msg.model,
    toolCalls: msg.toolCalls ? JSON.parse(msg.toolCalls) : null,
    toolResults: msg.toolResults ? JSON.parse(msg.toolResults) : null,
    reasoning: msg.reasoning ? JSON.parse(msg.reasoning) : null,
    approvalState: msg.approvalState ? JSON.parse(msg.approvalState) : null,
    createdAt: msg.createdAt,
  }
}

/**
 * List all conversations for a profile (or all family view conversations if profileId is null)
 */
export async function listConversations(
  profileId: string | null,
  userId: string
): Promise<ConversationResponse[]> {
  const conditions = [eq(tables.chatConversations.userId, userId)]

  if (profileId === null) {
    // Family view: only get conversations where profileId is null
    conditions.push(sql`${tables.chatConversations.profileId} IS NULL` as ReturnType<typeof eq>)
  } else {
    // Profile view: get conversations for this profile
    conditions.push(eq(tables.chatConversations.profileId, profileId))
  }

  const conversations = await db
    .select()
    .from(tables.chatConversations)
    .where(and(...conditions))
    .orderBy(desc(tables.chatConversations.updatedAt))

  return conversations.map(toConversationResponse)
}

/**
 * Create a new conversation for a profile (or family view if profileId is null)
 */
export async function createConversation(
  profileId: string | null,
  userId: string
): Promise<ConversationResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [conversation] = await db
    .insert(tables.chatConversations)
    .values({
      profileId,
      userId,
      createdAt: now as Date,
      updatedAt: now as Date,
    })
    .returning()

  if (!conversation) {
    throw new Error('Failed to create conversation')
  }

  return toConversationResponse(conversation)
}

/**
 * Get or create conversation for a profile (or family view if profileId is null)
 */
export async function getOrCreateConversation(
  profileId: string | null,
  userId: string
): Promise<ConversationResponse> {
  // Try to find existing conversation
  const conditions = [eq(tables.chatConversations.userId, userId)]

  if (profileId === null) {
    conditions.push(sql`${tables.chatConversations.profileId} IS NULL` as ReturnType<typeof eq>)
  } else {
    conditions.push(eq(tables.chatConversations.profileId, profileId))
  }

  const [existing] = await db
    .select()
    .from(tables.chatConversations)
    .where(and(...conditions))
    .limit(1)

  if (existing) {
    return toConversationResponse(existing)
  }

  return createConversation(profileId, userId)
}

/**
 * Get conversation by ID
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<ConversationResponse | null> {
  const [conversation] = await db
    .select()
    .from(tables.chatConversations)
    .where(
      and(
        eq(tables.chatConversations.id, conversationId),
        eq(tables.chatConversations.userId, userId)
      )
    )
    .limit(1)

  return conversation ? toConversationResponse(conversation) : null
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<ConversationResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [updated] = await db
    .update(tables.chatConversations)
    .set({
      title,
      updatedAt: now as Date,
    })
    .where(
      and(
        eq(tables.chatConversations.id, conversationId),
        eq(tables.chatConversations.userId, userId)
      )
    )
    .returning()

  if (!updated) {
    throw new Error('Conversation not found')
  }

  return toConversationResponse(updated)
}

/**
 * Generate a short title for a conversation based on the first message
 * This runs asynchronously and doesn't block the response
 *
 * @param conversationId - Conversation to update
 * @param userId - User ID for verification
 * @param userMessage - First message to generate title from
 * @param modelOverride - Model in format "provider:model" (e.g., "openai:gpt-4o")
 */
export async function generateConversationTitle(
  conversationId: string,
  userId: string,
  userMessage: string,
  modelOverride?: string
): Promise<void> {
  try {
    // Check if conversation already has a title
    const conversation = await getConversation(conversationId, userId)
    if (!conversation || conversation.title) {
      return // Already has a title or doesn't exist
    }

    const model = await createLLMClientFromSettings(modelOverride)

    const { text } = await generateText({
      model,
      prompt: `Generate a very short title (3-5 words max) for a conversation that starts with this message. Return ONLY the title, no quotes, no punctuation at the end, no explanation.

Message: "${userMessage.slice(0, 200)}"

Title:`,
    })

    const title = text
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[.!?]$/, '')

    if (title && title.length > 0 && title.length < 100) {
      await updateConversationTitle(conversationId, userId, title)
      logger.debug(`[Chat] Generated title for conversation ${conversationId}: "${title}"`)
    }
  } catch (error) {
    // Don't throw - title generation is non-critical
    logger.error('[Chat] Failed to generate conversation title:', error)
  }
}

/**
 * Get all messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit: number = 100
): Promise<MessageResponse[]> {
  // Verify ownership
  const conversation = await getConversation(conversationId, userId)
  if (!conversation) {
    throw new Error('Conversation not found')
  }

  const messages = await db
    .select()
    .from(tables.chatMessages)
    .where(eq(tables.chatMessages.conversationId, conversationId))
    .orderBy(desc(tables.chatMessages.createdAt))
    .limit(limit)

  // Return in chronological order
  return messages.map(toMessageResponse).reverse()
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  message: {
    role: 'user' | 'assistant' | 'tool'
    content?: string | null
    provider?: string | null
    model?: string | null
    toolCalls?: unknown[] | null
    toolResults?: unknown[] | null
    reasoning?: unknown[] | null
    approvalState?: unknown | null
  }
): Promise<MessageResponse> {
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()

  const [inserted] = await db
    .insert(tables.chatMessages)
    .values({
      id: nanoid(),
      conversationId,
      role: message.role,
      content: message.content || null,
      provider: message.provider || null,
      model: message.model || null,
      toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      toolResults: message.toolResults ? JSON.stringify(message.toolResults) : null,
      reasoning: message.reasoning ? JSON.stringify(message.reasoning) : null,
      approvalState: message.approvalState ? JSON.stringify(message.approvalState) : null,
      createdAt: now as Date,
    } as NewChatMessage)
    .returning()

  if (!inserted) {
    throw new Error('Failed to add message')
  }

  // Update conversation timestamp
  await db
    .update(tables.chatConversations)
    .set({ updatedAt: now as Date })
    .where(eq(tables.chatConversations.id, conversationId))

  return toMessageResponse(inserted)
}

/**
 * Update a message (for adding tool results or approval state)
 */
export async function updateMessage(
  messageId: string,
  updates: {
    content?: string | null
    toolResults?: unknown[] | null
    approvalState?: unknown | null
    reasoning?: unknown[] | null
  }
): Promise<MessageResponse> {
  const updateData: Partial<ChatMessage> = {}

  if (updates.content !== undefined) {
    updateData.content = updates.content
  }
  if (updates.toolResults !== undefined) {
    updateData.toolResults = updates.toolResults ? JSON.stringify(updates.toolResults) : null
  }
  if (updates.approvalState !== undefined) {
    updateData.approvalState = updates.approvalState ? JSON.stringify(updates.approvalState) : null
  }
  if (updates.reasoning !== undefined) {
    updateData.reasoning = updates.reasoning ? JSON.stringify(updates.reasoning) : null
  }

  const [updated] = await db
    .update(tables.chatMessages)
    .set(updateData)
    .where(eq(tables.chatMessages.id, messageId))
    .returning()

  if (!updated) {
    throw new Error('Message not found')
  }

  return toMessageResponse(updated)
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  // Verify ownership
  const conversation = await getConversation(conversationId, userId)
  if (!conversation) {
    throw new Error('Conversation not found')
  }

  // Messages are deleted via cascade
  await db.delete(tables.chatConversations).where(eq(tables.chatConversations.id, conversationId))
}

/**
 * Clear all messages in a conversation (start fresh)
 */
export async function clearConversation(conversationId: string, userId: string): Promise<void> {
  // Verify ownership
  const conversation = await getConversation(conversationId, userId)
  if (!conversation) {
    throw new Error('Conversation not found')
  }

  await db.delete(tables.chatMessages).where(eq(tables.chatMessages.conversationId, conversationId))

  // Reset conversation title and summary
  const now = dbType === 'postgres' ? new Date() : new Date().toISOString()
  await db
    .update(tables.chatConversations)
    .set({
      title: null,
      summary: null,
      summaryUpToMessageId: null,
      updatedAt: now as Date,
    })
    .where(eq(tables.chatConversations.id, conversationId))
}

/**
 * Convert database messages to StoredMessage format for the AI agent
 */
export function toStoredMessages(messages: MessageResponse[]): StoredMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content || '',
    provider: msg.provider as StoredMessage['provider'],
    model: msg.model || undefined,
    toolCalls: msg.toolCalls as StoredMessage['toolCalls'],
    toolResults: msg.toolResults as StoredMessage['toolResults'],
    approvalState: msg.approvalState as StoredMessage['approvalState'],
    reasoning: msg.reasoning ? JSON.stringify(msg.reasoning) : undefined,
  }))
}
