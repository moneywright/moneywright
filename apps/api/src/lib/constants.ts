/**
 * Application constants
 */

/**
 * Supported countries with their details
 * ISO 3166-1 alpha-2 codes
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', currencySymbol: '₹' },
  { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$' },
] as const

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code']

/**
 * Relationship types for profiles
 */
export const RELATIONSHIP_TYPES = ['self', 'spouse', 'parent', 'child', 'sibling', 'other'] as const

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

/**
 * Default user ID for local mode (AUTH_ENABLED=false)
 */
export const DEFAULT_USER_ID = 'default'

// ============================================================================
// INSTITUTIONS (Banks, NBFCs, etc.)
// ============================================================================

/**
 * Institution definition
 */
export interface Institution {
  id: string
  name: string
  logo: string
  website?: string
}

/**
 * India institutions - Banks, NBFCs, Payment Banks, Small Finance Banks
 * All IDs are lowercase for consistency
 */
const INSTITUTIONS_IN: Institution[] = [
  // Large public sector & private banks
  {
    id: 'sbi',
    name: 'State Bank of India',
    logo: '/institutions/in/sbi.svg',
    website: 'https://sbi.co.in',
  },
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    logo: '/institutions/in/hdfc.svg',
    website: 'https://hdfcbank.com',
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    logo: '/institutions/in/icici.svg',
    website: 'https://icicibank.com',
  },
  {
    id: 'axis',
    name: 'Axis Bank',
    logo: '/institutions/in/axis.svg',
    website: 'https://axisbank.com',
  },
  {
    id: 'kotak',
    name: 'Kotak Mahindra Bank',
    logo: '/institutions/in/kotak.svg',
    website: 'https://kotak.com',
  },
  {
    id: 'indusind',
    name: 'IndusInd Bank',
    logo: '/institutions/in/indusind.svg',
    website: 'https://indusind.com',
  },
  { id: 'yes', name: 'Yes Bank', logo: '/institutions/in/yes.svg', website: 'https://yesbank.in' },
  {
    id: 'idfc',
    name: 'IDFC First Bank',
    logo: '/institutions/in/idfc.svg',
    website: 'https://idfcfirstbank.com',
  },
  {
    id: 'federal',
    name: 'Federal Bank',
    logo: '/institutions/in/federal.svg',
    website: 'https://federalbank.co.in',
  },
  { id: 'rbl', name: 'RBL Bank', logo: '/institutions/in/rbl.svg', website: 'https://rblbank.com' },
  {
    id: 'bob',
    name: 'Bank of Baroda',
    logo: '/institutions/in/bob.svg',
    website: 'https://bankofbaroda.in',
  },
  {
    id: 'pnb',
    name: 'Punjab National Bank',
    logo: '/institutions/in/pnb.svg',
    website: 'https://pnbindia.in',
  },
  {
    id: 'canara',
    name: 'Canara Bank',
    logo: '/institutions/in/canara.svg',
    website: 'https://canarabank.com',
  },
  {
    id: 'union',
    name: 'Union Bank of India',
    logo: '/institutions/in/union.svg',
    website: 'https://unionbankofindia.co.in',
  },
  {
    id: 'boi',
    name: 'Bank of India',
    logo: '/institutions/in/boi.svg',
    website: 'https://bankofindia.co.in',
  },
  {
    id: 'indian',
    name: 'Indian Bank',
    logo: '/institutions/in/indian.svg',
    website: 'https://indianbank.in',
  },
  {
    id: 'cbi',
    name: 'Central Bank of India',
    logo: '/institutions/in/cbi.svg',
    website: 'https://centralbankofindia.co.in',
  },
  {
    id: 'iob',
    name: 'Indian Overseas Bank',
    logo: '/institutions/in/iob.svg',
    website: 'https://iob.in',
  },
  { id: 'uco', name: 'UCO Bank', logo: '/institutions/in/uco.svg', website: 'https://ucobank.com' },
  {
    id: 'idbi',
    name: 'IDBI Bank',
    logo: '/institutions/in/idbi.svg',
    website: 'https://idbibank.in',
  },
  {
    id: 'bandhan',
    name: 'Bandhan Bank',
    logo: '/institutions/in/bandhan.svg',
    website: 'https://bandhanbank.com',
  },
  {
    id: 'bom',
    name: 'Bank of Maharashtra',
    logo: '/institutions/in/bom.svg',
    website: 'https://bankofmaharashtra.in',
  },
  {
    id: 'psb',
    name: 'Punjab & Sind Bank',
    logo: '/institutions/in/psb.svg',
    website: 'https://psbindia.com',
  },
  {
    id: 'jk',
    name: 'Jammu & Kashmir Bank',
    logo: '/institutions/in/jk.svg',
    website: 'https://jkbank.com',
  },
  {
    id: 'karnataka',
    name: 'Karnataka Bank',
    logo: '/institutions/in/karnataka.svg',
    website: 'https://karnatakabank.com',
  },
  {
    id: 'sib',
    name: 'South Indian Bank',
    logo: '/institutions/in/sib.svg',
    website: 'https://southindianbank.com',
  },
  { id: 'csb', name: 'CSB Bank', logo: '/institutions/in/csb.svg', website: 'https://csb.co.in' },
  {
    id: 'cub',
    name: 'City Union Bank',
    logo: '/institutions/in/cub.svg',
    website: 'https://cityunionbank.com',
  },
  {
    id: 'tmb',
    name: 'Tamilnad Mercantile Bank',
    logo: '/institutions/in/tmb.svg',
    website: 'https://tmb.in',
  },
  { id: 'dcb', name: 'DCB Bank', logo: '/institutions/in/dcb.svg', website: 'https://dcbbank.com' },
  {
    id: 'dhanlaxmi',
    name: 'Dhanlaxmi Bank',
    logo: '/institutions/in/dhanlaxmi.svg',
    website: 'https://dfrancis.com',
  },
  {
    id: 'nainital',
    name: 'Nainital Bank',
    logo: '/institutions/in/nainital.svg',
    website: 'https://nainitalbank.co.in',
  },

  // Small Finance Banks
  {
    id: 'au_sfb',
    name: 'AU Small Finance Bank',
    logo: '/institutions/in/au_sfb.svg',
    website: 'https://aubank.in',
  },
  {
    id: 'equitas_sfb',
    name: 'Equitas Small Finance Bank',
    logo: '/institutions/in/equitas_sfb.svg',
    website: 'https://equitasbank.com',
  },
  {
    id: 'ujjivan_sfb',
    name: 'Ujjivan Small Finance Bank',
    logo: '/institutions/in/ujjivan_sfb.svg',
    website: 'https://ujjivansfb.in',
  },
  {
    id: 'suryoday_sfb',
    name: 'Suryoday Small Finance Bank',
    logo: '/institutions/in/suryoday_sfb.svg',
    website: 'https://suryodaybank.com',
  },
  {
    id: 'utkarsh_sfb',
    name: 'Utkarsh Small Finance Bank',
    logo: '/institutions/in/utkarsh_sfb.svg',
    website: 'https://utkarsh.bank',
  },
  {
    id: 'esaf_sfb',
    name: 'ESAF Small Finance Bank',
    logo: '/institutions/in/esaf_sfb.svg',
    website: 'https://esafbank.com',
  },
  {
    id: 'jana_sfb',
    name: 'Jana Small Finance Bank',
    logo: '/institutions/in/jana_sfb.svg',
    website: 'https://janabank.com',
  },
  {
    id: 'capital_sfb',
    name: 'Capital Small Finance Bank',
    logo: '/institutions/in/capital_sfb.svg',
    website: 'https://capitalbank.co.in',
  },
  {
    id: 'north_east_sfb',
    name: 'North East Small Finance Bank',
    logo: '/institutions/in/north_east_sfb.svg',
    website: 'https://nesfb.com',
  },
  {
    id: 'shivalik_sfb',
    name: 'Shivalik Small Finance Bank',
    logo: '/institutions/in/shivalik_sfb.svg',
    website: 'https://shivalikbank.com',
  },
  {
    id: 'unity_sfb',
    name: 'Unity Small Finance Bank',
    logo: '/institutions/in/unity_sfb.svg',
    website: 'https://theunitybank.com',
  },

  // Payments Banks
  {
    id: 'airtel_pb',
    name: 'Airtel Payments Bank',
    logo: '/institutions/in/airtel_pb.svg',
    website: 'https://airtel.in/bank',
  },
  {
    id: 'paytm_pb',
    name: 'Paytm Payments Bank',
    logo: '/institutions/in/paytm_pb.svg',
    website: 'https://paytmbank.com',
  },
  {
    id: 'ippb',
    name: 'India Post Payments Bank',
    logo: '/institutions/in/ippb.svg',
    website: 'https://ippbonline.com',
  },
  {
    id: 'fino_pb',
    name: 'Fino Payments Bank',
    logo: '/institutions/in/fino_pb.svg',
    website: 'https://finobank.com',
  },
  {
    id: 'jio_pb',
    name: 'Jio Payments Bank',
    logo: '/institutions/in/jio_pb.svg',
    website: 'https://jiopaymentsbank.com',
  },
  {
    id: 'nsdl_pb',
    name: 'NSDL Payments Bank',
    logo: '/institutions/in/nsdl_pb.svg',
    website: 'https://nsdlbank.com',
  },

  // Foreign banks operating in India
  {
    id: 'sbm',
    name: 'SBM Bank India',
    logo: '/institutions/in/sbm.svg',
    website: 'https://sbmbank.co.in',
  },
  {
    id: 'amex',
    name: 'American Express',
    logo: '/institutions/in/amex.svg',
    website: 'https://www.americanexpress.com/in/',
  },
  {
    id: 'scb',
    name: 'Standard Chartered Bank',
    logo: '/institutions/in/scb.svg',
    website: 'https://sc.com/in',
  },
  {
    id: 'hsbc',
    name: 'HSBC Bank',
    logo: '/institutions/in/hsbc.svg',
    website: 'https://hsbc.co.in',
  },
  {
    id: 'citi',
    name: 'Citibank',
    logo: '/institutions/in/citi.svg',
    website: 'https://citibank.co.in',
  },
  {
    id: 'db',
    name: 'Deutsche Bank',
    logo: '/institutions/in/db.svg',
    website: 'https://deutschebank.co.in',
  },
  {
    id: 'barclays',
    name: 'Barclays Bank',
    logo: '/institutions/in/barclays.svg',
    website: 'https://barclays.in',
  },
  {
    id: 'bofa',
    name: 'Bank of America',
    logo: '/institutions/in/bofa.svg',
    website: 'https://bofaml.com/india',
  },
  { id: 'dbs', name: 'DBS Bank', logo: '/institutions/in/dbs.svg', website: 'https://dbs.com/in' },
  {
    id: 'bnp',
    name: 'BNP Paribas',
    logo: '/institutions/in/bnp.svg',
    website: 'https://bnpparibas.co.in',
  },
  {
    id: 'jpmorgan',
    name: 'JPMorgan Chase',
    logo: '/institutions/in/jpmorgan.svg',
    website: 'https://jpmorgan.com/in',
  },

  // Generic
  { id: 'other', name: 'Other', logo: '/institutions/in/other.svg' },
]

