import type { Merchant, Subscription, CountryCode } from '../types'

// Indian Merchants
export const MERCHANTS_IN: Merchant[] = [
  // Food & Dining
  { name: 'Swiggy', category: 'food_dining', minAmount: 150, maxAmount: 800 },
  { name: 'Zomato', category: 'food_dining', minAmount: 150, maxAmount: 800 },
  { name: 'EatSure', category: 'food_dining', minAmount: 200, maxAmount: 600 },
  { name: 'Dominos', category: 'food_dining', minAmount: 300, maxAmount: 1000 },
  { name: 'Pizza Hut', category: 'food_dining', minAmount: 400, maxAmount: 1200 },
  { name: 'McDonalds', category: 'food_dining', minAmount: 150, maxAmount: 500 },
  { name: 'KFC', category: 'food_dining', minAmount: 200, maxAmount: 600 },
  { name: 'Starbucks', category: 'food_dining', minAmount: 300, maxAmount: 800 },
  { name: 'Chaayos', category: 'food_dining', minAmount: 100, maxAmount: 400 },
  { name: 'Haldirams', category: 'food_dining', minAmount: 200, maxAmount: 1500 },
  { name: 'Barbeque Nation', category: 'food_dining', minAmount: 1000, maxAmount: 4000 },
  { name: 'Mainland China', category: 'food_dining', minAmount: 1500, maxAmount: 5000 },

  // Groceries
  { name: 'Blinkit', category: 'groceries', minAmount: 200, maxAmount: 2500 },
  { name: 'BigBasket', category: 'groceries', minAmount: 300, maxAmount: 3000 },
  { name: 'Zepto', category: 'groceries', minAmount: 150, maxAmount: 1500 },
  { name: 'DMart', category: 'groceries', minAmount: 500, maxAmount: 5000 },
  { name: 'Reliance Fresh', category: 'groceries', minAmount: 300, maxAmount: 3000 },
  { name: 'More Supermarket', category: 'groceries', minAmount: 200, maxAmount: 2000 },
  { name: 'Nature Basket', category: 'groceries', minAmount: 400, maxAmount: 3500 },

  // Shopping
  { name: 'Amazon', category: 'shopping', minAmount: 500, maxAmount: 15000 },
  { name: 'Flipkart', category: 'shopping', minAmount: 500, maxAmount: 15000 },
  { name: 'Myntra', category: 'shopping', minAmount: 500, maxAmount: 8000 },
  { name: 'Ajio', category: 'shopping', minAmount: 400, maxAmount: 6000 },
  { name: 'Nykaa', category: 'shopping', minAmount: 300, maxAmount: 5000 },
  { name: 'Tata Cliq', category: 'shopping', minAmount: 500, maxAmount: 10000 },
  { name: 'Croma', category: 'shopping', minAmount: 1000, maxAmount: 50000 },
  { name: 'Reliance Digital', category: 'shopping', minAmount: 1000, maxAmount: 50000 },
  { name: 'Shoppers Stop', category: 'shopping', minAmount: 1000, maxAmount: 15000 },
  { name: 'Lifestyle', category: 'shopping', minAmount: 800, maxAmount: 10000 },
  { name: 'Westside', category: 'shopping', minAmount: 500, maxAmount: 8000 },

  // Fuel
  { name: 'HP Petrol Pump', category: 'fuel', minAmount: 500, maxAmount: 3500 },
  { name: 'Indian Oil', category: 'fuel', minAmount: 500, maxAmount: 3500 },
  { name: 'Bharat Petroleum', category: 'fuel', minAmount: 500, maxAmount: 3500 },
  { name: 'Shell', category: 'fuel', minAmount: 600, maxAmount: 4000 },

  // Ride & Travel
  { name: 'Uber', category: 'travel', minAmount: 80, maxAmount: 1200 },
  { name: 'Ola', category: 'travel', minAmount: 80, maxAmount: 1000 },
  { name: 'Rapido', category: 'travel', minAmount: 50, maxAmount: 300 },
  { name: 'MakeMyTrip', category: 'travel', minAmount: 2000, maxAmount: 50000 },
  { name: 'IRCTC', category: 'travel', minAmount: 500, maxAmount: 5000 },
  { name: 'Cleartrip', category: 'travel', minAmount: 2000, maxAmount: 40000 },
  { name: 'Goibibo', category: 'travel', minAmount: 1500, maxAmount: 30000 },
  { name: 'OYO Rooms', category: 'travel', minAmount: 800, maxAmount: 5000 },
  { name: 'Airbnb', category: 'travel', minAmount: 2000, maxAmount: 15000 },
  { name: 'RedBus', category: 'travel', minAmount: 300, maxAmount: 2000 },

  // Healthcare
  { name: 'Apollo Pharmacy', category: 'healthcare', minAmount: 200, maxAmount: 3000 },
  { name: '1mg', category: 'healthcare', minAmount: 150, maxAmount: 2000 },
  { name: 'PharmEasy', category: 'healthcare', minAmount: 200, maxAmount: 2500 },
  { name: 'Netmeds', category: 'healthcare', minAmount: 150, maxAmount: 2000 },
  { name: 'Apollo Hospital', category: 'healthcare', minAmount: 500, maxAmount: 10000 },
  { name: 'Practo', category: 'healthcare', minAmount: 300, maxAmount: 1500 },

  // Fitness & Personal Care
  { name: 'Cult Fit', category: 'personal_care', minAmount: 500, maxAmount: 3000 },
  { name: 'Gold Gym', category: 'personal_care', minAmount: 1000, maxAmount: 5000 },
  { name: 'Urban Company', category: 'personal_care', minAmount: 300, maxAmount: 3000 },
  { name: 'Lakme Salon', category: 'personal_care', minAmount: 500, maxAmount: 5000 },

  // Gifts
  { name: 'IGP', category: 'gifts', minAmount: 500, maxAmount: 5000 },
  { name: 'Ferns N Petals', category: 'gifts', minAmount: 500, maxAmount: 4000 },
  { name: 'Amazon Gift Card', category: 'gifts', minAmount: 500, maxAmount: 10000 },
  { name: 'Archies', category: 'gifts', minAmount: 200, maxAmount: 2000 },

  // Entertainment
  { name: 'BookMyShow', category: 'entertainment', minAmount: 200, maxAmount: 2000 },
  { name: 'PVR Cinemas', category: 'entertainment', minAmount: 300, maxAmount: 1500 },
  { name: 'INOX', category: 'entertainment', minAmount: 300, maxAmount: 1500 },

  // Education
  { name: 'Udemy', category: 'education', minAmount: 400, maxAmount: 3000 },
  { name: 'Coursera', category: 'education', minAmount: 2000, maxAmount: 8000 },
  { name: 'Unacademy', category: 'education', minAmount: 500, maxAmount: 20000 },
]

