import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  createLoan,
  getLoanById,
  getLoansByProfile,
  getLoansByUser,
  updateLoan,
  deleteLoan,
  queueLoanDocument,
  type LoanType,
  type CreateLoanInput,
  type UpdateLoanInput,
  type LoanFilters,
} from '../services/loans'
import { getProfileById } from '../services/profiles'
import { extractPdfText } from '../lib/file-parser'
import { logger } from '../lib/logger'

const loanRoutes = new Hono<{ Variables: AuthVariables }>()

loanRoutes.use('*', auth())

/**
 * GET /loans
 * List all loans for user (family view)
 */
loanRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  // Parse query filters
  const loanType = c.req.query('loanType') as LoanType | undefined
  const status = c.req.query('status') as 'active' | 'closed' | undefined
  const parseStatus = c.req.query('parseStatus') as
    | 'pending'
    | 'parsing'
    | 'completed'
    | 'failed'
    | undefined

  const filters: LoanFilters = {}
  if (loanType) filters.loanType = loanType
  if (status) filters.status = status
  if (parseStatus) filters.parseStatus = parseStatus

  const loans = await getLoansByUser(userId, filters)
  return c.json({ loans })
})

/**
 * GET /loans/profiles/:profileId
 * List loans for a specific profile
 */
loanRoutes.get('/profiles/:profileId', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('profileId')

  // Verify profile ownership
  const profile = await getProfileById(profileId, userId)
  if (!profile) {
    return c.json({ error: 'not_found', message: 'Profile not found' }, 404)
  }

  // Parse query filters
  const loanType = c.req.query('loanType') as LoanType | undefined
  const status = c.req.query('status') as 'active' | 'closed' | undefined
  const parseStatus = c.req.query('parseStatus') as
    | 'pending'
    | 'parsing'
    | 'completed'
    | 'failed'
    | undefined

  const filters: LoanFilters = {}
  if (loanType) filters.loanType = loanType
  if (status) filters.status = status
  if (parseStatus) filters.parseStatus = parseStatus

  const loans = await getLoansByProfile(profileId, userId, filters)
  return c.json({ loans })
})

/**
 * GET /loans/:id
 * Get a single loan
 */
loanRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const loanId = c.req.param('id')

  const loan = await getLoanById(loanId, userId)
  if (!loan) {
    return c.json({ error: 'not_found', message: 'Loan not found' }, 404)
  }

  return c.json({ loan })
})

/**
 * POST /loans/upload
 * Upload loan document PDF
 * Form data: file, profileId, loanType (optional hint), parsingModel (optional)
 */
loanRoutes.post('/upload', async (c) => {
  const userId = c.get('userId')

  try {
    const formData = await c.req.formData()

    const file = formData.get('file') as File | null
    const profileId = formData.get('profileId') as string | null
    const loanType = formData.get('loanType') as LoanType | null
    const parsingModel = formData.get('parsingModel') as string | null
    const password = formData.get('password') as string | null

    // Validate required fields
    if (!file) {
      return c.json({ error: 'validation_error', message: 'File is required' }, 400)
    }
    if (!profileId) {
      return c.json({ error: 'validation_error', message: 'Profile ID is required' }, 400)
    }

    // Verify profile ownership
    const profile = await getProfileById(profileId, userId)
    if (!profile) {
      return c.json({ error: 'not_found', message: 'Profile not found' }, 404)
    }

    // Validate file type (only PDF for loans)
    const filename = file.name.toLowerCase()
    if (!filename.endsWith('.pdf')) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Only PDF files are supported for loan documents',
        },
        400
      )
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from PDF
    let pages: string[]
    try {
      pages = await extractPdfText(buffer, password || undefined)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      if (message === 'PASSWORD_REQUIRED') {
        return c.json(
          {
            error: 'password_required',
            message: 'This file is password protected. Please enter the password.',
            passwordRequired: true,
          },
          422
        )
      }
      if (message === 'WRONG_PASSWORD') {
        return c.json(
          {
            error: 'wrong_password',
            message: 'Incorrect password for this PDF.',
            passwordRequired: true,
          },
          422
        )
      }
      throw error
    }

    if (pages.length === 0 || pages.every((p) => p.trim() === '')) {
      return c.json({ error: 'validation_error', message: 'Could not extract text from PDF' }, 400)
    }

    // Create loan record with pending status
    // Use placeholder values that will be updated after parsing
    const loanInput: CreateLoanInput = {
      profileId,
      userId,
      loanType: loanType || 'personal_loan', // Default, will be updated after parsing
      lender: 'Processing...', // Will be updated after parsing
      originalFilename: file.name,
      fileType: 'pdf',
      parseStatus: 'pending',
    }

    const loan = await createLoan(loanInput)

    // Queue for processing
    queueLoanDocument({
      loanId: loan.id,
      userId,
      pages,
      loanTypeHint: loanType || undefined,
      parsingModel: parsingModel || undefined,
    })

    logger.debug(`[Loans] Uploaded loan ${loan.id}, queued for processing`)

    return c.json(
      {
        loanId: loan.id,
        status: 'pending',
        filename: file.name,
      },
      202
    )
  } catch (error) {
    logger.error('[Loans] Upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload loan document'
    return c.json({ error: 'upload_failed', message }, 500)
  }
})

/**
 * PUT /loans/:id
 * Update a loan (manual edits)
 */
loanRoutes.put('/:id', async (c) => {
  const userId = c.get('userId')
  const loanId = c.req.param('id')

  try {
    const body = await c.req.json<UpdateLoanInput>()

    const loan = await updateLoan(loanId, userId, body)
    return c.json({ loan })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update loan'
    if (message === 'Loan not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    logger.error('[Loans] Update error:', error)
    return c.json({ error: 'update_failed', message }, 500)
  }
})

/**
 * DELETE /loans/:id
 * Delete a loan
 */
loanRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const loanId = c.req.param('id')

  try {
    await deleteLoan(loanId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete loan'
    if (message === 'Loan not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    logger.error('[Loans] Delete error:', error)
    return c.json({ error: 'delete_failed', message }, 500)
  }
})

/**
 * GET /loans/:id/payment-history
 * Get payment history for a loan
 */
loanRoutes.get('/:id/payment-history', async (c) => {
  const userId = c.get('userId')
  const loanId = c.req.param('id')

  try {
    const { getLoanPaymentHistory } = await import('../services/entity-linking')
    const payments = await getLoanPaymentHistory(loanId, userId)
    return c.json({ payments })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get payment history'
    return c.json({ error: 'fetch_failed', message }, 400)
  }
})

/**
 * GET /loans/:id/outstanding
 * Get outstanding amount calculation for a loan
 */
loanRoutes.get('/:id/outstanding', async (c) => {
  const userId = c.get('userId')
  const loanId = c.req.param('id')

  try {
    const { calculateLoanOutstanding } = await import('../services/entity-linking')
    const outstanding = await calculateLoanOutstanding(loanId, userId)
    if (!outstanding) {
      return c.json({ error: 'not_found', message: 'Loan not found or principal not set' }, 404)
    }
    return c.json(outstanding)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate outstanding'
    return c.json({ error: 'calculation_failed', message }, 400)
  }
})

export { loanRoutes }