/**
 * India insurance providers - Life, Health, and General insurance companies
 */
const INSURANCE_PROVIDERS_IN: Institution[] = [
  // Life Insurance - Public Sector
  {
    id: 'lic',
    name: 'Life Insurance Corporation of India',
    logo: '/institutions/in/lic.svg',
    website: 'https://licindia.in',
  },

  // Life Insurance - Private Sector
  {
    id: 'hdfc_life',
    name: 'HDFC Life Insurance',
    logo: '/institutions/in/hdfc_life.svg',
    website: 'https://hdfclife.com',
  },
  {
    id: 'icici_prudential',
    name: 'ICICI Prudential Life Insurance',
    logo: '/institutions/in/icici_prudential.svg',
    website: 'https://iciciprulife.com',
  },
  {
    id: 'sbi_life',
    name: 'SBI Life Insurance',
    logo: '/institutions/in/sbi_life.svg',
    website: 'https://sbilife.co.in',
  },
  {
    id: 'max_life',
    name: 'Max Life Insurance',
    logo: '/institutions/in/max_life.svg',
    website: 'https://maxlifeinsurance.com',
  },
  {
    id: 'bajaj_allianz_life',
    name: 'Bajaj Allianz Life Insurance',
    logo: '/institutions/in/bajaj_allianz_life.svg',
    website: 'https://bajajallianzlife.com',
  },
  {
    id: 'tata_aia',
    name: 'Tata AIA Life Insurance',
    logo: '/institutions/in/tata_aia.svg',
    website: 'https://tataaia.com',
  },
  {
    id: 'kotak_life',
    name: 'Kotak Mahindra Life Insurance',
    logo: '/institutions/in/kotak_life.svg',
    website: 'https://insurance.kotak.com',
  },
  {
    id: 'aditya_birla_sun_life',
    name: 'Aditya Birla Sun Life Insurance',
    logo: '/institutions/in/aditya_birla_sun_life.svg',
    website: 'https://absli.com',
  },
  {
    id: 'pnb_metlife',
    name: 'PNB MetLife Insurance',
    logo: '/institutions/in/pnb_metlife.svg',
    website: 'https://pnbmetlife.com',
  },
  {
    id: 'canara_hsbc_life',
    name: 'Canara HSBC Life Insurance',
    logo: '/institutions/in/canara_hsbc_life.svg',
    website: 'https://canarahsbclife.com',
  },
  {
    id: 'edelweiss_tokio',
    name: 'Edelweiss Tokio Life Insurance',
    logo: '/institutions/in/edelweiss_tokio.svg',
    website: 'https://edelweisstokio.in',
  },
  {
    id: 'bandhan_life',
    name: 'Bandhan Life Insurance',
    logo: '/institutions/in/bandhan_life.svg',
    website: 'https://bandhanlife.com',
  },

  // Health Insurance
  {
    id: 'star_health',
    name: 'Star Health Insurance',
    logo: '/institutions/in/star_health.svg',
    website: 'https://starhealth.in',
  },
  {
    id: 'care_health',
    name: 'Care Health Insurance',
    logo: '/institutions/in/care_health.svg',
    website: 'https://careinsurance.com',
  },
  {
    id: 'niva_bupa',
    name: 'Niva Bupa Health Insurance',
    logo: '/institutions/in/niva_bupa.svg',
    website: 'https://nivabupa.com',
  },
  {
    id: 'manipal_cigna',
    name: 'ManipalCigna Health Insurance',
    logo: '/institutions/in/manipal_cigna.svg',
    website: 'https://manipalcigna.com',
  },
  {
    id: 'aditya_birla_health',
    name: 'Aditya Birla Health Insurance',
    logo: '/institutions/in/aditya_birla_health.svg',
    website: 'https://adityabirlahealthinsurance.com',
  },

  // General Insurance - Public Sector
  {
    id: 'new_india',
    name: 'New India Assurance',
    logo: '/institutions/in/new_india.svg',
    website: 'https://newindia.co.in',
  },
  {
    id: 'united_india',
    name: 'United India Insurance',
    logo: '/institutions/in/united_india.svg',
    website: 'https://uiic.co.in',
  },
  {
    id: 'national_insurance',
    name: 'National Insurance Company',
    logo: '/institutions/in/national_insurance.svg',
    website: 'https://nationalinsurance.nic.co.in',
  },
  {
    id: 'oriental_insurance',
    name: 'Oriental Insurance',
    logo: '/institutions/in/oriental_insurance.svg',
    website: 'https://orientalinsurance.org.in',
  },

  // General Insurance - Private Sector
  {
    id: 'icici_lombard',
    name: 'ICICI Lombard General Insurance',
    logo: '/institutions/in/icici_lombard.svg',
    website: 'https://icicilombard.com',
  },
  {
    id: 'hdfc_ergo',
    name: 'HDFC ERGO General Insurance',
    logo: '/institutions/in/hdfc_ergo.svg',
    website: 'https://hdfcergo.com',
  },
  {
    id: 'bajaj_allianz_general',
    name: 'Bajaj Allianz General Insurance',
    logo: '/institutions/in/bajaj_allianz_general.svg',
    website: 'https://bajajallianz.com',
  },
  {
    id: 'tata_aig',
    name: 'Tata AIG General Insurance',
    logo: '/institutions/in/tata_aig.svg',
    website: 'https://tataaig.com',
  },
  {
    id: 'reliance_general',
    name: 'Reliance General Insurance',
    logo: '/institutions/in/reliance_general.svg',
    website: 'https://reliancegeneral.co.in',
  },
  {
    id: 'future_generali',
    name: 'Future Generali India Insurance',
    logo: '/institutions/in/future_generali.svg',
    website: 'https://general.futuregenerali.in',
  },
  {
    id: 'cholamandalam',
    name: 'Cholamandalam MS General Insurance',
    logo: '/institutions/in/cholamandalam.svg',
    website: 'https://cholainsurance.com',
  },
  {
    id: 'royal_sundaram',
    name: 'Royal Sundaram General Insurance',
    logo: '/institutions/in/royal_sundaram.svg',
    website: 'https://royalsundaram.in',
  },
  {
    id: 'digit',
    name: 'Digit Insurance',
    logo: '/institutions/in/digit.svg',
    website: 'https://godigit.com',
  },
  {
    id: 'acko',
    name: 'Acko General Insurance',
    logo: '/institutions/in/acko.svg',
    website: 'https://acko.com',
  },
  {
    id: 'sbi_general',
    name: 'SBI General Insurance',
    logo: '/institutions/in/sbi_general.svg',
    website: 'https://sbigeneral.in',
  },
  {
    id: 'kotak_general',
    name: 'Kotak Mahindra General Insurance',
    logo: '/institutions/in/kotak_general.svg',
    website: 'https://kotakgeneral.com',
  },

  // Generic
  { id: 'other', name: 'Other', logo: '/institutions/in/other.svg' },
]