// US Merchants
export const MERCHANTS_US: Merchant[] = [
  // Food & Dining
  { name: 'DoorDash', category: 'food_dining', minAmount: 15, maxAmount: 60 },
  { name: 'Uber Eats', category: 'food_dining', minAmount: 15, maxAmount: 55 },
  { name: 'Grubhub', category: 'food_dining', minAmount: 15, maxAmount: 50 },
  { name: 'Chipotle', category: 'food_dining', minAmount: 10, maxAmount: 25 },
  { name: 'Starbucks', category: 'food_dining', minAmount: 5, maxAmount: 20 },
  { name: 'McDonalds', category: 'food_dining', minAmount: 8, maxAmount: 25 },
  { name: 'Chick-fil-A', category: 'food_dining', minAmount: 10, maxAmount: 30 },
  { name: 'Panera Bread', category: 'food_dining', minAmount: 12, maxAmount: 35 },
  { name: 'The Cheesecake Factory', category: 'food_dining', minAmount: 30, maxAmount: 150 },
  { name: 'Olive Garden', category: 'food_dining', minAmount: 25, maxAmount: 100 },
  { name: 'Texas Roadhouse', category: 'food_dining', minAmount: 20, maxAmount: 80 },

  // Groceries
  { name: 'Whole Foods', category: 'groceries', minAmount: 30, maxAmount: 300 },
  { name: 'Trader Joes', category: 'groceries', minAmount: 25, maxAmount: 200 },
  { name: 'Costco', category: 'groceries', minAmount: 50, maxAmount: 400 },
  { name: 'Safeway', category: 'groceries', minAmount: 30, maxAmount: 250 },
  { name: 'Kroger', category: 'groceries', minAmount: 25, maxAmount: 200 },
  { name: 'Publix', category: 'groceries', minAmount: 30, maxAmount: 200 },
  { name: 'Instacart', category: 'groceries', minAmount: 40, maxAmount: 250 },

  // Shopping
  { name: 'Amazon', category: 'shopping', minAmount: 20, maxAmount: 500 },
  { name: 'Target', category: 'shopping', minAmount: 20, maxAmount: 300 },
  { name: 'Walmart', category: 'shopping', minAmount: 15, maxAmount: 250 },
  { name: 'Best Buy', category: 'shopping', minAmount: 50, maxAmount: 1500 },
  { name: 'Apple Store', category: 'shopping', minAmount: 30, maxAmount: 2000 },
  { name: 'Home Depot', category: 'shopping', minAmount: 30, maxAmount: 500 },
  { name: 'Lowes', category: 'shopping', minAmount: 25, maxAmount: 400 },
  { name: 'Nordstrom', category: 'shopping', minAmount: 50, maxAmount: 500 },
  { name: 'Macys', category: 'shopping', minAmount: 30, maxAmount: 300 },
  { name: 'Nike', category: 'shopping', minAmount: 50, maxAmount: 250 },
  { name: 'Sephora', category: 'shopping', minAmount: 30, maxAmount: 200 },

  // Gas
  { name: 'Shell', category: 'gas', minAmount: 30, maxAmount: 80 },
  { name: 'Chevron', category: 'gas', minAmount: 30, maxAmount: 80 },
  { name: 'BP', category: 'gas', minAmount: 30, maxAmount: 75 },
  { name: 'Exxon', category: 'gas', minAmount: 30, maxAmount: 80 },
  { name: 'Costco Gas', category: 'gas', minAmount: 35, maxAmount: 90 },

  // Ride & Travel
  { name: 'Uber', category: 'travel', minAmount: 10, maxAmount: 80 },
  { name: 'Lyft', category: 'travel', minAmount: 10, maxAmount: 70 },
  { name: 'Delta Airlines', category: 'travel', minAmount: 150, maxAmount: 800 },
  { name: 'United Airlines', category: 'travel', minAmount: 150, maxAmount: 800 },
  { name: 'Southwest Airlines', category: 'travel', minAmount: 100, maxAmount: 500 },
  { name: 'American Airlines', category: 'travel', minAmount: 150, maxAmount: 800 },
  { name: 'Marriott', category: 'travel', minAmount: 100, maxAmount: 400 },
  { name: 'Hilton', category: 'travel', minAmount: 100, maxAmount: 350 },
  { name: 'Airbnb', category: 'travel', minAmount: 80, maxAmount: 400 },
  { name: 'Expedia', category: 'travel', minAmount: 100, maxAmount: 600 },

  // Healthcare
  { name: 'CVS Pharmacy', category: 'healthcare', minAmount: 10, maxAmount: 200 },
  { name: 'Walgreens', category: 'healthcare', minAmount: 10, maxAmount: 150 },
  { name: 'Rite Aid', category: 'healthcare', minAmount: 10, maxAmount: 100 },

  // Fitness & Personal Care
  { name: 'Planet Fitness', category: 'personal_care', minAmount: 20, maxAmount: 50 },
  { name: 'LA Fitness', category: 'personal_care', minAmount: 30, maxAmount: 60 },
  { name: 'Equinox', category: 'personal_care', minAmount: 150, maxAmount: 300 },
  { name: 'Great Clips', category: 'personal_care', minAmount: 15, maxAmount: 40 },

  // Gifts
  { name: '1-800-Flowers', category: 'gifts', minAmount: 40, maxAmount: 150 },
  { name: 'Amazon Gift Card', category: 'gifts', minAmount: 25, maxAmount: 200 },
  { name: 'Hallmark', category: 'gifts', minAmount: 10, maxAmount: 50 },

  // Entertainment
  { name: 'AMC Theatres', category: 'entertainment', minAmount: 15, maxAmount: 60 },
  { name: 'Regal Cinemas', category: 'entertainment', minAmount: 15, maxAmount: 50 },
  { name: 'Dave & Busters', category: 'entertainment', minAmount: 30, maxAmount: 100 },

  // Education
  { name: 'Udemy', category: 'education', minAmount: 10, maxAmount: 100 },
  { name: 'Coursera', category: 'education', minAmount: 30, maxAmount: 80 },
  { name: 'LinkedIn Learning', category: 'education', minAmount: 30, maxAmount: 60 },
]

