// Insurance and Loan document templates with terms and conditions

export const INSURANCE_TERMS = {
  term_life: {
    title: 'Term Life Insurance Policy',
    sections: [
      {
        heading: 'Policy Benefits',
        content: `This policy provides financial protection to your nominees in the event of the policyholder's death during the policy term. The Sum Assured will be paid to the registered nominee(s) as a lump sum, tax-free under Section 10(10D) of the Income Tax Act.`,
      },
      {
        heading: 'Premium Payment',
        content: `Premiums are payable as per the frequency chosen (monthly/quarterly/yearly). A grace period of 30 days is allowed for premium payment. Non-payment of premium within the grace period will result in policy lapse.`,
      },
      {
        heading: 'Exclusions',
        content: `1. Suicide within the first 12 months of policy commencement
2. Death due to participation in hazardous activities without prior disclosure
3. Death due to war, civil commotion, or nuclear events
4. Death due to pre-existing conditions not disclosed at the time of proposal
5. Death while under the influence of drugs or alcohol (unless prescribed by a physician)`,
      },
      {
        heading: 'Claim Process',
        content: `In the event of a claim:
1. Inform the company within 30 days of the insured event
2. Submit death certificate, policy document, and claimant's ID proof
3. Submit medical records if death is due to illness
4. Claims are typically processed within 30 days of receiving all documents`,
      },
      {
        heading: 'Free Look Period',
        content: `You have 15 days (30 days for online policies) from the date of receipt to review the policy. If you disagree with any terms, you may return the policy for a full refund less proportionate risk premium and stamp duty.`,
      },
      {
        heading: 'Nomination',
        content: `The policyholder may nominate one or more persons to receive the policy benefits. Nomination can be changed at any time during the policy term by submitting a written request.`,
      },
    ],
  },
  health: {
    title: 'Health Insurance Policy',
    sections: [
      {
        heading: 'Coverage',
        content: `This policy covers hospitalization expenses including room rent, nursing charges, surgeon fees, anesthetist fees, medical practitioner fees, cost of medicines, and diagnostic tests during hospitalization.`,
      },
      {
        heading: 'Room Rent Limits',
        content: `Room rent is covered up to the specified limit or actual charges, whichever is lower. ICU charges are covered up to 2x the room rent limit. Choosing a room above the entitled category may result in proportionate deduction of all other charges.`,
      },
      {
        heading: 'Waiting Period',
        content: `1. Initial waiting period: 30 days from policy start (except accidents)
2. Pre-existing diseases: 4 years waiting period
3. Specific diseases (hernia, cataract, joint replacement): 2 years waiting period`,
      },
      {
        heading: 'Co-payment',
        content: `A co-payment of the specified percentage applies to all claims. This means you pay the co-pay percentage and the insurer pays the remaining amount of the admissible claim.`,
      },
      {
        heading: 'Network Hospitals',
        content: `Cashless treatment is available at network hospitals. For non-network hospitals, you must pay the bills and claim reimbursement later. Pre-authorization is required for planned hospitalizations.`,
      },
      {
        heading: 'Exclusions',
        content: `1. Cosmetic and plastic surgery (unless medically necessary)
2. Dental treatment (unless due to accident)
3. Congenital diseases
4. Self-inflicted injuries
5. Treatment for obesity, infertility, or sexual dysfunction
6. Experimental or unproven treatments
7. War, nuclear events, or participation in hazardous activities`,
      },
      {
        heading: 'No Claim Bonus',
        content: `For every claim-free year, the Sum Insured increases by the specified percentage (up to a maximum limit). This bonus is forfeited if a claim is made during the policy year.`,
      },
    ],
  },
  car: {
    title: 'Motor Vehicle Insurance Policy',
    sections: [
      {
        heading: 'Coverage',
        content: `This policy provides coverage for:
1. Own Damage: Covers damage to your vehicle due to accidents, fire, theft, natural calamities, riots, strikes, and malicious acts
2. Third Party Liability: Mandatory cover for injury or death to third parties and damage to third-party property`,
      },
      {
        heading: 'Insured Declared Value (IDV)',
        content: `The IDV is the maximum amount payable in case of total loss or theft of the vehicle. It is calculated as the manufacturer's listed selling price minus depreciation based on vehicle age.`,
      },
      {
        heading: 'Deductible',
        content: `A compulsory deductible applies to all own damage claims. This is the amount you must bear before the insurer pays. Additional voluntary deductible can be opted for premium discount.`,
      },
      {
        heading: 'Add-on Covers',
        content: `Optional add-ons available:
1. Zero Depreciation: Full claim without depreciation deduction on parts
2. Roadside Assistance: 24x7 help for breakdowns
3. Engine Protection: Covers engine damage due to water ingression
4. Return to Invoice: Full invoice value in case of total loss
5. Consumables Cover: Covers consumables like oil, coolant, nuts, bolts`,
      },
      {
        heading: 'Exclusions',
        content: `1. Damage while driving under influence of alcohol/drugs
2. Driving without a valid license
3. Using vehicle for purposes other than described in policy
4. Normal wear and tear, mechanical/electrical breakdown
5. Damage to tires unless accompanied by vehicle damage
6. Loss of personal belongings from the vehicle
7. Consequential losses`,
      },
      {
        heading: 'Claim Process',
        content: `1. Inform insurer immediately after the incident
2. File FIR for theft, accidents involving third parties, or fire
3. Do not repair the vehicle without surveyor inspection (except emergency repairs)
4. Submit claim form, RC copy, DL copy, and repair bills
5. Cashless repairs available at network garages`,
      },
    ],
  },
  endowment: {
    title: 'Endowment Life Insurance Policy',
    sections: [
      {
        heading: 'Policy Benefits',
        content: `This policy provides dual benefits:
1. Death Benefit: Sum Assured plus accrued bonuses payable to nominee if death occurs during policy term
2. Maturity Benefit: Sum Assured plus accrued bonuses payable to policyholder on survival till maturity`,
      },
      {
        heading: 'Bonus',
        content: `This is a participating policy eligible for bonuses. Simple Reversionary Bonus is declared annually based on company's performance. Terminal Bonus may be payable on death or maturity.`,
      },
      {
        heading: 'Premium Payment',
        content: `Premiums are payable for the premium payment term chosen. Limited Pay options available where premium payment term is shorter than policy term. Grace period of 30 days for yearly/half-yearly and 15 days for monthly premiums.`,
      },
      {
        heading: 'Surrender Value',
        content: `The policy acquires surrender value after completion of 2 full years of premium payment. Guaranteed Surrender Value (GSV) is a percentage of premiums paid. Special Surrender Value (SSV) may be higher based on bonuses accrued.`,
      },
      {
        heading: 'Loan Against Policy',
        content: `After the policy acquires surrender value, you can avail a loan up to 90% of the surrender value. Interest on loan is charged at the prevailing rate. Unpaid loan with interest is deducted from the claim amount.`,
      },
      {
        heading: 'Tax Benefits',
        content: `Premiums paid are eligible for deduction under Section 80C up to INR 1.5 lakhs. Maturity/death benefit is tax-free under Section 10(10D) subject to conditions.`,
      },
    ],
  },
}