/**
 * US insurance providers
 */
const INSURANCE_PROVIDERS_US: Institution[] = [
  // Life Insurance
  {
    id: 'metlife',
    name: 'MetLife',
    logo: '/institutions/us/metlife.svg',
    website: 'https://metlife.com',
  },
  {
    id: 'prudential',
    name: 'Prudential Financial',
    logo: '/institutions/us/prudential.svg',
    website: 'https://prudential.com',
  },
  {
    id: 'northwestern_mutual',
    name: 'Northwestern Mutual',
    logo: '/institutions/us/northwestern_mutual.svg',
    website: 'https://northwesternmutual.com',
  },
  {
    id: 'new_york_life',
    name: 'New York Life',
    logo: '/institutions/us/new_york_life.svg',
    website: 'https://newyorklife.com',
  },
  {
    id: 'lincoln_financial',
    name: 'Lincoln Financial',
    logo: '/institutions/us/lincoln_financial.svg',
    website: 'https://lincolnfinancial.com',
  },

  // Health Insurance
  {
    id: 'unitedhealth',
    name: 'UnitedHealthcare',
    logo: '/institutions/us/unitedhealth.svg',
    website: 'https://uhc.com',
  },
  {
    id: 'anthem',
    name: 'Anthem Blue Cross',
    logo: '/institutions/us/anthem.svg',
    website: 'https://anthem.com',
  },
  {
    id: 'aetna',
    name: 'Aetna',
    logo: '/institutions/us/aetna.svg',
    website: 'https://aetna.com',
  },
  {
    id: 'cigna',
    name: 'Cigna',
    logo: '/institutions/us/cigna.svg',
    website: 'https://cigna.com',
  },
  {
    id: 'humana',
    name: 'Humana',
    logo: '/institutions/us/humana.svg',
    website: 'https://humana.com',
  },
  {
    id: 'kaiser',
    name: 'Kaiser Permanente',
    logo: '/institutions/us/kaiser.svg',
    website: 'https://kaiserpermanente.org',
  },

  // Auto/General Insurance
  {
    id: 'state_farm',
    name: 'State Farm',
    logo: '/institutions/us/state_farm.svg',
    website: 'https://statefarm.com',
  },
  {
    id: 'geico',
    name: 'GEICO',
    logo: '/institutions/us/geico.svg',
    website: 'https://geico.com',
  },
  {
    id: 'progressive',
    name: 'Progressive',
    logo: '/institutions/us/progressive.svg',
    website: 'https://progressive.com',
  },
  {
    id: 'allstate',
    name: 'Allstate',
    logo: '/institutions/us/allstate.svg',
    website: 'https://allstate.com',
  },
  {
    id: 'liberty_mutual',
    name: 'Liberty Mutual',
    logo: '/institutions/us/liberty_mutual.svg',
    website: 'https://libertymutual.com',
  },
  {
    id: 'nationwide',
    name: 'Nationwide',
    logo: '/institutions/us/nationwide.svg',
    website: 'https://nationwide.com',
  },
  {
    id: 'travelers',
    name: 'Travelers',
    logo: '/institutions/us/travelers.svg',
    website: 'https://travelers.com',
  },
  {
    id: 'usaa',
    name: 'USAA',
    logo: '/institutions/us/usaa.svg',
    website: 'https://usaa.com',
  },

  // Generic
  { id: 'other', name: 'Other', logo: '/institutions/us/other.svg' },
]

