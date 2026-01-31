/**
 * Loan document parsing using LLM
 *
 * Parses loan document PDFs to extract structured data:
 * - Loan type (personal, home, vehicle, education, business, gold)
 * - Common fields (lender, account number, principal, interest, EMI)
 * - Type-specific details
 */

import { generateObject } from 'ai'
import { createLLMClientFromSettings } from './index'
import { loanDocumentSchema, type LoanDocumentParsed } from './schemas'
import { logger } from '../lib/logger'

/**
 * Maximum characters for loan document extraction
 */
const MAX_DOCUMENT_LENGTH = 150000

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
 * Parse a loan document
 *
 * @param pages - Array of page text from the PDF
 * @param loanTypeHint - Optional hint about loan type from user
 * @param modelOverride - Optional model override for LLM
 * @returns Parsed loan document data
 */
export async function parseLoanDocument(options: {
  pages: string[]
  loanTypeHint?:
    | 'personal_loan'
    | 'home_loan'
    | 'vehicle_loan'
    | 'education_loan'
    | 'business_loan'
    | 'gold_loan'
  modelOverride?: string
}): Promise<LoanDocumentParsed> {
  const { pages, loanTypeHint, modelOverride } = options

  const fullText = combinePages(pages)
  const truncatedText = truncateText(fullText, MAX_DOCUMENT_LENGTH)

  if (truncatedText.length < fullText.length) {
    logger.debug(
      `[LoanParser] Document truncated from ${fullText.length} to ${truncatedText.length} chars`
    )
  }

  logger.debug(
    `[LoanParser] Parsing loan document, pages: ${pages.length}, model: ${modelOverride || 'default'}`
  )

  const model = await createLLMClientFromSettings(modelOverride)

  const loanTypeContext = loanTypeHint
    ? `The user has indicated this is a ${loanTypeHint.replace(/_/g, ' ')}.`
    : ''

  const prompt = `Extract loan information from this document.

${loanTypeContext}

DOCUMENT TEXT:
${truncatedText}

=== STEP 1: DETECT LOAN TYPE ===
Determine what type of loan this is:

1. **personal_loan**: Unsecured personal loans from banks/NBFCs including:
   - Personal loans for any purpose
   - Consumer durable loans
   - From banks like HDFC Bank, ICICI Bank, SBI, Axis Bank, or NBFCs like Bajaj Finserv, etc.

2. **home_loan**: Housing/mortgage loans including:
   - Home purchase loans
   - Home construction loans
   - Home improvement/extension loans
   - Balance transfer loans
   - From banks like HDFC Ltd, SBI, LIC Housing, ICICI Bank, etc.

3. **vehicle_loan**: Auto/vehicle loans including:
   - New car loans
   - Used car loans
   - Two-wheeler loans
   - Commercial vehicle loans
   - From banks like HDFC Bank, ICICI Bank, or auto finance companies

4. **education_loan**: Student/education loans including:
   - Higher education loans (India/abroad)
   - Skill development loans
   - From banks like SBI, HDFC Credila, Axis Bank, etc.

5. **business_loan**: Business/commercial loans including:
   - Working capital loans
   - Term loans for business
   - MSME loans
   - From banks or NBFCs

6. **gold_loan**: Loans against gold including:
   - Gold loans from banks
   - Gold loans from NBFCs like Muthoot, Manappuram, etc.

=== STEP 2: EXTRACT COMMON FIELDS ===
Extract these fields that are common across all loan types:
- **lender**: Bank or NBFC name (e.g., "HDFC Bank", "SBI", "Bajaj Finserv")
- **institution**: Institution ID code for logo lookup. Use these exact IDs:
  - Banks: sbi, hdfc, icici, axis, kotak, indusind, yes, idfc, federal, rbl, bob, pnb, canara, union, boi, indian, cbi, iob, uco, idbi, bandhan, bom, psb, jk, karnataka, sib, csb, cub, tmb, dcb, dhanlaxmi, nainital
  - Small Finance Banks: au_sfb, equitas_sfb, ujjivan_sfb, suryoday_sfb, utkarsh_sfb, esaf_sfb, jana_sfb, capital_sfb, north_east_sfb, shivalik_sfb, unity_sfb
  - NBFCs/Others: bajaj_finserv, tata_capital, mahindra_finance, hdb_financial, fullerton, muthoot, manappuram
  - Foreign Banks: scb, hsbc, citi, db, barclays, bofa, dbs, bnp, jpmorgan
  - Use null if lender is not in this list
- **loan_account_number**: Loan account number / reference number
- **borrower_name**: Name of the primary borrower
- **principal_amount**: Original loan amount / sanctioned amount
- **interest_rate**: Interest rate in percentage (e.g., 10.5 for 10.5%)
- **interest_type**: "fixed" or "floating"
- **emi_amount**: Monthly EMI amount
- **tenure_months**: Loan tenure in months
- **disbursement_date**: Date when loan was disbursed (YYYY-MM-DD)
- **first_emi_date**: Date of first EMI payment (YYYY-MM-DD)
- **end_date**: Date of last EMI / loan maturity (YYYY-MM-DD)

=== STEP 3: EXTRACT TYPE-SPECIFIC DETAILS ===

**For home_loan:**
- property_address: Address of the property
- property_type: apartment, house, plot, or commercial
- co_borrower_name: Name of co-borrower (if any)
- collateral_value: Property/collateral value

**For vehicle_loan:**
- vehicle_make: Vehicle manufacturer (e.g., "Honda", "Maruti")
- vehicle_model: Vehicle model (e.g., "City", "Swift")
- vehicle_year: Year of manufacture
- registration_number: Vehicle registration number
- vehicle_type: car, two_wheeler, or commercial

**For education_loan:**
- institution_name: Name of the educational institution
- course_name: Name of the course/program
- student_name: Name of the student
- moratorium_period: Moratorium/repayment holiday period

**For business_loan:**
- business_name: Name of the business
- loan_purpose: Purpose of the loan
- collateral_details: Collateral/security details (if any)

**For gold_loan:**
- gold_weight: Weight of gold in grams
- gold_purity: Purity of gold (e.g., "22K", "24K")
- collateral_value: Value of gold collateral

**For personal_loan:**
- loan_purpose: Purpose of the loan (if mentioned)

=== IMPORTANT RULES ===
- All dates should be in YYYY-MM-DD format
- All amounts should be numbers (not strings), remove commas and currency symbols
- Interest rate should be a number (e.g., 10.5 for 10.5%)
- Tenure should be in months (convert years to months if needed)
- For nullable fields, return null if not found in the document
- Only populate the details object that matches the loan_type
- Set other details objects to null (e.g., if home_loan, set vehicle_loan_details, education_loan_details, etc. to null)
- Be accurate - extracted data will be stored and shown to users`

  logger.debug(`[LoanParser] Prompt length: ${prompt.length} chars`)

  try {
    const { object } = await generateObject({
      model,
      schema: loanDocumentSchema,
      prompt,
    })

    logger.debug(`[LoanParser] Parsed loan: type=${object.loan_type}, lender=${object.lender}`)
    logger.debug(`[LoanParser] Full result:`, JSON.stringify(object, null, 2))

    return object
  } catch (error) {
    logger.error(`[LoanParser] Error parsing loan document:`, error)
    throw error
  }
}
