/**
 * Financial institutions by country
 * Maintains a standardized list of institutions with IDs for consistent storage and display
 */

import type { CountryCode } from './constants'

/**
 * Institution definition
 */
export interface Institution {
  id: string
  name: string
  website?: string
}

/**
 * India institutions - Banks, NBFCs, Payment Banks, Small Finance Banks
 */
export const INSTITUTIONS_IN: Institution[] = [
  // Large public sector & private banks
  { id: 'SBI', name: 'State Bank of India', website: 'https://sbi.co.in' },
  { id: 'HDFC', name: 'HDFC Bank', website: 'https://hdfcbank.com' },
  { id: 'ICICI', name: 'ICICI Bank', website: 'https://icicibank.com' },
  { id: 'AXIS', name: 'Axis Bank', website: 'https://axisbank.com' },
  { id: 'KOTAK', name: 'Kotak Mahindra Bank', website: 'https://kotak.com' },
  { id: 'INDUSIND', name: 'IndusInd Bank', website: 'https://indusind.com' },
  { id: 'YES', name: 'Yes Bank', website: 'https://yesbank.in' },
  { id: 'IDFC', name: 'IDFC First Bank', website: 'https://idfcfirstbank.com' },
  { id: 'FEDERAL', name: 'Federal Bank', website: 'https://federalbank.co.in' },
  { id: 'RBL', name: 'RBL Bank', website: 'https://rblbank.com' },
  { id: 'BOB', name: 'Bank of Baroda', website: 'https://bankofbaroda.in' },
  { id: 'PNB', name: 'Punjab National Bank', website: 'https://pnbindia.in' },
  { id: 'CANARA', name: 'Canara Bank', website: 'https://canarabank.com' },
  { id: 'UNION', name: 'Union Bank of India', website: 'https://unionbankofindia.co.in' },
  { id: 'BOI', name: 'Bank of India', website: 'https://bankofindia.co.in' },
  { id: 'INDIAN', name: 'Indian Bank', website: 'https://indianbank.in' },
  { id: 'CBI', name: 'Central Bank of India', website: 'https://centralbankofindia.co.in' },
  { id: 'IOB', name: 'Indian Overseas Bank', website: 'https://iob.in' },
  { id: 'UCO', name: 'UCO Bank', website: 'https://ucobank.com' },
  { id: 'IDBI', name: 'IDBI Bank', website: 'https://idbibank.in' },
  { id: 'BANDHAN', name: 'Bandhan Bank', website: 'https://bandhanbank.com' },
  { id: 'BOM', name: 'Bank of Maharashtra', website: 'https://bankofmaharashtra.in' },
  { id: 'PSB', name: 'Punjab & Sind Bank', website: 'https://psbindia.com' },
  { id: 'JK', name: 'Jammu & Kashmir Bank', website: 'https://jkbank.com' },
  { id: 'KARNATAKA', name: 'Karnataka Bank', website: 'https://karnatakabank.com' },
  { id: 'SIB', name: 'South Indian Bank', website: 'https://southindianbank.com' },
  { id: 'CSB', name: 'CSB Bank', website: 'https://csb.co.in' },
  { id: 'CUB', name: 'City Union Bank', website: 'https://cityunionbank.com' },
  { id: 'TMB', name: 'Tamilnad Mercantile Bank', website: 'https://tmb.in' },
  { id: 'DCB', name: 'DCB Bank', website: 'https://dcbbank.com' },
  { id: 'DHANLAXMI', name: 'Dhanlaxmi Bank', website: 'https://dfrancis.com' },
  { id: 'NAINITAL', name: 'Nainital Bank', website: 'https://nainitalbank.co.in' },

  // Small Finance Banks
  { id: 'AU_SFB', name: 'AU Small Finance Bank', website: 'https://aubank.in' },
  { id: 'EQUITAS_SFB', name: 'Equitas Small Finance Bank', website: 'https://equitasbank.com' },
  { id: 'UJJIVAN_SFB', name: 'Ujjivan Small Finance Bank', website: 'https://ujjivansfb.in' },
  { id: 'SURYODAY_SFB', name: 'Suryoday Small Finance Bank', website: 'https://suryodaybank.com' },
  { id: 'UTKARSH_SFB', name: 'Utkarsh Small Finance Bank', website: 'https://utkarsh.bank' },
  { id: 'ESAF_SFB', name: 'ESAF Small Finance Bank', website: 'https://esafbank.com' },
  { id: 'JANA_SFB', name: 'Jana Small Finance Bank', website: 'https://janabank.com' },
  { id: 'CAPITAL_SFB', name: 'Capital Small Finance Bank', website: 'https://capitalbank.co.in' },
  { id: 'NORTH_EAST_SFB', name: 'North East Small Finance Bank', website: 'https://nesfb.com' },
  { id: 'SHIVALIK_SFB', name: 'Shivalik Small Finance Bank', website: 'https://shivalikbank.com' },
  { id: 'UNITY_SFB', name: 'Unity Small Finance Bank', website: 'https://theunitybank.com' },

  // Payments Banks
  { id: 'AIRTEL_PB', name: 'Airtel Payments Bank', website: 'https://airtel.in/bank' },
  { id: 'PAYTM_PB', name: 'Paytm Payments Bank', website: 'https://paytmbank.com' },
  { id: 'IPPB', name: 'India Post Payments Bank', website: 'https://ippbonline.com' },
  { id: 'FINO_PB', name: 'Fino Payments Bank', website: 'https://finobank.com' },
  { id: 'JIO_PB', name: 'Jio Payments Bank', website: 'https://jiopaymentsbank.com' },
  { id: 'NSDL_PB', name: 'NSDL Payments Bank', website: 'https://nsdlbank.com' },

  // Foreign banks operating in India
  { id: 'SBM', name: 'SBM Bank India', website: 'https://sbmbank.co.in' },
  { id: 'AMEX', name: 'American Express', website: 'https://www.americanexpress.com/in/' },
  { id: 'SCB', name: 'Standard Chartered Bank', website: 'https://sc.com/in' },
  { id: 'HSBC', name: 'HSBC Bank', website: 'https://hsbc.co.in' },
  { id: 'CITI', name: 'Citibank', website: 'https://citibank.co.in' },
  { id: 'DB', name: 'Deutsche Bank', website: 'https://deutschebank.co.in' },
  { id: 'BARCLAYS', name: 'Barclays Bank', website: 'https://barclays.in' },
  { id: 'BOFA', name: 'Bank of America', website: 'https://bofaml.com/india' },
  { id: 'DBS', name: 'DBS Bank', website: 'https://dbs.com/in' },
  { id: 'BNP', name: 'BNP Paribas', website: 'https://bnpparibas.co.in' },
  { id: 'JPMORGAN', name: 'JPMorgan Chase', website: 'https://jpmorgan.com/in' },
  { id: 'MUFG', name: 'MUFG Bank', website: 'https://mufg.jp/india' },
  { id: 'MIZUHO', name: 'Mizuho Bank', website: 'https://mizuhobank.com/india' },
  { id: 'SCOTIA', name: 'Scotiabank', website: 'https://scotiabank.com' },
  { id: 'UOB', name: 'United Overseas Bank', website: 'https://uobgroup.com/in' },
  { id: 'SHINHAN', name: 'Shinhan Bank', website: 'https://shinhan.com' },
  { id: 'WOORI', name: 'Woori Bank', website: 'https://wooribank.com' },
  { id: 'KOOKMIN', name: 'Kookmin Bank', website: 'https://kbfg.com' },
  { id: 'HANA', name: 'KEB Hana Bank', website: 'https://kebhana.com' },
  { id: 'NATWEST', name: 'NatWest', website: 'https://natwest.com' },
  { id: 'CREDIT_SUISSE', name: 'Credit Suisse', website: 'https://credit-suisse.com' },
  { id: 'SOCIETE_GENERALE', name: 'Société Générale', website: 'https://societegenerale.com' },
  { id: 'CREDIT_AGRICOLE', name: 'Crédit Agricole', website: 'https://credit-agricole.com' },
  { id: 'ABN_AMRO', name: 'ABN AMRO', website: 'https://abnamro.com' },
  { id: 'SMBC', name: 'Sumitomo Mitsui Banking Corporation', website: 'https://smbc.co.jp' },
  { id: 'BOC', name: 'Bank of China', website: 'https://boc.cn' },
  { id: 'ICBC', name: 'Industrial & Commercial Bank of China', website: 'https://icbc-ltd.com' },
  { id: 'IBK', name: 'Industrial Bank of Korea', website: 'https://ibk.co.kr' },
  { id: 'KTB', name: 'Krung Thai Bank', website: 'https://krungthai.com' },
  { id: 'MAYBANK', name: 'Maybank', website: 'https://maybank.com' },
  { id: 'FAB', name: 'First Abu Dhabi Bank', website: 'https://bankfab.com' },
  { id: 'ADCB', name: 'Abu Dhabi Commercial Bank', website: 'https://adcb.com' },
  { id: 'EMIRATES_NBD', name: 'Emirates NBD', website: 'https://emiratesnbd.com' },
  { id: 'QNB', name: 'Qatar National Bank', website: 'https://qnb.com' },
  { id: 'BBK', name: 'Bank of Bahrain and Kuwait', website: 'https://bbkonline.com' },
  { id: 'DOHA', name: 'Doha Bank', website: 'https://dohabank.com' },
  { id: 'ANZ', name: 'Australia and New Zealand Banking Group', website: 'https://anz.com' },
  { id: 'WESTPAC', name: 'Westpac', website: 'https://westpac.com.au' },
  { id: 'FIRSTRAND', name: 'FirstRand Bank', website: 'https://firstrand.co.za' },
  { id: 'SONALI', name: 'Sonali Bank', website: 'https://sonalibank.com.bd' },
  { id: 'BOC_CEYLON', name: 'Bank of Ceylon', website: 'https://boc.lk' },
]

