# Loans Feature Design

## Overview

Add loan document management similar to insurance - users upload loan PDFs, we parse them with LLM, display on `/loans` page, and provide AI agent tools for querying.

## Loan Types

- `personal_loan` - Unsecured loans from banks/NBFCs
- `home_loan` - Property-backed mortgages
- `vehicle_loan` - Car/bike financing
- `education_loan` - Student loans
- `business_loan` - Business/working capital loans
- `gold_loan` - Loans against gold collateral

## Database Schema

**Table: `loans`**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Primary key (nanoid) |
| `profileId` | string | FK to profiles |
| `userId` | string | FK to users |
| `loanType` | enum | One of 6 loan types |
| `lender` | string | Bank/NBFC name |
| `loanAccountNumber` | string? | Account/reference number |
| `borrowerName` | string? | Primary borrower name |
| `principalAmount` | decimal? | Original loan amount |
| `interestRate` | decimal? | Interest rate (%) |
| `interestType` | enum? | `fixed`, `floating` |
| `emiAmount` | decimal? | Monthly EMI |
| `tenureMonths` | integer? | Loan tenure in months |
| `disbursementDate` | string? | When loan was disbursed (YYYY-MM-DD) |
| `firstEmiDate` | string? | First EMI date (YYYY-MM-DD) |
| `endDate` | string? | Last EMI / maturity date (YYYY-MM-DD) |
| `status` | enum | `active`, `closed` |
| `parseStatus` | enum | `pending`, `parsing`, `completed`, `failed` |
| `errorMessage` | string? | Error if parsing failed |
| `originalFilename` | string | Uploaded filename |
| `fileType` | string | 'pdf' |
| `rawText` | text? | Full extracted text |
| `details` | jsonb? | Type-specific fields |
| `createdAt`, `updatedAt` | timestamp | Timestamps |

## Type-Specific Details (JSON)

**Home Loan:**
```json
{
  "propertyAddress": "string",
  "propertyType": "apartment | house | plot | commercial",
  "coBorrowerName": "string",
  "collateralValue": "number"
}
```

**Vehicle Loan:**
```json
{
  "vehicleMake": "string",
  "vehicleModel": "string",
  "vehicleYear": "number",
  "registrationNumber": "string",
  "vehicleType": "car | two_wheeler | commercial"
}
```

**Education Loan:**
```json
{
  "institutionName": "string",
  "courseName": "string",
  "studentName": "string",
  "moratoriumPeriod": "string"
}
```

**Business Loan:**
```json
{
  "businessName": "string",
  "loanPurpose": "string",
  "collateralDetails": "string"
}
```

**Gold Loan:**
```json
{
  "goldWeight": "number (grams)",
  "goldPurity": "string (e.g., 22K)",
  "collateralValue": "number"
}
```

**Personal Loan:**
```json
{
  "loanPurpose": "string"
}
```

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /loans` | GET | List all loans for user (family view) |
| `GET /loans/profiles/:profileId` | GET | List loans for specific profile |
| `GET /loans/:id` | GET | Get single loan by ID |
| `POST /loans/upload` | POST | Upload loan PDF (async processing) |
| `PUT /loans/:id` | PUT | Update loan fields manually |
| `DELETE /loans/:id` | DELETE | Delete a loan |

**Query filters:** `loanType`, `status`, `parseStatus`

## LLM Parser

3-step prompt structure:
1. Detect loan type from document content
2. Extract common fields (lender, amounts, dates, etc.)
3. Extract type-specific details

## AI Agent Tools

1. **`getLoans`** - List loans with CSV pagination
2. **`getLoanDetails`** - Full loan info + raw document text

## Frontend

- **Route:** `/loans`
- **Components:** LoanCard, UploadDialog, LoanDetailSheet
- **Hooks:** useLoans, useLoan, useUploadLoan, useUpdateLoan, useDeleteLoan
- **Layout:** Grouped by loan type, processing section at top

## Files to Create/Modify

- `apps/api/src/db/schema.sqlite.ts` - Add loans table
- `apps/api/src/db/schema.pg.ts` - Add loans table
- `apps/api/src/routes/loans.ts` - New route file
- `apps/api/src/services/loans.ts` - New service file
- `apps/api/src/llm/loan-parser.ts` - New parser
- `apps/api/src/llm/schemas.ts` - Add loan schema
- `apps/api/src/services/chat/tools.ts` - Add loan tools
- `apps/web/src/routes/loans.tsx` - New page
- `apps/web/src/hooks/useLoans.ts` - New hooks
- `apps/web/src/lib/api.ts` - Add loan API functions
