import { format, parse, eachDayOfInterval, eachMonthOfInterval, addDays, isWeekend } from 'date-fns'
import type { CountryCode, MoneyScale, AccountHolder } from '../types'

// Format date for display
export function formatDate(date: Date, formatStr: string = 'dd/MM/yyyy'): string {
  return format(date, formatStr)
}

// Parse date from DD/MM/YYYY format
export function parseDate(dateStr: string): Date {
  return parse(dateStr, 'dd/MM/yyyy', new Date())
}

// Generate random number between min and max
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Generate random decimal between min and max with precision
export function randomDecimal(min: number, max: number, precision: number = 2): number {
  const value = Math.random() * (max - min) + min
  return Number(value.toFixed(precision))
}

// Pick random item from array
export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Pick multiple random items from array without repetition
export function randomPickMultiple<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, arr.length))
}

// Generate random ID
export function generateId(prefix: string = ''): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = prefix
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

// Generate random account number
export function generateAccountNumber(country: CountryCode): string {
  if (country === 'IN') {
    // Indian account numbers are typically 11-16 digits
    return Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('')
  }
  // US account numbers are typically 9-12 digits
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('')
}

// Generate random credit card number (masked)
export function generateCardNumber(): string {
  const last4 = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
  return `XXXX XXXX XXXX ${last4}`
}

// Generate IFSC code (India)
export function generateIFSC(bankId: string): string {
  const bankCodes: Record<string, string> = {
    hdfc: 'HDFC',
    icici: 'ICIC',
    sbi: 'SBIN',
    axis: 'UTIB',
    kotak: 'KKBK',
    indusind: 'INDB',
    yes: 'YESB',
    idfc: 'IDFB',
    pnb: 'PUNB',
    bob: 'BARB',
  }
  const code = bankCodes[bankId] || 'BANK'
  const branchCode = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  return `${code}0${branchCode.slice(0, 5)}`
}

// Generate routing number (US)
export function generateRoutingNumber(): string {
  return Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
}

// Generate PAN (India)
export function generatePAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const first5 = Array.from({ length: 5 }, () => randomPick(letters.split(''))).join('')
  const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
  const last = randomPick(letters.split(''))
  return `${first5}${digits}${last}`
}

// Generate last 4 of SSN (US)
export function generateSSNLast4(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
}

// Generate phone number
export function generatePhone(country: CountryCode): string {
  if (country === 'IN') {
    const prefixes = ['98', '99', '97', '96', '95', '94', '93', '91', '90', '89', '88', '87', '86', '85']
    const prefix = randomPick(prefixes)
    const rest = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
    return `+91 ${prefix}${rest.slice(0, 3)} ${rest.slice(3, 5)}${rest.slice(5)}`
  }
  const areaCode = randomBetween(200, 999)
  const exchange = randomBetween(200, 999)
  const subscriber = randomBetween(1000, 9999)
  return `+1 (${areaCode}) ${exchange}-${subscriber}`
}

// Generate email from name
export function generateEmail(name: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']
  const clean = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')
  const num = randomBetween(1, 99)
  return `${clean}${num}@${randomPick(domains)}`
}

// Generate address
export function generateAddress(country: CountryCode): string {
  if (country === 'IN') {
    const cities = [
      { city: 'Mumbai', state: 'Maharashtra', pin: '400' },
      { city: 'Delhi', state: 'Delhi', pin: '110' },
      { city: 'Bangalore', state: 'Karnataka', pin: '560' },
      { city: 'Chennai', state: 'Tamil Nadu', pin: '600' },
      { city: 'Hyderabad', state: 'Telangana', pin: '500' },
      { city: 'Pune', state: 'Maharashtra', pin: '411' },
      { city: 'Kolkata', state: 'West Bengal', pin: '700' },
      { city: 'Ahmedabad', state: 'Gujarat', pin: '380' },
    ]
    const loc = randomPick(cities)
    const houseNo = randomBetween(1, 500)
    const streets = ['MG Road', 'Park Street', 'Brigade Road', 'Anna Nagar', 'Banjara Hills', 'Koramangala', 'Andheri West']
    return `${houseNo}, ${randomPick(streets)}, ${loc.city}, ${loc.state} - ${loc.pin}${randomBetween(1, 99).toString().padStart(2, '0')}1`
  }

  const cities = [
    { city: 'New York', state: 'NY', zip: '100' },
    { city: 'Los Angeles', state: 'CA', zip: '900' },
    { city: 'Chicago', state: 'IL', zip: '606' },
    { city: 'Houston', state: 'TX', zip: '770' },
    { city: 'Phoenix', state: 'AZ', zip: '850' },
    { city: 'San Francisco', state: 'CA', zip: '941' },
    { city: 'Seattle', state: 'WA', zip: '981' },
    { city: 'Boston', state: 'MA', zip: '021' },
  ]
  const loc = randomPick(cities)
  const streetNo = randomBetween(100, 9999)
  const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Pine St', 'Cedar Ln', 'Elm St', 'Park Ave', 'Broadway']
  const aptNo = Math.random() > 0.5 ? `, Apt ${randomBetween(1, 50)}` : ''
  return `${streetNo} ${randomPick(streets)}${aptNo}, ${loc.city}, ${loc.state} ${loc.zip}${randomBetween(10, 99)}`
}