export const LOAN_TERMS = {
  home: {
    title: 'Home Loan Agreement',
    sections: [
      {
        heading: 'Loan Details',
        content: `This agreement is for a housing loan sanctioned for purchase/construction/renovation of residential property. The loan is secured by mortgage of the property being financed.`,
      },
      {
        heading: 'Interest Rate',
        content: `Interest is charged on reducing balance basis. For floating rate loans, interest rate is linked to the lender's benchmark rate and may change periodically. For fixed rate loans, the rate remains constant for the specified period.`,
      },
      {
        heading: 'EMI Payment',
        content: `Equated Monthly Installments (EMI) are payable on the specified date each month through NACH mandate or post-dated cheques. EMI comprises principal and interest components. Interest component is higher in initial years.`,
      },
      {
        heading: 'Prepayment',
        content: `Part prepayment and full prepayment are allowed subject to terms:
1. Floating rate loans: No prepayment charges for individual borrowers
2. Fixed rate loans: Prepayment charges may apply as per schedule
3. Minimum prepayment amount may be specified`,
      },
      {
        heading: 'Insurance Requirement',
        content: `The borrower must maintain adequate property insurance covering fire, earthquake, flood, and other natural calamities throughout the loan tenure. Life insurance covering the loan amount is recommended but not mandatory.`,
      },
      {
        heading: 'Default',
        content: `In case of default in EMI payment:
1. Penal interest will be charged on overdue amount
2. Three consecutive defaults may lead to recall of the loan
3. The lender has the right to enforce the mortgage and sell the property
4. Default will be reported to credit bureaus affecting your credit score`,
      },
      {
        heading: 'Foreclosure Charges',
        content: `For complete loan closure before tenure:
1. Floating rate: No foreclosure charges for individual borrowers
2. Fixed rate: Foreclosure charges as per prevailing schedule
3. NOC and title documents released within 15 days of closure`,
      },
    ],
  },
  car: {
    title: 'Vehicle Loan Agreement',
    sections: [
      {
        heading: 'Loan Details',
        content: `This agreement is for financing the purchase of a motor vehicle. The loan is secured by hypothecation of the vehicle to the lender. The borrower cannot sell, transfer, or encumber the vehicle without lender's written consent.`,
      },
      {
        heading: 'Hypothecation',
        content: `The vehicle stands hypothecated to the lender as security for the loan. Hypothecation endorsement will be made in the Registration Certificate (RC). The hypothecation will be terminated only after full repayment of the loan.`,
      },
      {
        heading: 'EMI Payment',
        content: `EMI is payable on the specified date each month through NACH mandate. First EMI is due one month from the date of disbursement. Late payment will attract penal charges.`,
      },
      {
        heading: 'Insurance Requirement',
        content: `The borrower must maintain comprehensive motor insurance throughout the loan tenure with the lender as loss payee/hypothecatee. Proof of insurance renewal must be submitted annually.`,
      },
      {
        heading: 'Prepayment',
        content: `Part prepayment is allowed after completion of specified EMIs. Foreclosure charges may apply as per schedule. Minimum prepayment amount may be specified.`,
      },
      {
        heading: 'Repossession',
        content: `In case of default exceeding 90 days:
1. The lender may repossess the vehicle after due notice
2. Repossession charges will be borne by the borrower
3. The vehicle may be sold to recover outstanding dues
4. Any shortfall after sale remains payable by the borrower`,
      },
      {
        heading: 'Transfer of Vehicle',
        content: `The vehicle cannot be sold or transferred during the loan period without the lender's written consent. For transfer, the loan must be either closed or transferred to the new owner subject to lender approval.`,
      },
    ],
  },
  personal: {
    title: 'Personal Loan Agreement',
    sections: [
      {
        heading: 'Loan Details',
        content: `This is an unsecured personal loan granted based on your income, credit history, and repayment capacity. The loan can be used for any legitimate personal purpose including medical expenses, travel, wedding, home renovation, debt consolidation, etc.`,
      },
      {
        heading: 'Interest Rate',
        content: `Interest is charged on reducing balance basis at the agreed rate. The rate is fixed for the entire loan tenure. Processing fee is charged upfront and deducted from the disbursement amount.`,
      },
      {
        heading: 'EMI Payment',
        content: `Fixed EMI is payable monthly through NACH mandate. EMI remains constant throughout the tenure unless prepayment is made. Late payment attracts penal interest on the overdue EMI.`,
      },
      {
        heading: 'Prepayment',
        content: `Part prepayment or full prepayment is allowed subject to:
1. Lock-in period of 6-12 months may apply
2. Prepayment/foreclosure charges as per schedule
3. Minimum prepayment amount may be specified
4. Number of prepayments per year may be limited`,
      },
      {
        heading: 'Default Consequences',
        content: `In case of payment default:
1. Penal interest will be charged on overdue amounts
2. Collection calls and notices will be initiated
3. Default will be reported to credit bureaus (CIBIL, Experian, etc.)
4. Legal action may be initiated for recovery
5. This may severely impact your ability to get credit in future`,
      },
      {
        heading: 'Conditions',
        content: `1. The loan amount must be used only for legitimate purposes
2. The borrower must inform the lender of any change in contact details or employment
3. The lender may recall the loan if information provided is found to be false
4. The borrower must not take on additional debt that impacts repayment capacity`,
      },
    ],
  },
}