/**
 * US institutions
 */
const INSTITUTIONS_US: Institution[] = [
  { id: 'chase', name: 'Chase', logo: '/institutions/us/chase.svg', website: 'https://chase.com' },
  {
    id: 'bofa',
    name: 'Bank of America',
    logo: '/institutions/us/bofa.svg',
    website: 'https://bankofamerica.com',
  },
  {
    id: 'wells_fargo',
    name: 'Wells Fargo',
    logo: '/institutions/us/wells_fargo.svg',
    website: 'https://wellsfargo.com',
  },
  { id: 'citi', name: 'Citibank', logo: '/institutions/us/citi.svg', website: 'https://citi.com' },
  {
    id: 'capital_one',
    name: 'Capital One',
    logo: '/institutions/us/capital_one.svg',
    website: 'https://capitalone.com',
  },
  {
    id: 'amex',
    name: 'American Express',
    logo: '/institutions/us/amex.svg',
    website: 'https://americanexpress.com',
  },
  {
    id: 'discover',
    name: 'Discover',
    logo: '/institutions/us/discover.svg',
    website: 'https://discover.com',
  },
  {
    id: 'us_bank',
    name: 'U.S. Bank',
    logo: '/institutions/us/us_bank.svg',
    website: 'https://usbank.com',
  },
  { id: 'pnc', name: 'PNC Bank', logo: '/institutions/us/pnc.svg', website: 'https://pnc.com' },
  {
    id: 'truist',
    name: 'Truist',
    logo: '/institutions/us/truist.svg',
    website: 'https://truist.com',
  },
  { id: 'td', name: 'TD Bank', logo: '/institutions/us/td.svg', website: 'https://td.com' },
  {
    id: 'schwab',
    name: 'Charles Schwab',
    logo: '/institutions/us/schwab.svg',
    website: 'https://schwab.com',
  },
  {
    id: 'fidelity',
    name: 'Fidelity',
    logo: '/institutions/us/fidelity.svg',
    website: 'https://fidelity.com',
  },
  { id: 'ally', name: 'Ally Bank', logo: '/institutions/us/ally.svg', website: 'https://ally.com' },
  {
    id: 'marcus',
    name: 'Marcus by Goldman Sachs',
    logo: '/institutions/us/marcus.svg',
    website: 'https://marcus.com',
  },

  // Generic
  { id: 'other', name: 'Other', logo: '/institutions/us/other.svg' },
]