// Subscriptions (recurring monthly)
export const SUBSCRIPTIONS_IN: Subscription[] = [
  { name: 'Netflix', amount: 649, billingDay: 15, category: 'subscription' },
  { name: 'Amazon Prime', amount: 149, billingDay: 1, category: 'subscription' },
  { name: 'Spotify', amount: 119, billingDay: 10, category: 'subscription' },
  { name: 'YouTube Premium', amount: 129, billingDay: 5, category: 'subscription' },
  { name: 'Disney+ Hotstar', amount: 299, billingDay: 20, category: 'subscription' },
  { name: 'Claude AI', amount: 1700, billingDay: 12, category: 'software' },
  { name: 'ChatGPT Plus', amount: 1700, billingDay: 8, category: 'software' },
  { name: 'iCloud Storage', amount: 75, billingDay: 25, category: 'software' },
  { name: 'Google One', amount: 130, billingDay: 18, category: 'software' },
  { name: 'Microsoft 365', amount: 420, billingDay: 22, category: 'software' },
  { name: 'Notion', amount: 800, billingDay: 3, category: 'software' },
  { name: 'Jio Postpaid', amount: 399, billingDay: 5, category: 'mobile_internet' },
  { name: 'Airtel Postpaid', amount: 499, billingDay: 7, category: 'mobile_internet' },
  { name: 'ACT Fibernet', amount: 999, billingDay: 1, category: 'mobile_internet' },
]

