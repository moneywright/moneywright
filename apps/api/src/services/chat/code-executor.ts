/**
 * E2B Code Executor for Chat
 *
 * Executes Python code in a sandboxed E2B environment for custom data analysis.
 * Supports injecting query data and returning structured results (charts, tables, values).
 */

import { Sandbox } from '@e2b/code-interpreter'
import { logger } from '../../lib/logger'
import { getQueryData, type CacheDataType } from './query-cache'

/**
 * Maximum execution time in milliseconds
 */
const EXECUTION_TIMEOUT_MS = 60000 // 60 seconds (analysis can take longer)

/**
 * Output types supported by code execution
 */
export type CodeOutputType = 'chart' | 'table' | 'value'

/**
 * Chart configuration for Recharts
 */
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'composed'
  data: Array<Record<string, unknown>>
  config: {
    xKey?: string
    yKey?: string | string[]
    title?: string
    colors?: string[]
    stacked?: boolean
  }
}

/**
 * Table output format
 */
export interface TableOutput {
  columns: Array<{ key: string; label: string }>
  rows: Array<Record<string, unknown>>
}

/**
 * Code execution result
 */
export interface CodeExecutionResult {
  success: boolean
  outputType?: CodeOutputType
  chart?: ChartConfig
  table?: TableOutput
  value?: unknown
  error?: string
  executionTimeMs: number
  logs?: string[]
}

/**
 * Check if E2B is configured
 */
export function isE2BConfigured(): boolean {
  return !!process.env.E2B_API_KEY
}

/**
 * Build Python code that injects data variables
 */
