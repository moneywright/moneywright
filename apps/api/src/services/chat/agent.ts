/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * AI Chat Agent Service
 *
 * Creates and manages AI agent instances for financial chat.
 * Uses Vercel AI SDK v6 with ToolLoopAgent for multi-step tool calling.
 */

import { ToolLoopAgent, stepCountIs, wrapLanguageModel, type ModelMessage } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'
import { createLLMClient, type LLMConfig } from '../../llm'
import { buildSystemPrompt } from './prompt'
import { createTools } from './tools'
import type { AIProvider, ThinkingConfig } from './types'
import { logger } from '../../lib/logger'
import type { LLMProvider } from '../../lib/ai'

/**
 * Check if a model is Gemini 3 (uses thinkingLevel) vs Gemini 2.5 (uses thinkingBudget)
 */
function isGemini3Model(modelId: string): boolean {
  return modelId.includes('gemini-3-')
}

/**
 * Build Google thinking config based on model version
 */
function buildGoogleThinkingConfig(
  modelId: string,
  thinking: ThinkingConfig
): Record<string, unknown> {
  const defaultBudget = 10000

  if (isGemini3Model(modelId)) {
    return {
      thinkingConfig: {
        thinkingLevel: thinking.thinkingLevel || 'medium',
        includeThoughts: true,
      },
    }
  } else {
    return {
      thinkingConfig: {
        thinkingBudget: thinking.budgetTokens || defaultBudget,
        includeThoughts: true,
      },
    }
  }
}

/**
 * Build provider options for thinking/reasoning based on provider type
 */
function buildProviderOptions(
  provider: AIProvider,
  modelId: string,
  thinking?: ThinkingConfig
): Record<string, unknown> | undefined {
  if (!thinking?.enabled) return undefined

  const defaultBudget = 10000

  switch (provider) {
    case 'openai':
      return {
        openai: {
          reasoningEffort: thinking.reasoningEffort || 'medium',
          reasoningSummary: 'auto',
        },
      }
    case 'anthropic':
      return {
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: thinking.budgetTokens || defaultBudget,
          },
        },
      }
    case 'google':
      return {
        google: buildGoogleThinkingConfig(modelId, thinking),
      }
    case 'vercel':
      // For Vercel AI Gateway, pass options for ALL providers
      // The gateway will route to the correct one based on model ID
      // Model IDs are in format "provider/model" e.g. "openai/gpt-5-mini"
      return {
        openai: {
          reasoningEffort: thinking.reasoningEffort || 'medium',
          reasoningSummary: 'auto',
        },
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: thinking.budgetTokens || defaultBudget,
          },
        },
        google: buildGoogleThinkingConfig(modelId, thinking),
      }
    default:
      return undefined
  }
}

/**
 * Maximum number of tool execution steps
 * Prevents infinite loops in agentic behavior
 */
const MAX_STEPS = 10

/**
 * Check if DevTools should be enabled (development only)
 */
const isDevToolsEnabled = process.env.APP_ENV === 'development'

/**
 * Create an AI agent for financial chat
 *
 * Uses ToolLoopAgent for multi-step tool calling with automatic
 * reasoning-and-acting loop.
 */
export function createChatAgent(options: {
  provider: AIProvider
  model: string
  apiKey?: string
  profileId: string
  userId: string
  profileSummary?: string
  thinking?: ThinkingConfig
  countryCode?: 'IN' | 'US'
}) {
  const {
    provider,
    model: modelId,
    apiKey,
    profileId,
    userId,
    profileSummary,
    thinking,
    countryCode = 'IN',
  } = options

  logger.debug(
    `[Chat Agent] Creating agent for provider=${provider}, model=${modelId}, profileId=${profileId}, thinking=${thinking?.enabled}`
  )

  // Create the model instance using existing LLM factory
  logger.debug(`[Chat Agent] Creating model instance...`)
  const llmConfig: Partial<LLMConfig> = {
    provider: provider as LLMProvider,
    model: modelId,
  }
  if (apiKey) {
    llmConfig.apiKey = apiKey
  }
  let model = createLLMClient(llmConfig)

  // Wrap with DevTools middleware in development mode
  if (isDevToolsEnabled) {
    model = wrapLanguageModel({
      model: model as any,
      middleware: devToolsMiddleware(),
    }) as any
    logger.debug(`[Chat Agent] Model wrapped with DevTools middleware`)
  }
  logger.debug(`[Chat Agent] Model instance created`)

  // Create tools bound to this profile
  logger.debug(`[Chat Agent] Creating tools for profile ${profileId}...`)
  const tools = createTools({ profileId, userId })
  logger.debug(`[Chat Agent] Tools created: ${Object.keys(tools).join(', ')}`)

  // Build system prompt with profile context and country-specific categories
  logger.debug(`[Chat Agent] Building system prompt for country=${countryCode}...`)
  const instructions = buildSystemPrompt(profileSummary, countryCode)
  logger.debug(`[Chat Agent] System prompt built (${instructions.length} chars)`)

  // Build provider options for thinking if enabled
  const providerOptions = buildProviderOptions(provider, modelId, thinking)
  if (providerOptions) {
    logger.debug(`[Chat Agent] Provider options for thinking:`, providerOptions)
  }

  // Create the agent with multi-step capabilities
  logger.debug(`[Chat Agent] Creating ToolLoopAgent with maxSteps=${MAX_STEPS}...`)
  const agent = new ToolLoopAgent({
    model: model as any, // Type assertion for SDK version compatibility
    instructions,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: providerOptions as any,
  })
  logger.debug(`[Chat Agent] Agent created successfully`)

  return agent
}

/**
 * Stream a response from the AI agent
 */
export function streamAgentResponse(options: {
  provider: AIProvider
  model: string
  apiKey?: string
  profileId: string
  userId: string
  messages: ModelMessage[]
  profileSummary?: string
  thinking?: ThinkingConfig
  countryCode?: 'IN' | 'US'
}) {
  const agent = createChatAgent(options)
  return agent.stream({ messages: options.messages })
}

/**
 * Generate a non-streaming response from the AI agent
 */
export async function generateAgentResponse(options: {
  provider: AIProvider
  model: string
  apiKey?: string
  profileId: string
  userId: string
  messages: ModelMessage[]
  profileSummary?: string
  thinking?: ThinkingConfig
  countryCode?: 'IN' | 'US'
}): Promise<{
  text: string
  toolCalls: Array<{ toolName: string; args: unknown; result: unknown }>
  steps: unknown[]
}> {
  const agent = createChatAgent(options)

  const result = await agent.generate({ messages: options.messages })

  // Extract tool calls from all steps
  const allToolCalls: Array<{ toolName: string; args: unknown; result: unknown }> = []

  for (const step of result.steps) {
    for (const toolCall of step.toolCalls) {
      if (toolCall) {
        allToolCalls.push({
          toolName: toolCall.toolName,
          args: toolCall.input,
          result: undefined,
        })
      }
    }
  }

  return {
    text: result.text,
    toolCalls: allToolCalls,
    steps: result.steps,
  }
}
