import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  getStatementsByUserId,
  getStatementById,
  getStatementStatus,
  createStatement,
  deleteStatement,
  queueStatements,
  type StatementInput,
} from '../services/statements'
import { getAccountByIdRaw } from '../services/accounts'
import { getProfileById } from '../services/profiles'
import { findUserById } from '../services/user'
import { extractPdfText, extractCsvText, extractXlsxText } from '../lib/file-parser'
import type { FileType } from '../lib/constants'
import { decryptOptional } from '../lib/encryption'
import { SUPPORTED_FILE_TYPES, type CountryCode } from '../lib/constants'
import { logger } from '../lib/logger'

const statementRoutes = new Hono<{ Variables: AuthVariables }>()

statementRoutes.use('*', auth())

/**
 * GET /statements
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
 * Upload one or more statement files
 * Form data: files[] (or file for single), profileId, documentType, accountId, sourceType, password, parsingModel, categorizationModel
 */
statementRoutes.post('/upload', async (c) => {
  const userId = c.get('userId')

  try {
    const formData = await c.req.formData()

    // Support both single file and multiple files
    const singleFile = formData.get('file') as File | null
    const multipleFiles = formData.getAll('files') as File[]
    const files = singleFile ? [singleFile] : multipleFiles

    const profileId = formData.get('profileId') as string | null
    const documentType = formData.get('documentType') as
      | 'bank_statement'
      | 'investment_statement'
      | null
    const accountId = formData.get('accountId') as string | null
    const sourceType = formData.get('sourceType') as string | null
    const password = formData.get('password') as string | null
    const savePassword = formData.get('savePassword') === 'true'
    const parsingModel = formData.get('parsingModel') as string | null
    const categorizationModel = formData.get('categorizationModel') as string | null

    // Validate
    if (!files || files.length === 0) {
      return c.json({ error: 'validation_error', message: 'At least one file is required' }, 400)
    }
    if (!profileId) {
      return c.json({ error: 'validation_error', message: 'Profile ID is required' }, 400)
    }

    const profile = await getProfileById(profileId, userId)
    if (!profile) {
      return c.json({ error: 'not_found', message: 'Profile not found' }, 404)
    }

    const user = await findUserById(userId)
    if (!user || !user.country) {
      return c.json({ error: 'validation_error', message: 'User country not set' }, 400)
    }

    // Process all files
    const statements: StatementInput[] = []
    const statementIds: string[] = []
    const errors: Array<{ filename: string; error: string }> = []

    for (const file of files) {
      // Validate file type
      const filename = file.name.toLowerCase()
      let fileType: FileType | null = null

      if (filename.endsWith('.pdf')) fileType = 'pdf'
      else if (filename.endsWith('.csv')) fileType = 'csv'
      else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) fileType = 'xlsx'

      if (!fileType || !SUPPORTED_FILE_TYPES.includes(fileType)) {
        errors.push({ filename: file.name, error: 'Unsupported file type' })
        continue
      }

      // Read file
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Extract text
      let pages: string[] = []
      let usedPassword: string | null = null

      try {
        if (fileType === 'pdf') {
          let passwordToUse = password || undefined
          let triedSavedPassword = false

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
            if (message === 'PASSWORD_REQUIRED') {
              // For single file, return password required error
              if (files.length === 1) {
                return c.json(
                  {
                    error: 'password_required',
                    message: triedSavedPassword
                      ? 'The saved password did not work. Please enter the correct password.'
                      : 'This PDF is password protected. Please provide the password.',
                    passwordRequired: true,
                    triedSavedPassword,
                  },
                  422
                )
              }
              errors.push({ filename: file.name, error: 'Password protected' })
              continue
            }
            throw error
          }
        } else if (fileType === 'csv') {
          const text = await extractCsvText(buffer)
          pages = [text]
        } else if (fileType === 'xlsx') {
          let passwordToUse = password || undefined

          if (!passwordToUse && accountId) {
            const account = await getAccountByIdRaw(accountId, userId)
            if (account?.statementPassword) {
              const savedPassword = decryptOptional(account.statementPassword)
              if (savedPassword) passwordToUse = savedPassword
            }
          }

          try {
            pages = await extractXlsxText(buffer, passwordToUse)
            if (passwordToUse) usedPassword = passwordToUse
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            if (message === 'PASSWORD_REQUIRED') {
              if (files.length === 1) {
                return c.json(
                  {
                    error: 'password_required',
                    message: 'This Excel file is password protected. Please provide the password.',
                    passwordRequired: true,
                  },
                  422
                )
              }
              errors.push({ filename: file.name, error: 'Password protected' })
              continue
            }
            throw error
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push({ filename: file.name, error: message })
        continue
      }

      if (pages.length === 0 || pages.every((p) => p.trim() === '')) {
        errors.push({ filename: file.name, error: 'Could not extract text from file' })
        continue
      }

      // Create statement record
      const statement = await createStatement({
        accountId: accountId || null,
        profileId,
        userId,
        originalFilename: file.name,
        fileType,
        fileSizeBytes: buffer.length,
        documentType: documentType || undefined,
      })

      statements.push({
        statementId: statement.id,
        profileId,
        userId,
        pages,
        fileType,
        documentType: documentType || undefined,
        sourceType: sourceType || undefined,
        parsingModel: parsingModel || undefined,
        password: usedPassword || undefined,
        savePassword: savePassword && !!usedPassword,
      })
      statementIds.push(statement.id)
    }

    // If no valid files, return error
    if (statements.length === 0) {
      return c.json(
        {
          error: 'validation_error',
          message: 'No valid files to process',
          errors,
        },
        400
      )
    }

    // Queue all statements for processing (async)
    queueStatements({
      statements,
      countryCode: user.country as CountryCode,
      categorizationModel: categorizationModel || undefined,
    })

    logger.debug(`[Statement] Uploaded ${statements.length} files, queued for processing`)

    return c.json(
      {
        statementIds,
        status: 'pending',
        processedCount: statements.length,
        errors: errors.length > 0 ? errors : undefined,
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