// US-specific variations
export const INSURANCE_TERMS_US = {
  term_life: {
    ...INSURANCE_TERMS.term_life,
    sections: INSURANCE_TERMS.term_life.sections.map((s) => ({
      ...s,
      content: s.content
        .replace('Section 10(10D) of the Income Tax Act', 'IRC Section 101(a)')
        .replace('INR', '$'),
    })),
  },
  health: {
    ...INSURANCE_TERMS.health,
    title: 'Health Insurance Plan',
    sections: [
      {
        heading: 'Coverage',
        content: `This plan covers eligible medical expenses including doctor visits, hospital stays, prescription drugs, preventive care, emergency services, and mental health services as per the plan benefits.`,
      },
      {
        heading: 'Deductible',
        content: `The annual deductible is the amount you pay before the plan starts paying. Deductible resets each plan year. Some services like preventive care may be covered without meeting the deductible.`,
      },
      {
        heading: 'Copay and Coinsurance',
        content: `After meeting your deductible:
- Copay: Fixed amount you pay per visit or service
- Coinsurance: Percentage of costs you share with the plan
In-network providers have lower copays and coinsurance.`,
      },
      {
        heading: 'Out-of-Pocket Maximum',
        content: `This is the most you'll pay during a plan year. After reaching this limit, the plan pays 100% of covered services. Deductible, copays, and coinsurance count toward this maximum.`,
      },
      {
        heading: 'Network',
        content: `Using in-network providers saves you money. Out-of-network care may cost more or may not be covered. Check the provider directory before scheduling appointments.`,
      },
      {
        heading: 'Exclusions',
        content: `1. Cosmetic procedures
2. Experimental treatments
3. Services not medically necessary
4. Care received outside the US (except emergencies)
5. Workers' compensation injuries
6. Services covered by other insurance`,
      },
    ],
  },
  car: {
    ...INSURANCE_TERMS.car,
    title: 'Auto Insurance Policy',
    sections: [
      {
        heading: 'Coverage Types',
        content: `Your policy includes:
1. Liability: Covers bodily injury and property damage you cause to others
2. Collision: Covers damage to your vehicle from collisions
3. Comprehensive: Covers theft, vandalism, weather damage, and animal strikes
4. Uninsured/Underinsured Motorist: Covers you if hit by uninsured driver`,
      },
      {
        heading: 'Deductibles',
        content: `Collision and comprehensive coverages have deductibles - the amount you pay before insurance kicks in. Higher deductibles mean lower premiums but more out-of-pocket if you file a claim.`,
      },
      {
        heading: 'Premium Factors',
        content: `Your premium is based on: driving record, age, vehicle type, location, credit score, annual mileage, coverage limits, and deductibles chosen.`,
      },
      {
        heading: 'Claims Process',
        content: `1. Report the accident to police if required
2. Document the scene with photos
3. Contact us within 24 hours
4. We'll assign an adjuster to assess damage
5. Get repair estimate from approved shops
6. Receive payment minus deductible`,
      },
      {
        heading: 'Exclusions',
        content: `1. Intentional damage
2. Using vehicle for rideshare without endorsement
3. Racing or reckless driving
4. Normal wear and tear
5. Mechanical breakdown
6. Personal belongings in the vehicle`,
      },
    ],
  },
}

