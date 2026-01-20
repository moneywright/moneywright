import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getStatementsByUserId,
  getStatementById,
  getStatementStatus,
  createStatement,
  deleteStatement,
  queueParseJob,
} from '../services/statements'
import { createAccount, getAccountByIdRaw, updateStatementPassword } from '../services/accounts'
import { getProfileById } from '../services/profiles'
import { findUserById } from '../services/user'
import { extractPdfText, extractCsvText } from '../lib/file-parser'
import { decryptOptional } from '../lib/encryption'
import { SUPPORTED_FILE_TYPES, type CountryCode } from '../lib/constants'
import { logger } from '../lib/logger'

const statementRoutes = new Hono<{ Variables: AuthVariables }>()

// Apply auth to all routes
statementRoutes.use('*', auth())

/**
 * GET /statements
 * List statements for the current user
 * Query params: profileId, accountId
 */
statementRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profileId')
  const accountId = c.req.query('accountId')

  const statements = await getStatementsByUserId(userId, {
    profileId: profileId || undefined,
    accountId: accountId || undefined,
  })

  return c.json({ statements })
})

/**
 * GET /statements/:id
 * Get a specific statement
 */
statementRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const statementId = c.req.param('id')

  const statement = await getStatementById(statementId, userId)

  if (!statement) {
    return c.json({ error: 'not_found', message: 'Statement not found' }, 404)
  }

  return c.json({ statement })
})

/**
 * GET /statements/:id/status
 * Get parsing status (for polling)
 */
statementRoutes.get('/:id/status', async (c) => {
  const userId = c.get('userId')
  const statementId = c.req.param('id')

  const status = await getStatementStatus(statementId, userId)

  if (!status) {
    return c.json({ error: 'not_found', message: 'Statement not found' }, 404)
  }

  return c.json(status)
})

/**
 * POST /statements/upload
 * Upload a statement file
 * Form data: file, profileId, accountId (optional), password (optional)
 */
statementRoutes.post('/upload', async (c) => {
  const userId = c.get('userId')

  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const profileId = formData.get('profileId') as string | null
    const accountId = formData.get('accountId') as string | null
    const password = formData.get('password') as string | null
    const savePassword = formData.get('savePassword') === 'true'
    const parsingModel = formData.get('parsingModel') as string | null
    const categorizationModel = formData.get('categorizationModel') as string | null

    // Validate file
    if (!file) {
      return c.json({ error: 'validation_error', message: 'File is required' }, 400)
    }

    // Validate profileId
    if (!profileId) {
      return c.json({ error: 'validation_error', message: 'Profile ID is required' }, 400)
    }

    // Verify profile belongs to user
    const profile = await getProfileById(profileId, userId)
    if (!profile) {
      return c.json({ error: 'not_found', message: 'Profile not found' }, 404)
    }

    // Get user for country code
    const user = await findUserById(userId)
    if (!user || !user.country) {
      return c.json({ error: 'validation_error', message: 'User country not set' }, 400)
    }

    // Validate file type
    const filename = file.name.toLowerCase()
    let fileType: string | null = null

    if (filename.endsWith('.pdf')) {
      fileType = 'pdf'
    } else if (filename.endsWith('.csv')) {
      fileType = 'csv'
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      fileType = 'xlsx'
    }

    if (
      !fileType ||
      !SUPPORTED_FILE_TYPES.includes(fileType as (typeof SUPPORTED_FILE_TYPES)[number])
    ) {
      return c.json(
        { error: 'validation_error', message: 'Unsupported file type. Supported: PDF, CSV, XLSX' },
        400
      )
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from file
    let pages: string[] = []
    let usedPassword: string | null = null

    if (fileType === 'pdf') {
      // Try to extract text, handling password-protected PDFs
      let passwordToUse = password || undefined
      let triedSavedPassword = false

      // If no password provided, try saved account password
      if (!passwordToUse && accountId) {
        const account = await getAccountByIdRaw(accountId, userId)
        if (account?.statementPassword) {
          const savedPassword = decryptOptional(account.statementPassword)
          if (savedPassword) {
            passwordToUse = savedPassword
            triedSavedPassword = true
          }
        }
      }

      try {
        pages = await extractPdfText(buffer, passwordToUse)
        if (passwordToUse) usedPassword = passwordToUse
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        // Check if password is required
        if (message === 'PASSWORD_REQUIRED') {
          // If we tried a saved password and it failed, indicate that
          const errorMessage = triedSavedPassword
            ? 'The saved password did not work for this PDF. Please enter the correct password.'
            : 'This PDF is password protected. Please provide the password.'

          return c.json(
            {
              error: 'password_required',
              message: errorMessage,
              passwordRequired: true,
              triedSavedPassword,
            },
            422
          )
        }

        throw error
      }
    } else if (fileType === 'csv') {
      const text = await extractCsvText(buffer)
      pages = [text]
    } else {
      // TODO: Handle XLSX
      return c.json({ error: 'not_implemented', message: 'XLSX parsing not yet implemented' }, 501)
    }

    if (pages.length === 0 || pages.every((p) => p.trim() === '')) {
      return c.json({ error: 'parse_error', message: 'Could not extract text from file' }, 400)
    }

    // Determine account ID
    let finalAccountId = accountId
    let isNewAccount = false

    // If no account provided, we'll create one during parsing
    // For now, create a placeholder account
    if (!finalAccountId) {
      // Create a temporary account - will be updated with real info during parsing
      const tempAccount = await createAccount({
        profileId,
        userId,
        type: 'other',
        institution: null,
        accountNumber: null,
        accountName: `Pending - ${file.name}`,
        currency: user.country === 'IN' ? 'INR' : 'USD',
      })
      finalAccountId = tempAccount.id
      isNewAccount = true
    } else {
      // Verify account belongs to user
      const account = await getAccountByIdRaw(finalAccountId, userId)
      if (!account) {
        return c.json({ error: 'not_found', message: 'Account not found' }, 404)
      }
    }

    // Save password if user opted to save it and it was successfully used
    if (usedPassword && savePassword) {
      await updateStatementPassword(finalAccountId, userId, usedPassword)
      logger.info(`[Statement] Saved password for account ${finalAccountId}`)
    }

    // Create statement record
    const statement = await createStatement({
      accountId: finalAccountId,
      profileId,
      userId,
      originalFilename: file.name,
      fileType,
      fileSizeBytes: buffer.length,
    })

    // Queue parsing job
    const jobId = queueParseJob({
      statementId: statement.id,
      profileId,
      userId,
      countryCode: user.country as CountryCode,
      pages,
      parsingModel: parsingModel || undefined,
      categorizationModel: categorizationModel || undefined,
    })

    logger.info(`[Statement] Uploaded ${file.name}, queued job ${jobId}`)

    return c.json(
      {
        statementId: statement.id,
        accountId: finalAccountId,
        isNewAccount,
        status: 'pending',
        jobId,
      },
      202
    )
  } catch (error) {
    logger.error('[Statement] Upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload statement'
    return c.json({ error: 'upload_failed', message }, 500)
  }
})

/**
 * DELETE /statements/:id
 * Delete a statement
 */
statementRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const statementId = c.req.param('id')

  try {
    await deleteStatement(statementId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete statement'

    if (message === 'Statement not found') {
      return c.json({ error: 'not_found', message }, 404)
    }

    return c.json({ error: 'delete_failed', message }, 400)
  }
})

export default statementRoutes