function buildDataInjectionCode(dataMap: Map<string, unknown[]>): string {
  const lines: string[] = ['import json', 'import pandas as pd', '', '# Injected data from queries']

  for (const [queryId, data] of dataMap) {
    // Create variable name: data_transactions_xxx -> data_transactions_xxx
    const varName = `data_${queryId}`
    const jsonData = JSON.stringify(data)
    lines.push(`${varName} = json.loads('''${jsonData}''')`)
    lines.push(`df_${queryId} = pd.DataFrame(${varName})`)
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Execute Python code in E2B sandbox
 *
 * @param code - Python code to execute
 * @param queryIds - Query IDs to load data for
 * @param profileId - Profile ID for validation
 * @param outputType - Expected output type
 */
export async function executeCode(options: {
  code: string
  queryIds: string[]
  profileId: string
  outputType: CodeOutputType
}): Promise<CodeExecutionResult> {
  const { code, queryIds, profileId, outputType } = options
  const startTime = Date.now()

  if (!isE2BConfigured()) {
    return {
      success: false,
      error: 'E2B not configured. Set E2B_API_KEY environment variable.',
      executionTimeMs: Date.now() - startTime,
    }
  }

  let sandbox: Sandbox | null = null

  try {
    // Load data for all query IDs
    logger.debug(`[CodeExecutor] Loading data for ${queryIds.length} queries...`)
    const dataMap = new Map<string, unknown[]>()

    for (const queryId of queryIds) {
      const data = await getQueryData(queryId)
      if (!data) {
        return {
          success: false,
          error: `Query ${queryId} not found or expired. Run a query tool first to get fresh data.`,
          executionTimeMs: Date.now() - startTime,
        }
      }
      dataMap.set(queryId, data)
      logger.debug(`[CodeExecutor] Loaded ${data.length} records for ${queryId}`)
    }

    // Create sandbox
    logger.debug('[CodeExecutor] Creating E2B sandbox...')
    sandbox = await Sandbox.create({ timeoutMs: EXECUTION_TIMEOUT_MS })

    // Build the full code with data injection and output handling
    const OUTPUT_MARKER_START = '___CODE_OUTPUT_START___'
    const OUTPUT_MARKER_END = '___CODE_OUTPUT_END___'

    const dataInjection = buildDataInjectionCode(dataMap)

    const fullCode = `
${dataInjection}

# User code
${code}

# Output handling - the code should set 'result' variable
import json

if 'result' not in dir():
    raise ValueError("Code must set a 'result' variable with the output")

# Serialize result
output_json = json.dumps(result, default=str)
print('${OUTPUT_MARKER_START}' + output_json + '${OUTPUT_MARKER_END}')
`

    logger.debug('[CodeExecutor] Executing Python code in sandbox...')
    logger.debug(`[CodeExecutor] Code length: ${fullCode.length} chars`)

    const execution = await sandbox.runCode(fullCode, {
      language: 'python',
      timeoutMs: EXECUTION_TIMEOUT_MS - 10000, // Leave buffer for sandbox operations
    })

    const executionTimeMs = Date.now() - startTime

    // Collect logs
    const logs = [
      ...execution.logs.stdout.map((l) => `[stdout] ${l}`),
      ...execution.logs.stderr.map((l) => `[stderr] ${l}`),
    ]

    // Check for errors
    if (execution.error) {
      logger.error('[CodeExecutor] Execution error:', execution.error)
      return {
        success: false,
        error: `Python error: ${execution.error.name}: ${execution.error.value}`,
        executionTimeMs,
        logs,
      }
    }

    // Extract result from stdout
    const stdout = execution.logs.stdout.join('')
    const startIdx = stdout.indexOf(OUTPUT_MARKER_START)
    const endIdx = stdout.indexOf(OUTPUT_MARKER_END)

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      logger.error('[CodeExecutor] Could not find output markers')
      logger.error('[CodeExecutor] stdout:', stdout.slice(0, 2000))
      return {
        success: false,
        error: 'Code did not produce valid output. Make sure to set the "result" variable.',
        executionTimeMs,
        logs,
      }
    }

    const jsonText = stdout.slice(startIdx + OUTPUT_MARKER_START.length, endIdx)

    // Parse result
    let result: unknown
    try {
      result = JSON.parse(jsonText)
    } catch (parseErr) {
      logger.error('[CodeExecutor] Failed to parse result:', parseErr)
      return {
        success: false,
        error: `Failed to parse output as JSON: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`,
        executionTimeMs,
        logs,
      }
    }

    // Validate and return based on output type
    logger.debug(`[CodeExecutor] Execution completed in ${executionTimeMs}ms`)

    switch (outputType) {
      case 'chart':
        if (!isValidChartConfig(result)) {
          return {
            success: false,
            error:
              'Invalid chart configuration. Expected { type, data, config } with type being bar/line/pie/area.',
            executionTimeMs,
            logs,
          }
        }
        return {
          success: true,
          outputType: 'chart',
          chart: result as ChartConfig,
          executionTimeMs,
          logs,
        }

      case 'table':
        if (!isValidTableOutput(result)) {
          return {
            success: false,
            error: 'Invalid table output. Expected { columns: [{key, label}], rows: [...] }',
            executionTimeMs,
            logs,
          }
        }
        return {
          success: true,
          outputType: 'table',
          table: result as TableOutput,
          executionTimeMs,
          logs,
        }

      case 'value':
      default:
        return {
          success: true,
          outputType: 'value',
          value: result,
          executionTimeMs,
          logs,
        }
    }
  } catch (err) {
    const executionTimeMs = Date.now() - startTime
    logger.error('[CodeExecutor] Error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      executionTimeMs,
    }
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill()
        logger.debug('[CodeExecutor] Sandbox closed')
      } catch (killErr) {
        logger.warn('[CodeExecutor] Failed to close sandbox:', killErr)
      }
    }
  }
}

/**
 * Validate chart configuration
 */
function isValidChartConfig(obj: unknown): obj is ChartConfig {
  if (typeof obj !== 'object' || obj === null) return false

  const chart = obj as Record<string, unknown>

  if (!['bar', 'line', 'pie', 'area', 'composed'].includes(chart.type as string)) return false
  if (!Array.isArray(chart.data)) return false
  if (typeof chart.config !== 'object' || chart.config === null) return false

  return true
}

/**
 * Validate table output
 */
function isValidTableOutput(obj: unknown): obj is TableOutput {
  if (typeof obj !== 'object' || obj === null) return false

  const table = obj as Record<string, unknown>

  if (!Array.isArray(table.columns)) return false
  if (!Array.isArray(table.rows)) return false

  // Validate columns have key and label
  for (const col of table.columns) {
    if (typeof col !== 'object' || col === null) return false
    const c = col as Record<string, unknown>
    if (typeof c.key !== 'string' || typeof c.label !== 'string') return false
  }

  return true
}