export const LOAN_TERMS_US = {
  home: {
    title: 'Mortgage Loan Agreement',
    sections: [
      {
        heading: 'Loan Terms',
        content: `This mortgage loan is secured by the residential property being purchased. The loan is subject to federal Truth in Lending Act (TILA) and Real Estate Settlement Procedures Act (RESPA) disclosures.`,
      },
      {
        heading: 'Interest Rate',
        content: `For fixed-rate mortgages, the rate is locked for the entire term. For adjustable-rate mortgages (ARM), the rate adjusts periodically based on the index plus margin, subject to rate caps.`,
      },
      {
        heading: 'Monthly Payment',
        content: `Your monthly payment includes:
- Principal and Interest (P&I)
- Property taxes (escrow)
- Homeowners insurance (escrow)
- Private Mortgage Insurance (PMI) if down payment < 20%`,
      },
      {
        heading: 'Prepayment',
        content: `You may prepay principal at any time without penalty. Additional principal payments reduce total interest paid and can shorten the loan term.`,
      },
      {
        heading: 'Escrow Account',
        content: `An escrow account is maintained for property taxes and insurance. Monthly escrow payments are added to your mortgage payment. Annual escrow analysis may result in payment adjustments.`,
      },
      {
        heading: 'Default',
        content: `If you miss payments:
1. Late fee after 15-day grace period
2. After 30 days, reported to credit bureaus
3. After 120 days, foreclosure proceedings may begin
4. You may lose your home through foreclosure
Contact us immediately if you have trouble making payments.`,
      },
    ],
  },
  car: {
    title: 'Auto Loan Agreement',
    sections: [
      {
        heading: 'Security Interest',
        content: `This loan is secured by the vehicle being financed. The lender will be listed as lienholder on the title until the loan is paid in full.`,
      },
      {
        heading: 'APR and Finance Charges',
        content: `The Annual Percentage Rate (APR) represents the cost of credit. Total finance charges over the life of the loan are disclosed as required by Truth in Lending Act.`,
      },
      {
        heading: 'Monthly Payment',
        content: `Fixed monthly payment is due on the same date each month. Payment includes principal and interest. Late fee applies after the grace period.`,
      },
      {
        heading: 'Insurance Requirement',
        content: `You must maintain comprehensive and collision insurance with the lender listed as loss payee. If you fail to maintain insurance, the lender may force-place coverage at your expense.`,
      },
      {
        heading: 'Prepayment',
        content: `You may prepay without penalty. Extra payments are applied to principal, reducing total interest paid.`,
      },
      {
        heading: 'Default and Repossession',
        content: `If you default on payments, the lender may repossess the vehicle after proper notice. The vehicle may be sold, and you remain liable for any deficiency balance plus repossession costs.`,
      },
    ],
  },
  personal: {
    title: 'Personal Loan Agreement',
    sections: [
      {
        heading: 'Loan Terms',
        content: `This is an unsecured personal loan. The APR, total finance charges, and payment schedule are disclosed as required by the Truth in Lending Act.`,
      },
      {
        heading: 'Origination Fee',
        content: `An origination fee may be deducted from your loan proceeds. This fee is part of the APR calculation. Net disbursement equals loan amount minus origination fee.`,
      },
      {
        heading: 'Payment Schedule',
        content: `Fixed monthly payments are due on the same date each month via automatic bank debit. Late payments incur a fee and may be reported to credit bureaus.`,
      },
      {
        heading: 'Prepayment',
        content: `You may prepay all or part of the loan at any time without prepayment penalty. Prepayments reduce your principal balance and total interest paid.`,
      },
      {
        heading: 'Default',
        content: `A default occurs if you miss a payment or violate loan terms. Consequences include:
1. Late fees and accrued interest
2. Credit score damage
3. Collection activities
4. Potential legal action
5. Wage garnishment (if judgment obtained)`,
      },
      {
        heading: 'Right to Cancel',
        content: `You have three business days to cancel this loan after signing. To cancel, notify us in writing. Any funds received must be returned.`,
      },
    ],
  },
}