// Generate account holder
export function generateAccountHolder(country: CountryCode): AccountHolder {
  const firstNamesIN = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Ananya', 'Arjun', 'Kavita', 'Rajesh', 'Meera']
  const lastNamesIN = ['Sharma', 'Patel', 'Kumar', 'Gupta', 'Singh', 'Reddy', 'Nair', 'Iyer', 'Verma', 'Krishnan']
  const firstNamesUS = ['John', 'Emily', 'Michael', 'Sarah', 'David', 'Jessica', 'Christopher', 'Ashley', 'Matthew', 'Amanda']
  const lastNamesUS = ['Smith', 'Johnson', 'Williams', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas']

  const firstName = randomPick(country === 'IN' ? firstNamesIN : firstNamesUS)
  const lastName = randomPick(country === 'IN' ? lastNamesIN : lastNamesUS)
  const name = `${firstName} ${lastName}`

  return {
    name,
    email: generateEmail(name),
    phone: generatePhone(country),
    address: generateAddress(country),
    ...(country === 'IN' ? { pan: generatePAN() } : { ssn: generateSSNLast4() }),
  }
}

// Get salary range based on scale
export function getSalaryRange(country: CountryCode, scale: MoneyScale): { min: number; max: number } {
  const ranges = {
    IN: {
      1: { min: 30000, max: 50000 },
      2: { min: 50000, max: 100000 },
      3: { min: 100000, max: 200000 },
      4: { min: 200000, max: 400000 },
      5: { min: 400000, max: 800000 },
    },
    US: {
      1: { min: 3000, max: 5000 },
      2: { min: 5000, max: 8000 },
      3: { min: 8000, max: 12000 },
      4: { min: 12000, max: 20000 },
      5: { min: 20000, max: 35000 },
    },
  }
  return ranges[country][scale]
}

// Get transaction frequency based on scale
export function getTransactionFrequency(scale: MoneyScale): { ccPerMonth: { min: number; max: number }; bankPerMonth: { min: number; max: number } } {
  const frequencies = {
    1: { ccPerMonth: { min: 15, max: 25 }, bankPerMonth: { min: 2, max: 4 } },
    2: { ccPerMonth: { min: 25, max: 40 }, bankPerMonth: { min: 4, max: 6 } },
    3: { ccPerMonth: { min: 40, max: 60 }, bankPerMonth: { min: 6, max: 10 } },
    4: { ccPerMonth: { min: 60, max: 80 }, bankPerMonth: { min: 10, max: 15 } },
    5: { ccPerMonth: { min: 80, max: 120 }, bankPerMonth: { min: 15, max: 25 } },
  }
  return frequencies[scale]
}

// Get subscription count based on scale
export function getSubscriptionCount(scale: MoneyScale): number {
  const counts = { 1: 2, 2: 3, 3: 5, 4: 7, 5: 10 }
  return counts[scale]
}

// Format currency
export function formatCurrency(amount: number, country: CountryCode): string {
  if (country === 'IN') {
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
    return `INR ${formatted}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Get working days in a month (excluding weekends)
export function getWorkingDays(year: number, month: number): Date[] {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d))
}

// Get all months in a date range
export function getMonthsInRange(start: Date, end: Date): Date[] {
  return eachMonthOfInterval({ start, end })
}

// Get a random date within a month, optionally on a specific day
export function getDateInMonth(year: number, month: number, preferredDay?: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = preferredDay ? Math.min(preferredDay, lastDay) : randomBetween(1, lastDay)
  return new Date(year, month, day)
}

// Get next business day if date falls on weekend
export function getNextBusinessDay(date: Date): Date {
  let result = date
  while (isWeekend(result)) {
    result = addDays(result, 1)
  }
  return result
}

// Scale amount based on money scale
export function scaleAmount(baseAmount: number, scale: MoneyScale, variance: number = 0.3): number {
  const multipliers = { 1: 0.5, 2: 0.75, 3: 1, 4: 1.5, 5: 2.5 }
  const multiplier = multipliers[scale]
  const varianceFactor = 1 + (Math.random() * variance * 2 - variance)
  return Math.round(baseAmount * multiplier * varianceFactor)
}

// Apply scale-based probability (higher scale = higher probability for expensive items)
export function shouldInclude(scale: MoneyScale, baseChance: number = 0.5): boolean {
  const adjustedChance = baseChance * (scale / 3)
  return Math.random() < Math.min(adjustedChance, 1)
}
