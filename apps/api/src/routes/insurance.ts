import { Hono } from 'hono'
import { auth, type AuthVariables } from '../middleware/auth'
import {
  createPolicy,
  getPolicyById,
  getPoliciesByProfile,
  getPoliciesByUser,
  updatePolicy,
  deletePolicy,
  queueInsuranceDocument,
  type PolicyType,
  type CreatePolicyInput,
  type UpdatePolicyInput,
  type PolicyFilters,
} from '../services/insurance'
import { getProfileById } from '../services/profiles'
import { extractPdfText } from '../lib/file-parser'
import { logger } from '../lib/logger'

const insuranceRoutes = new Hono<{ Variables: AuthVariables }>()

insuranceRoutes.use('*', auth())

/**
 * GET /insurance/policies
 * List all policies for user (family view)
 */
insuranceRoutes.get('/policies', async (c) => {
  const userId = c.get('userId')

  // Parse query filters
  const policyType = c.req.query('policyType') as PolicyType | undefined
  const status = c.req.query('status') as 'active' | 'expired' | 'cancelled' | undefined
  const parseStatus = c.req.query('parseStatus') as
    | 'pending'
    | 'parsing'
    | 'completed'
    | 'failed'
    | undefined

  const filters: PolicyFilters = {}
  if (policyType) filters.policyType = policyType
  if (status) filters.status = status
  if (parseStatus) filters.parseStatus = parseStatus

  const policies = await getPoliciesByUser(userId, filters)
  return c.json({ policies })
})

/**
 * GET /insurance/profiles/:profileId/policies
 * List policies for a specific profile
 */
insuranceRoutes.get('/profiles/:profileId/policies', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('profileId')

  // Verify profile ownership
  const profile = await getProfileById(profileId, userId)
  if (!profile) {
    return c.json({ error: 'not_found', message: 'Profile not found' }, 404)
  }

  // Parse query filters
  const policyType = c.req.query('policyType') as PolicyType | undefined
  const status = c.req.query('status') as 'active' | 'expired' | 'cancelled' | undefined
  const parseStatus = c.req.query('parseStatus') as
    | 'pending'
    | 'parsing'
    | 'completed'
    | 'failed'
    | undefined

  const filters: PolicyFilters = {}
  if (policyType) filters.policyType = policyType
  if (status) filters.status = status
  if (parseStatus) filters.parseStatus = parseStatus

  const policies = await getPoliciesByProfile(profileId, userId, filters)
  return c.json({ policies })
})

/**
 * GET /insurance/policies/:id
 * Get a single policy
 */
insuranceRoutes.get('/policies/:id', async (c) => {
  const userId = c.get('userId')
  const policyId = c.req.param('id')

  const policy = await getPolicyById(policyId, userId)
  if (!policy) {
    return c.json({ error: 'not_found', message: 'Policy not found' }, 404)
  }

  return c.json({ policy })
})

/**
 * POST /insurance/upload
 * Upload insurance policy PDF
 * Form data: file, profileId, policyType (optional hint), parsingModel (optional)
 */
insuranceRoutes.post('/upload', async (c) => {
  const userId = c.get('userId')

  try {
    const formData = await c.req.formData()

    const file = formData.get('file') as File | null
    const profileId = formData.get('profileId') as string | null
    const policyType = formData.get('policyType') as PolicyType | null
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

    // Validate file type (only PDF for insurance)
    const filename = file.name.toLowerCase()
    if (!filename.endsWith('.pdf')) {
      return c.json(
        {
          error: 'validation_error',
          message: 'Only PDF files are supported for insurance policies',
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

    // Create policy record with pending status
    // Use placeholder values that will be updated after parsing
    const policyInput: CreatePolicyInput = {
      profileId,
      userId,
      policyType: policyType || 'life_insurance', // Default, will be updated after parsing
      provider: 'Processing...', // Will be updated after parsing
      originalFilename: file.name,
      fileType: 'pdf',
      parseStatus: 'pending',
    }

    const policy = await createPolicy(policyInput)

    // Queue for processing
    queueInsuranceDocument({
      policyId: policy.id,
      userId,
      pages,
      policyTypeHint: policyType || undefined,
      parsingModel: parsingModel || undefined,
    })

    logger.debug(`[Insurance] Uploaded policy ${policy.id}, queued for processing`)

    return c.json(
      {
        policyId: policy.id,
        status: 'pending',
        filename: file.name,
      },
      202
    )
  } catch (error) {
    logger.error('[Insurance] Upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload policy'
    return c.json({ error: 'upload_failed', message }, 500)
  }
})

/**
 * PUT /insurance/policies/:id
 * Update a policy (manual edits)
 */
insuranceRoutes.put('/policies/:id', async (c) => {
  const userId = c.get('userId')
  const policyId = c.req.param('id')

  try {
    const body = await c.req.json<UpdatePolicyInput>()

    const policy = await updatePolicy(policyId, userId, body)
    return c.json({ policy })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update policy'
    if (message === 'Policy not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    logger.error('[Insurance] Update error:', error)
    return c.json({ error: 'update_failed', message }, 500)
  }
})

/**
 * DELETE /insurance/policies/:id
 * Delete a policy
 */
insuranceRoutes.delete('/policies/:id', async (c) => {
  const userId = c.get('userId')
  const policyId = c.req.param('id')

  try {
    await deletePolicy(policyId, userId)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete policy'
    if (message === 'Policy not found') {
      return c.json({ error: 'not_found', message }, 404)
    }
    logger.error('[Insurance] Delete error:', error)
    return c.json({ error: 'delete_failed', message }, 500)
  }
})

export { insuranceRoutes }