// Stock names for holdings
export const STOCKS_IN = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', price: 2450 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3890 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', price: 1650 },
  { symbol: 'INFY', name: 'Infosys Ltd', price: 1520 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', price: 1180 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', price: 2380 },
  { symbol: 'SBIN', name: 'State Bank of India', price: 780 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', price: 1580 },
  { symbol: 'ITC', name: 'ITC Ltd', price: 465 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', price: 1820 },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', price: 3450 },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', price: 1120 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', price: 2780 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', price: 12500 },
  { symbol: 'TITAN', name: 'Titan Company Ltd', price: 3250 },
]

export const STOCKS_US = [
  { symbol: 'AAPL', name: 'Apple Inc', price: 178 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: 141 },
  { symbol: 'AMZN', name: 'Amazon.com Inc', price: 178 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 875 },
  { symbol: 'META', name: 'Meta Platforms Inc', price: 505 },
  { symbol: 'TSLA', name: 'Tesla Inc', price: 248 },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', price: 408 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co', price: 198 },
  { symbol: 'V', name: 'Visa Inc', price: 280 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 156 },
  { symbol: 'WMT', name: 'Walmart Inc', price: 165 },
  { symbol: 'PG', name: 'Procter & Gamble', price: 158 },
  { symbol: 'MA', name: 'Mastercard Inc', price: 458 },
  { symbol: 'HD', name: 'Home Depot Inc', price: 345 },
]

