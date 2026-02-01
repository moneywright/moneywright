/**
 * Insurance policy document parsing using LLM
 *
 * Parses insurance policy PDFs to extract structured data:
 * - Policy type (life, health, vehicle)
 * - Common fields (provider, policy number, coverage, premium)
 * - Type-specific details
 */

import { generateObject } from 'ai'
import { createLLMClientFromSettings } from './index'
import { insurancePolicySchema, type InsurancePolicyParsed } from './schemas'
import { logger } from '../lib/logger'

/**
 * Maximum characters for insurance policy extraction
 */
const MAX_POLICY_LENGTH = 150000

/**
 * Combine all pages into a single text with page markers
 */
function combinePages(pages: string[]): string {
  return pages.map((page, idx) => `\n--- PAGE ${idx + 1} ---\n${page}`).join('\n')
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text

  const truncated = text.slice(0, maxLength)
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxLength * 0.7) {
    return truncated.slice(0, lastNewline) + '\n[...truncated]'
  }

  return truncated + '...[truncated]'
}

/**
 * Parse an insurance policy document
 *
 * @param pages - Array of page text from the PDF
 * @param policyTypeHint - Optional hint about policy type from user
 * @param modelOverride - Optional model override for LLM
 * @returns Parsed insurance policy data
 */
export async function parseInsurancePolicy(options: {
  pages: string[]
  policyTypeHint?: 'life_insurance' | 'health_insurance' | 'vehicle_insurance'
  modelOverride?: string
}): Promise<InsurancePolicyParsed> {
  const { pages, policyTypeHint, modelOverride } = options

  const fullText = combinePages(pages)
  const truncatedText = truncateText(fullText, MAX_POLICY_LENGTH)

  if (truncatedText.length < fullText.length) {
    logger.debug(
      `[InsuranceParser] Document truncated from ${fullText.length} to ${truncatedText.length} chars`
    )
  }

  logger.debug(
    `[InsuranceParser] Parsing insurance policy, pages: ${pages.length}, model: ${modelOverride || 'default'}`
  )

  const { model, providerOptions } = await createLLMClientFromSettings(modelOverride)

  const policyTypeContext = policyTypeHint
    ? `The user has indicated this is a ${policyTypeHint.replace('_', ' ')} policy.`
    : ''

  const prompt = `Extract insurance policy information from this document.

${policyTypeContext}

DOCUMENT TEXT:
${truncatedText}

=== STEP 1: DETECT POLICY TYPE ===
Determine what type of insurance policy this is:

1. **life_insurance**: Life insurance policies including:
   - Term life insurance
   - Whole life insurance
   - Endowment plans
   - ULIPs (Unit Linked Insurance Plans)
   - From companies like LIC, HDFC Life, ICICI Prudential Life, Max Life, etc.

2. **health_insurance**: Health/medical insurance policies including:
   - Individual health insurance
   - Family floater plans
   - Group health insurance
   - Critical illness covers
   - From companies like Star Health, HDFC ERGO, ICICI Lombard, Max Bupa, etc.

3. **vehicle_insurance**: Motor/vehicle insurance policies including:
   - Comprehensive car/bike insurance
   - Third-party only insurance
   - Own damage cover
   - From companies like ICICI Lombard, Bajaj Allianz, HDFC ERGO, New India, etc.

=== STEP 2: EXTRACT COMMON FIELDS ===
Extract these fields that are common across all policy types:
- **provider**: Insurance company name (e.g., "HDFC Life", "Star Health", "ICICI Lombard")
- **institution**: Institution ID code for logo lookup. Use these exact IDs:
  - Life Insurance: lic, hdfc_life, icici_prudential, sbi_life, max_life, bajaj_allianz_life, tata_aia, kotak_life, aditya_birla_sun_life, pnb_metlife, canara_hsbc_life, edelweiss_tokio, bandhan_life
  - Health Insurance: star_health, care_health, niva_bupa, manipal_cigna, aditya_birla_health
  - General Insurance (Public): new_india, united_india, national_insurance, oriental_insurance
  - General Insurance (Private): icici_lombard, hdfc_ergo, bajaj_allianz_general, tata_aig, reliance_general, future_generali, cholamandalam, royal_sundaram, digit, acko, sbi_general, kotak_general
  - Use null if provider is not in this list
- **policy_number**: Policy number or certificate number
- **policy_holder_name**: Name of the policyholder
- **sum_insured**: Sum insured / sum assured / coverage amount
- **premium_amount**: Premium amount
- **premium_frequency**: How often premium is paid (monthly, quarterly, half_yearly, yearly)
- **start_date**: Policy start date / inception date (YYYY-MM-DD)
- **end_date**: Policy end date / expiry date (YYYY-MM-DD)

=== STEP 3: EXTRACT TYPE-SPECIFIC DETAILS ===

**For life_insurance:**
- life_insurance_type: term, whole_life, endowment, ulip, or other
- nominee_name: Name of the nominee
- nominee_relation: Relationship with nominee
- death_benefit: Death benefit amount
- maturity_benefit: Maturity benefit (if applicable)
- rider_details: List of additional riders

**For health_insurance:**
- health_insurance_type: individual, family_floater, group, or critical_illness
- covered_members: List of covered members with name, relation, age
- room_rent_limit: Daily room rent limit (number or "no_limit")
- co_pay_percentage: Co-payment percentage
- pre_existing_waiting_period: Waiting period for pre-existing conditions
- network_hospitals: Network hospital information

**For vehicle_insurance:**
- vehicle_insurance_type: comprehensive, third_party, or own_damage
- vehicle_make: Vehicle manufacturer
- vehicle_model: Vehicle model
- vehicle_year: Year of manufacture
- registration_number: Vehicle registration number
- idv: Insured Declared Value
- add_ons: List of add-ons (zero depreciation, roadside assistance, etc.)

=== IMPORTANT RULES ===
- All dates should be in YYYY-MM-DD format
- All amounts should be numbers (not strings), remove commas and currency symbols
- For nullable fields, return null if not found in the document
- Only populate the details object that matches the policy_type
- Set other details objects to null (e.g., if life_insurance, set health_insurance_details and vehicle_insurance_details to null)
- Be accurate - extracted data will be stored and shown to users`

  logger.debug(`[InsuranceParser] Prompt length: ${prompt.length} chars`)

  try {
    const { object } = await generateObject({
      model,
      schema: insurancePolicySchema,
      prompt,
      providerOptions,
    })

    logger.debug(
      `[InsuranceParser] Parsed policy: type=${object.policy_type}, provider=${object.provider}`
    )
    logger.debug(`[InsuranceParser] Full result:`, JSON.stringify(object, null, 2))

    return object
  } catch (error) {
    logger.error(`[InsuranceParser] Error parsing insurance policy:`, error)
    throw error
  }
}
