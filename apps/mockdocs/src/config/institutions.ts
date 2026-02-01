import type { Institution, CountryCode } from '../types'

// Indian Banks (top 3 for bank accounts)
export const BANKS_IN: Institution[] = [
  { id: 'hdfc', name: 'HDFC Bank', type: 'bank' },
  { id: 'icici', name: 'ICICI Bank', type: 'bank' },
  { id: 'axis', name: 'Axis Bank', type: 'bank' },
]

// Indian Credit Card Issuers (top 5)
export const CC_ISSUERS_IN: Institution[] = [
  { id: 'hdfc', name: 'HDFC Bank', type: 'bank' },
  { id: 'icici', name: 'ICICI Bank', type: 'bank' },
  { id: 'axis', name: 'Axis Bank', type: 'bank' },
  { id: 'amex', name: 'American Express', type: 'bank' },
  { id: 'sbi', name: 'SBI Card', type: 'bank' },
]

// US Banks (top 3 for bank accounts)
export const BANKS_US: Institution[] = [
  { id: 'chase', name: 'Chase', type: 'bank' },
  { id: 'bofa', name: 'Bank of America', type: 'bank' },
  { id: 'wells_fargo', name: 'Wells Fargo', type: 'bank' },
]

// US Credit Card Issuers (top 5)
export const CC_ISSUERS_US: Institution[] = [
  { id: 'chase', name: 'Chase', type: 'bank' },
  { id: 'bofa', name: 'Bank of America', type: 'bank' },
  { id: 'wells_fargo', name: 'Wells Fargo', type: 'bank' },
  { id: 'amex', name: 'American Express', type: 'bank' },
  { id: 'citi', name: 'Citibank', type: 'bank' },
]

// Indian Insurance Providers
export const INSURANCE_IN: Institution[] = [
  { id: 'lic', name: 'LIC of India', type: 'insurance' },
  { id: 'hdfc_life', name: 'HDFC Life', type: 'insurance' },
  { id: 'icici_pru', name: 'ICICI Prudential', type: 'insurance' },
  { id: 'sbi_life', name: 'SBI Life', type: 'insurance' },
  { id: 'max_life', name: 'Max Life Insurance', type: 'insurance' },
  { id: 'hdfc_ergo', name: 'HDFC ERGO', type: 'insurance' },
  { id: 'icici_lombard', name: 'ICICI Lombard', type: 'insurance' },
  { id: 'bajaj_allianz', name: 'Bajaj Allianz', type: 'insurance' },
  { id: 'star_health', name: 'Star Health Insurance', type: 'insurance' },
  { id: 'new_india', name: 'New India Assurance', type: 'insurance' },
]

// US Insurance Providers
export const INSURANCE_US: Institution[] = [
  { id: 'state_farm', name: 'State Farm', type: 'insurance' },
  { id: 'geico', name: 'GEICO', type: 'insurance' },
  { id: 'progressive', name: 'Progressive', type: 'insurance' },
  { id: 'allstate', name: 'Allstate', type: 'insurance' },
  { id: 'usaa', name: 'USAA', type: 'insurance' },
  { id: 'liberty_mutual', name: 'Liberty Mutual', type: 'insurance' },
  { id: 'nationwide', name: 'Nationwide', type: 'insurance' },
  { id: 'aetna', name: 'Aetna', type: 'insurance' },
  { id: 'cigna', name: 'Cigna', type: 'insurance' },
  { id: 'blue_cross', name: 'Blue Cross Blue Shield', type: 'insurance' },
]

// Indian Brokers
export const BROKERS_IN: Institution[] = [
  { id: 'zerodha', name: 'Zerodha', type: 'broker' },
  { id: 'groww', name: 'Groww', type: 'broker' },
  { id: 'upstox', name: 'Upstox', type: 'broker' },
  { id: 'angel_one', name: 'Angel One', type: 'broker' },
  { id: 'icici_direct', name: 'ICICI Direct', type: 'broker' },
  { id: 'hdfc_securities', name: 'HDFC Securities', type: 'broker' },
  { id: 'kotak_securities', name: 'Kotak Securities', type: 'broker' },
]

// US Brokers
export const BROKERS_US: Institution[] = [
  { id: 'fidelity', name: 'Fidelity', type: 'broker' },
  { id: 'schwab', name: 'Charles Schwab', type: 'broker' },
  { id: 'vanguard', name: 'Vanguard', type: 'broker' },
  { id: 'robinhood', name: 'Robinhood', type: 'broker' },
  { id: 'etrade', name: 'E*TRADE', type: 'broker' },
  { id: 'td_ameritrade', name: 'TD Ameritrade', type: 'broker' },
  { id: 'interactive_brokers', name: 'Interactive Brokers', type: 'broker' },
]

// Indian MF RTAs
export const MF_RTA_IN: Institution[] = [
  { id: 'cams', name: 'CAMS', type: 'mf_rta' },
  { id: 'kfintech', name: 'KFintech', type: 'mf_rta' },
  { id: 'mf_central', name: 'MF Central', type: 'mf_rta' },
]

// Government bodies
export const GOVERNMENT_IN: Institution[] = [
  { id: 'epfo', name: 'EPFO', type: 'government' },
  { id: 'nps_trust', name: 'NPS Trust', type: 'government' },
  { id: 'ppf', name: 'PPF (Post Office/Bank)', type: 'government' },
]

// Get banks by country (for bank accounts)
export function getBanks(country: CountryCode): Institution[] {
  return country === 'IN' ? BANKS_IN : BANKS_US
}

// Get credit card issuers by country
export function getCCIssuers(country: CountryCode): Institution[] {
  return country === 'IN' ? CC_ISSUERS_IN : CC_ISSUERS_US
}

// Get insurance providers by country
export function getInsuranceProviders(country: CountryCode): Institution[] {
  return country === 'IN' ? INSURANCE_IN : INSURANCE_US
}

// Get brokers by country
export function getBrokers(country: CountryCode): Institution[] {
  return country === 'IN' ? BROKERS_IN : BROKERS_US
}

// Get random institutions without repeats
export function getRandomInstitutions(
  institutions: Institution[],
  count: number
): Institution[] {
  const shuffled = [...institutions].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

// Credit card variants
export const CARD_VARIANTS_IN = [
  'Platinum',
  'Gold',
  'Titanium',
  'Signature',
  'Regalia',
  'Infinia',
  'Diners Club',
  'Millennia',
  'Amazon Pay',
  'Flipkart Axis',
]

export const CARD_VARIANTS_US = [
  'Platinum',
  'Gold',
  'Signature',
  'Preferred',
  'Freedom',
  'Sapphire',
  'Venture',
  'Prime',
  'Cash Rewards',
  'Travel Rewards',
]

export function getCardVariants(country: CountryCode): string[] {
  return country === 'IN' ? CARD_VARIANTS_IN : CARD_VARIANTS_US
}