export const SUBSCRIPTIONS_US: Subscription[] = [
  { name: 'Netflix', amount: 15.49, billingDay: 15, category: 'subscription' },
  { name: 'Amazon Prime', amount: 14.99, billingDay: 1, category: 'subscription' },
  { name: 'Spotify', amount: 10.99, billingDay: 10, category: 'subscription' },
  { name: 'YouTube Premium', amount: 13.99, billingDay: 5, category: 'subscription' },
  { name: 'Disney+', amount: 13.99, billingDay: 20, category: 'subscription' },
  { name: 'HBO Max', amount: 15.99, billingDay: 18, category: 'subscription' },
  { name: 'Hulu', amount: 17.99, billingDay: 22, category: 'subscription' },
  { name: 'Apple TV+', amount: 9.99, billingDay: 25, category: 'subscription' },
  { name: 'Claude AI', amount: 20, billingDay: 12, category: 'software' },
  { name: 'ChatGPT Plus', amount: 20, billingDay: 8, category: 'software' },
  { name: 'iCloud Storage', amount: 2.99, billingDay: 25, category: 'software' },
  { name: 'Google One', amount: 2.99, billingDay: 18, category: 'software' },
  { name: 'Microsoft 365', amount: 9.99, billingDay: 22, category: 'software' },
  { name: 'Notion', amount: 10, billingDay: 3, category: 'software' },
  { name: 'Verizon', amount: 80, billingDay: 5, category: 'phone_internet' },
  { name: 'AT&T', amount: 75, billingDay: 7, category: 'phone_internet' },
  { name: 'Xfinity', amount: 89, billingDay: 1, category: 'phone_internet' },
]