/**
 * US institutions (placeholder - to be expanded)
 */
export const INSTITUTIONS_US: Institution[] = [
  { id: 'CHASE', name: 'Chase', website: 'https://chase.com' },
  { id: 'BOFA', name: 'Bank of America', website: 'https://bankofamerica.com' },
  { id: 'WELLS_FARGO', name: 'Wells Fargo', website: 'https://wellsfargo.com' },
  { id: 'CITI', name: 'Citibank', website: 'https://citi.com' },
  { id: 'CAPITAL_ONE', name: 'Capital One', website: 'https://capitalone.com' },
  { id: 'AMEX', name: 'American Express', website: 'https://americanexpress.com' },
  { id: 'DISCOVER', name: 'Discover', website: 'https://discover.com' },
  { id: 'US_BANK', name: 'U.S. Bank', website: 'https://usbank.com' },
  { id: 'PNC', name: 'PNC Bank', website: 'https://pnc.com' },
  { id: 'TRUIST', name: 'Truist', website: 'https://truist.com' },
  { id: 'TD', name: 'TD Bank', website: 'https://td.com' },
  { id: 'SCHWAB', name: 'Charles Schwab', website: 'https://schwab.com' },
  { id: 'FIDELITY', name: 'Fidelity', website: 'https://fidelity.com' },
  { id: 'ALLY', name: 'Ally Bank', website: 'https://ally.com' },
  { id: 'MARCUS', name: 'Marcus by Goldman Sachs', website: 'https://marcus.com' },
]