// Mutual fund names
export const MUTUAL_FUNDS_IN = [
  { name: 'HDFC Flexi Cap Fund', amc: 'HDFC Mutual Fund', nav: 1542 },
  { name: 'ICICI Pru Bluechip Fund', amc: 'ICICI Prudential MF', nav: 89 },
  { name: 'SBI Small Cap Fund', amc: 'SBI Mutual Fund', nav: 156 },
  { name: 'Axis Long Term Equity Fund', amc: 'Axis Mutual Fund', nav: 78 },
  { name: 'Mirae Asset Large Cap Fund', amc: 'Mirae Asset MF', nav: 95 },
  { name: 'Parag Parikh Flexi Cap Fund', amc: 'PPFAS Mutual Fund', nav: 68 },
  { name: 'Kotak Emerging Equity Fund', amc: 'Kotak Mutual Fund', nav: 112 },
  { name: 'Nippon India Small Cap Fund', amc: 'Nippon India MF', nav: 145 },
  { name: 'UTI Nifty 50 Index Fund', amc: 'UTI Mutual Fund', nav: 142 },
  { name: 'Motilal Oswal Nasdaq 100 FOF', amc: 'Motilal Oswal MF', nav: 28 },
]

export const MUTUAL_FUNDS_US = [
  { name: 'Vanguard 500 Index Fund', ticker: 'VFIAX', nav: 458 },
  { name: 'Fidelity Contrafund', ticker: 'FCNTX', nav: 18.5 },
  { name: 'Vanguard Total Stock Market', ticker: 'VTSAX', nav: 118 },
  { name: 'American Funds Growth Fund', ticker: 'AGTHX', nav: 68 },
  { name: 'Fidelity 500 Index Fund', ticker: 'FXAIX', nav: 178 },
  { name: 'Vanguard Total Bond Market', ticker: 'VBTLX', nav: 10.2 },
  { name: 'T. Rowe Price Blue Chip Growth', ticker: 'TRBCX', nav: 148 },
  { name: 'Dodge & Cox Stock Fund', ticker: 'DODGX', nav: 245 },
]