// Get merchants by country
export function getMerchants(country: CountryCode): Merchant[] {
  return country === 'IN' ? MERCHANTS_IN : MERCHANTS_US
}

// Get subscriptions by country
export function getSubscriptions(country: CountryCode): Subscription[] {
  return country === 'IN' ? SUBSCRIPTIONS_IN : SUBSCRIPTIONS_US
}

// Get random merchant from category
export function getRandomMerchant(
  country: CountryCode,
  category?: string
): Merchant {
  const merchants = getMerchants(country)
  const filtered = category
    ? merchants.filter((m) => m.category === category)
    : merchants
  return filtered[Math.floor(Math.random() * filtered.length)]
}

// Person names for P2P transfers
export const PERSON_NAMES_IN = [
  'Rahul Sharma',
  'Priya Patel',
  'Amit Kumar',
  'Sneha Gupta',
  'Vikram Singh',
  'Ananya Reddy',
  'Arjun Nair',
  'Kavita Iyer',
  'Rajesh Verma',
  'Meera Krishnan',
  'Suresh Rao',
  'Deepa Menon',
  'Arun Joshi',
  'Pooja Desai',
  'Sanjay Pillai',
]

export const PERSON_NAMES_US = [
  'John Smith',
  'Emily Johnson',
  'Michael Williams',
  'Sarah Davis',
  'David Miller',
  'Jessica Wilson',
  'Christopher Moore',
  'Ashley Taylor',
  'Matthew Anderson',
  'Amanda Thomas',
  'Daniel Jackson',
  'Jennifer White',
  'James Harris',
  'Stephanie Martin',
  'Robert Thompson',
]

export function getPersonNames(country: CountryCode): string[] {
  return country === 'IN' ? PERSON_NAMES_IN : PERSON_NAMES_US
}

// Employer names for salary
export const EMPLOYERS_IN = [
  'Nexus Technologies Pvt Ltd',
  'Horizon Software Solutions',
  'Pinnacle Infotech Ltd',
  'Vertex Systems India',
  'Catalyst Digital Services',
  'Prism Innovations Pvt Ltd',
  'Quantum Tech Solutions',
  'Elevate Consulting India',
  'Synergy Software Ltd',
  'Meridian Technologies',
  'Atlas Data Systems',
  'Nova Fintech Pvt Ltd',
  'Zenith Cloud Services',
  'Apex Digital Solutions',
  'Fusion Tech India',
]

export const EMPLOYERS_US = [
  'Nexus Technologies Inc',
  'Horizon Software Corp',
  'Pinnacle Systems LLC',
  'Vertex Solutions Inc',
  'Catalyst Digital Corp',
  'Prism Innovations LLC',
  'Quantum Tech Inc',
  'Elevate Consulting Group',
  'Synergy Software Inc',
  'Meridian Technologies Corp',
  'Atlas Data Systems LLC',
  'Nova Financial Tech Inc',
  'Zenith Cloud Corp',
  'Apex Digital Inc',
  'Fusion Capital Partners',
]

export function getEmployers(country: CountryCode): string[] {
  return country === 'IN' ? EMPLOYERS_IN : EMPLOYERS_US
}