/**
 * All institutions by country
 */
export const INSTITUTIONS: Record<CountryCode, Institution[]> = {
  IN: INSTITUTIONS_IN,
  US: INSTITUTIONS_US,
}

/**
 * Get institutions for a country
 */
export function getInstitutionsForCountry(countryCode: CountryCode): Institution[] {
  return INSTITUTIONS[countryCode] || []
}

/**
 * Get institution by ID for a country
 */
export function getInstitutionById(
  countryCode: CountryCode,
  institutionId: string
): Institution | undefined {
  const institutions = getInstitutionsForCountry(countryCode)
  return institutions.find((i) => i.id === institutionId)
}

/**
 * Get institution name by ID (returns ID if not found)
 */
export function getInstitutionName(countryCode: CountryCode, institutionId: string): string {
  const institution = getInstitutionById(countryCode, institutionId)
  return institution?.name || institutionId
}

/**
 * Format institution list for LLM prompt
 * Returns a string like "HDFC: HDFC Bank\nICICI: ICICI Bank\n..."
 */
export function formatInstitutionsForLLM(countryCode: CountryCode): string {
  const institutions = getInstitutionsForCountry(countryCode)
  return institutions.map((i) => `${i.id}: ${i.name}`).join('\n')
}

/**
 * Get logo path for an institution
 * Returns the path to the SVG logo file
 */
export function getInstitutionLogoPath(countryCode: CountryCode, institutionId: string): string {
  return `/institutions/${countryCode.toLowerCase()}/${institutionId}.svg`
}