/**
 * All institutions by country
 */
const INSTITUTIONS: Record<CountryCode, Institution[]> = {
  IN: INSTITUTIONS_IN,
  US: INSTITUTIONS_US,
}

/**
 * All insurance providers by country
 */
const INSURANCE_PROVIDERS: Record<CountryCode, Institution[]> = {
  IN: INSURANCE_PROVIDERS_IN,
  US: INSURANCE_PROVIDERS_US,
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
 * Returns a string like "hdfc: HDFC Bank\nicici: ICICI Bank\n..."
 */
export function formatInstitutionsForLLM(countryCode: CountryCode): string {
  const institutions = getInstitutionsForCountry(countryCode)
  return institutions.map((i) => `${i.id}: ${i.name}`).join('\n')
}

// ============================================================================
// INSURANCE PROVIDERS
// ============================================================================

/**
 * Get insurance providers for a country
 */
export function getInsuranceProvidersForCountry(countryCode: CountryCode): Institution[] {
  return INSURANCE_PROVIDERS[countryCode] || []
}

/**
 * Get insurance provider by ID for a country
 */
export function getInsuranceProviderById(
  countryCode: CountryCode,
  providerId: string
): Institution | undefined {
  const providers = getInsuranceProvidersForCountry(countryCode)
  return providers.find((p) => p.id === providerId)
}

/**
 * Get insurance provider name by ID (returns ID if not found)
 */
export function getInsuranceProviderName(countryCode: CountryCode, providerId: string): string {
  const provider = getInsuranceProviderById(countryCode, providerId)
  return provider?.name || providerId
}

/**
 * Format insurance provider list for LLM prompt
 */
export function formatInsuranceProvidersForLLM(countryCode: CountryCode): string {
  const providers = getInsuranceProvidersForCountry(countryCode)
  return providers.map((p) => `${p.id}: ${p.name}`).join('\n')
}

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

/**
 * Account types by country
 */
export const ACCOUNT_TYPES = {
  IN: [
    { code: 'savings_account', label: 'Savings Account' },
    { code: 'current_account', label: 'Current Account' },
    { code: 'credit_card', label: 'Credit Card' },
    { code: 'fixed_deposit', label: 'Fixed Deposit' },
    { code: 'ppf', label: 'PPF' },
    { code: 'epf', label: 'EPF' },
    { code: 'nps', label: 'NPS' },
    { code: 'demat', label: 'Demat Account' },
    { code: 'other', label: 'Other' },
  ],
  US: [
    { code: 'checking_account', label: 'Checking Account' },
    { code: 'savings_account', label: 'Savings Account' },
    { code: 'credit_card', label: 'Credit Card' },
    { code: '401k', label: '401(k)' },
    { code: 'ira', label: 'IRA' },
    { code: 'brokerage', label: 'Brokerage Account' },
    { code: 'cd', label: 'Certificate of Deposit' },
    { code: 'other', label: 'Other' },
  ],
} as const

export type AccountTypeCode = (typeof ACCOUNT_TYPES)[CountryCode][number]['code']

// ============================================================================
// TRANSACTION CATEGORIES
// ============================================================================

/**
 * Transaction categories by country
 */
export const TRANSACTION_CATEGORIES = {
  IN: [
    { code: 'food_dining', label: 'Food & Dining', color: 'orange' },
    { code: 'groceries', label: 'Groceries', color: 'lime' },
    { code: 'shopping', label: 'Shopping', color: 'blue' },
    { code: 'utilities', label: 'Utilities (Electricity, Water, Gas)', color: 'cyan' },
    { code: 'mobile_internet', label: 'Mobile & Internet', color: 'cyan' },
    { code: 'emi', label: 'EMI / Loan Payment', color: 'rose' },
    { code: 'rent', label: 'Rent', color: 'purple' },
    { code: 'fuel', label: 'Fuel', color: 'amber' },
    { code: 'entertainment', label: 'Entertainment', color: 'pink' },
    { code: 'travel', label: 'Travel', color: 'sky' },
    { code: 'healthcare', label: 'Healthcare', color: 'red' },
    { code: 'personal_care', label: 'Personal Care & Fitness', color: 'pink' },
    { code: 'gifts', label: 'Gifts & Flowers', color: 'fuchsia' },
    { code: 'education', label: 'Education', color: 'indigo' },
    { code: 'insurance', label: 'Insurance', color: 'slate' },
    { code: 'investment', label: 'Investment', color: 'amber' },
    { code: 'software', label: 'Software & Services', color: 'violet' },
    { code: 'transfer', label: 'Transfer', color: 'sky' },
    { code: 'atm_withdrawal', label: 'ATM Withdrawal', color: 'zinc' },
    { code: 'salary', label: 'Salary / Income', color: 'emerald' },
    { code: 'refund', label: 'Refund', color: 'emerald' },
    { code: 'cashback', label: 'Cashback / Rewards', color: 'emerald' },
    { code: 'tax', label: 'Tax Payment', color: 'red' },
    { code: 'government', label: 'Government Services', color: 'slate' },
    { code: 'charity', label: 'Charity / Donations', color: 'teal' },
    { code: 'dividend', label: 'Dividend', color: 'emerald' },
    { code: 'interest', label: 'Interest', color: 'emerald' },
    { code: 'credit_card_payment', label: 'Credit Card Payment', color: 'sky' },
    { code: 'bank_charges', label: 'Bank Charges / Fees', color: 'rose' },
    { code: 'forex', label: 'Foreign Exchange', color: 'indigo' },
    { code: 'other', label: 'Other', color: 'zinc' },
  ],
  US: [
    { code: 'food_dining', label: 'Food & Dining', color: 'orange' },
    { code: 'groceries', label: 'Groceries', color: 'lime' },
    { code: 'shopping', label: 'Shopping', color: 'blue' },
    { code: 'utilities', label: 'Utilities', color: 'cyan' },
    { code: 'phone_internet', label: 'Phone & Internet', color: 'cyan' },
    { code: 'mortgage', label: 'Mortgage', color: 'purple' },
    { code: 'rent', label: 'Rent', color: 'purple' },
    { code: 'gas', label: 'Gas / Fuel', color: 'amber' },
    { code: 'entertainment', label: 'Entertainment', color: 'pink' },
    { code: 'travel', label: 'Travel', color: 'sky' },
    { code: 'healthcare', label: 'Healthcare', color: 'red' },
    { code: 'personal_care', label: 'Personal Care & Fitness', color: 'pink' },
    { code: 'gifts', label: 'Gifts & Flowers', color: 'fuchsia' },
    { code: 'education', label: 'Education', color: 'indigo' },
    { code: 'insurance', label: 'Insurance', color: 'slate' },
    { code: 'investment', label: 'Investment', color: 'amber' },
    { code: 'software', label: 'Software & Services', color: 'violet' },
    { code: 'transfer', label: 'Transfer', color: 'sky' },
    { code: 'atm_withdrawal', label: 'ATM Withdrawal', color: 'zinc' },
    { code: 'paycheck', label: 'Paycheck / Income', color: 'emerald' },
    { code: 'refund', label: 'Refund', color: 'emerald' },
    { code: 'cashback', label: 'Cashback / Rewards', color: 'emerald' },
    { code: 'tax', label: 'Tax Payment', color: 'red' },
    { code: 'childcare', label: 'Childcare', color: 'teal' },
    { code: 'pet', label: 'Pet Expenses', color: 'amber' },
    { code: 'charity', label: 'Charity / Donations', color: 'teal' },
    { code: 'dividend', label: 'Dividend', color: 'emerald' },
    { code: 'interest', label: 'Interest', color: 'emerald' },
    { code: 'credit_card_payment', label: 'Credit Card Payment', color: 'sky' },
    { code: 'bank_charges', label: 'Bank Charges / Fees', color: 'rose' },
    { code: 'forex', label: 'Foreign Exchange', color: 'indigo' },
    { code: 'other', label: 'Other', color: 'zinc' },
  ],
} as const

export type CategoryCode = (typeof TRANSACTION_CATEGORIES)[CountryCode][number]['code']

// ============================================================================
// INVESTMENT TYPES
// ============================================================================

/**
 * Investment types by country
 */
export const INVESTMENT_TYPES = {
  IN: [
    { code: 'mutual_fund', label: 'Mutual Fund' },
    { code: 'stocks', label: 'Stocks' },
    { code: 'fixed_deposit', label: 'Fixed Deposit' },
    { code: 'ppf', label: 'PPF' },
    { code: 'epf', label: 'EPF' },
    { code: 'nps', label: 'NPS' },
    { code: 'bonds', label: 'Bonds' },
    { code: 'gold', label: 'Gold' },
    { code: 'real_estate', label: 'Real Estate' },
    { code: 'other', label: 'Other' },
  ],
  US: [
    { code: 'mutual_fund', label: 'Mutual Fund' },
    { code: 'etf', label: 'ETF' },
    { code: 'stocks', label: 'Stocks' },
    { code: '401k', label: '401(k)' },
    { code: 'ira', label: 'IRA' },
    { code: 'cd', label: 'Certificate of Deposit' },
    { code: 'bonds', label: 'Bonds' },
    { code: 'real_estate', label: 'Real Estate' },
    { code: 'other', label: 'Other' },
  ],
} as const

export type InvestmentTypeCode = (typeof INVESTMENT_TYPES)[CountryCode][number]['code']

/**
 * Investment source types - platforms/providers where investments are held
 */
export const INVESTMENT_SOURCE_TYPES = {
  IN: [
    // Domestic brokers
    { code: 'zerodha', label: 'Zerodha', logo: '/institutions/in/zerodha.svg' },
    { code: 'groww', label: 'Groww', logo: '/institutions/in/groww.svg' },
    { code: 'upstox', label: 'Upstox', logo: '/institutions/in/upstox.svg' },
    { code: 'angel_one', label: 'Angel One', logo: '/institutions/in/angelone.jpg' },
    { code: 'icici_direct', label: 'ICICI Direct', logo: '/institutions/in/icici.svg' },
    { code: 'hdfc_securities', label: 'HDFC Securities', logo: '/institutions/in/hdfc.svg' },
    { code: 'kotak_securities', label: 'Kotak Securities', logo: '/institutions/in/kotak.svg' },
    // Mutual fund platforms
    { code: 'mf_central', label: 'MF Central', logo: '/institutions/in/mfcentral.svg' },
    { code: 'cams', label: 'CAMS', logo: '/institutions/in/cams.svg' },
    { code: 'kfintech', label: 'KFintech', logo: '/institutions/in/kfintech.svg' },
    // US stocks for Indian investors
    { code: 'vested', label: 'Vested', logo: '/institutions/in/vested.svg' },
    { code: 'indmoney', label: 'INDmoney', logo: '/institutions/in/indmoney.svg' },
    // Fixed income
    { code: 'ppf', label: 'PPF', logo: '/institutions/in/ppf.png' },
    { code: 'epf', label: 'EPF', logo: '/institutions/in/epf.png' },
    { code: 'nps', label: 'NPS', logo: '' },
    { code: 'fd', label: 'Fixed Deposit', logo: '' },
    // Manual/other
    { code: 'manual', label: 'Manual Entry', logo: '' },
    { code: 'other', label: 'Other', logo: '' },
  ],
  US: [
    // Brokers
    { code: 'schwab', label: 'Charles Schwab', logo: '' },
    { code: 'fidelity', label: 'Fidelity', logo: '' },
    { code: 'vanguard', label: 'Vanguard', logo: '' },
    { code: 'td_ameritrade', label: 'TD Ameritrade', logo: '' },
    { code: 'robinhood', label: 'Robinhood', logo: '' },
    { code: 'etrade', label: 'E*TRADE', logo: '' },
    { code: 'interactive_brokers', label: 'Interactive Brokers', logo: '' },
    // Retirement
    { code: '401k_provider', label: '401(k) Provider', logo: '' },
    { code: 'ira_provider', label: 'IRA Provider', logo: '' },
    // Manual/other
    { code: 'manual', label: 'Manual Entry', logo: '' },
    { code: 'other', label: 'Other', logo: '' },
  ],
} as const

export type InvestmentSourceTypeCode = (typeof INVESTMENT_SOURCE_TYPES)[CountryCode][number]['code']

/**
 * Investment holding types - types of securities/instruments
 */
export const INVESTMENT_HOLDING_TYPES = [
  { code: 'stock', label: 'Stock' },
  { code: 'mutual_fund', label: 'Mutual Fund' },
  { code: 'etf', label: 'ETF' },
  { code: 'bond', label: 'Bond' },
  { code: 'ppf', label: 'PPF' },
  { code: 'epf', label: 'EPF' },
  { code: 'nps', label: 'NPS' },
  { code: 'fd', label: 'Fixed Deposit' },
  { code: 'gold', label: 'Gold' },
  { code: 'reit', label: 'REIT' },
  { code: 'other', label: 'Other' },
] as const

export type InvestmentHoldingTypeCode = (typeof INVESTMENT_HOLDING_TYPES)[number]['code']

/**
 * Investment transaction types
 */
export const INVESTMENT_TRANSACTION_TYPES = [
  { code: 'buy', label: 'Buy' },
  { code: 'sell', label: 'Sell' },
  { code: 'dividend', label: 'Dividend' },
  { code: 'interest', label: 'Interest' },
  { code: 'sip', label: 'SIP' },
  { code: 'switch_in', label: 'Switch In' },
  { code: 'switch_out', label: 'Switch Out' },
  { code: 'contribution', label: 'Contribution' },
  { code: 'withdrawal', label: 'Withdrawal' },
] as const

export type InvestmentTransactionTypeCode = (typeof INVESTMENT_TRANSACTION_TYPES)[number]['code']

/**
 * Snapshot types
 */
export const SNAPSHOT_TYPES = ['statement_import', 'manual', 'scheduled'] as const
export type SnapshotType = (typeof SNAPSHOT_TYPES)[number]

/**
 * Document types for statements
 */
export const DOCUMENT_TYPES = [
  'bank_statement',
  'credit_card_statement',
  'investment_statement',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

/**
 * Get investment source types for a country
 */
export function getInvestmentSourceTypesForCountry(countryCode: CountryCode) {
  return INVESTMENT_SOURCE_TYPES[countryCode] || INVESTMENT_SOURCE_TYPES.US
}

// ============================================================================
// STATEMENT & TRANSACTION TYPES
// ============================================================================

/**
 * Statement parsing status
 */
export const STATEMENT_STATUS = ['pending', 'parsing', 'completed', 'failed'] as const
export type StatementStatus = (typeof STATEMENT_STATUS)[number]

/**
 * Transaction types
 */
export const TRANSACTION_TYPES = ['credit', 'debit'] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

/**
 * Transaction link types
 */
export const TRANSACTION_LINK_TYPES = ['payment', 'transfer', 'refund'] as const
export type TransactionLinkType = (typeof TRANSACTION_LINK_TYPES)[number]

/**
 * Supported file types for statement upload
 */
export const SUPPORTED_FILE_TYPES = ['pdf', 'csv', 'xlsx'] as const
export type FileType = (typeof SUPPORTED_FILE_TYPES)[number]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a country code is supported
 */
export function isValidCountryCode(code: string): code is CountryCode {
  return SUPPORTED_COUNTRIES.some((c) => c.code === code)
}

/**
 * Check if a relationship type is valid
 */
export function isValidRelationshipType(type: string): type is RelationshipType {
  return RELATIONSHIP_TYPES.includes(type as RelationshipType)
}

/**
 * Get country details by code
 */
export function getCountryByCode(code: CountryCode) {
  return SUPPORTED_COUNTRIES.find((c) => c.code === code)
}

/**
 * Get account types for a country
 */
export function getAccountTypesForCountry(countryCode: CountryCode) {
  return ACCOUNT_TYPES[countryCode] || ACCOUNT_TYPES.US
}

/**
 * Get transaction categories for a country
 */
export function getCategoriesForCountry(countryCode: CountryCode) {
  return TRANSACTION_CATEGORIES[countryCode] || TRANSACTION_CATEGORIES.US
}

/**
 * Get investment types for a country
 */
export function getInvestmentTypesForCountry(countryCode: CountryCode) {
  return INVESTMENT_TYPES[countryCode] || INVESTMENT_TYPES.US
}

/**
 * Check if account type is valid for a country
 */
export function isValidAccountType(countryCode: CountryCode, accountType: string): boolean {
  const types = getAccountTypesForCountry(countryCode)
  return types.some((t) => t.code === accountType)
}

/**
 * Check if category is valid for a country
 */
export function isValidCategory(countryCode: CountryCode, category: string): boolean {
  const categories = getCategoriesForCountry(countryCode)
  return categories.some((c) => c.code === category)
}
