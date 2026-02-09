import type { User } from './types';

// Lead type for the CRM
export interface Lead {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  solution: 'cavities' | 'whitening' | 'breath' | 'drill-free' | 'telehealth' | 'biotest';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Subscriber type
export interface Subscriber {
  id: string;
  email: string;
  name: string;
  plan: string;
  status: 'active' | 'paused' | 'cancelled';
  solution: string;
  startDate: string;
  nextBillingDate: string;
  monthlyAmount: number;
  totalSpent: number;
}

// Name generators for realistic data
const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah',
  'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
  'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
  'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
  'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra', 'Frank', 'Rachel',
  'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Catherine', 'Dennis', 'Maria', 'Jerry', 'Heather',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
  'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
  'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
  'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez',
];

const solutions = ['cavities', 'whitening', 'breath', 'drill-free', 'telehealth', 'biotest'];
const plans: Record<string, string> = {
  'cavities': 'Cavity Prevention',
  'whitening': 'Whitening System',
  'breath': 'Fresh Breath Protocol',
  'drill-free': 'Drill-Free Care',
  'telehealth': 'Virtual Dentist',
  'biotest': 'Microbiome Testing',
};

const emailDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com', 'aol.com'];

// Seeded random number generator for consistent data
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Generate 30,000 subscribers
function generateSubscribers(): Subscriber[] {
  const subscribers: Subscriber[] = [];
  const random = seededRandom(12345);

  for (let i = 0; i < 30000; i++) {
    const firstName = firstNames[Math.floor(random() * firstNames.length)];
    const lastName = lastNames[Math.floor(random() * lastNames.length)];
    const domain = emailDomains[Math.floor(random() * emailDomains.length)];
    const solution = solutions[Math.floor(random() * solutions.length)];

    // Status distribution: 85% active, 10% paused, 5% cancelled
    const statusRoll = random();
    const status: 'active' | 'paused' | 'cancelled' =
      statusRoll < 0.85 ? 'active' : statusRoll < 0.95 ? 'paused' : 'cancelled';

    // Generate start date (between 1-18 months ago)
    const monthsAgo = Math.floor(random() * 18) + 1;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsAgo);

    // Next billing date (next month from now, unless cancelled)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const totalSpent = status === 'cancelled'
      ? Math.floor(random() * 6 + 1) * 49
      : monthsAgo * 49;

    subscribers.push({
      id: `sub-${String(i + 1).padStart(6, '0')}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(random() * 100)}@${domain}`,
      name: `${firstName} ${lastName}`,
      plan: plans[solution],
      status,
      solution,
      startDate: startDate.toISOString().split('T')[0],
      nextBillingDate: status === 'cancelled' ? '-' : nextBillingDate.toISOString().split('T')[0],
      monthlyAmount: 49,
      totalSpent,
    });
  }

  return subscribers;
}

// Generate leads (500 leads)
function generateLeads(): Lead[] {
  const leads: Lead[] = [];
  const random = seededRandom(67890);
  const sources = ['Quiz', 'Smile Simulator', 'Direct', 'Referral', 'Social Media', 'Google Ads'];

  for (let i = 0; i < 500; i++) {
    const firstName = firstNames[Math.floor(random() * firstNames.length)];
    const lastName = lastNames[Math.floor(random() * lastNames.length)];
    const domain = emailDomains[Math.floor(random() * emailDomains.length)];
    const solution = solutions[Math.floor(random() * solutions.length)] as Lead['solution'];
    const source = sources[Math.floor(random() * sources.length)];

    // Status distribution: 40% new, 25% contacted, 15% qualified, 15% converted, 5% lost
    const statusRoll = random();
    const status: Lead['status'] =
      statusRoll < 0.40 ? 'new' :
      statusRoll < 0.65 ? 'contacted' :
      statusRoll < 0.80 ? 'qualified' :
      statusRoll < 0.95 ? 'converted' : 'lost';

    // Created within last 30 days
    const daysAgo = Math.floor(random() * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    leads.push({
      id: `lead-${String(i + 1).padStart(5, '0')}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(random() * 100)}@${domain}`,
      name: `${firstName} ${lastName}`,
      phone: random() > 0.4 ? `555-${String(Math.floor(random() * 10000)).padStart(4, '0')}` : undefined,
      solution,
      status,
      source,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });
  }

  // Sort by created date (newest first)
  return leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Cache the generated data
let cachedSubscribers: Subscriber[] | null = null;
let cachedLeads: Lead[] | null = null;

// Mock data API
export const adminApi = {
  // Get all subscribers
  getSubscribers: async (): Promise<Subscriber[]> => {
    if (!cachedSubscribers) {
      cachedSubscribers = generateSubscribers();
    }
    return cachedSubscribers;
  },

  // Get all leads
  getLeads: async (): Promise<Lead[]> => {
    if (!cachedLeads) {
      cachedLeads = generateLeads();
    }
    return cachedLeads;
  },

  // Update lead status
  updateLeadStatus: async (id: string, status: Lead['status']): Promise<Lead> => {
    console.log(`Updating lead ${id} to status ${status}`);
    return {} as Lead;
  },

  // Get users (patients) - not used in mock mode
  getUsers: async (): Promise<User[]> => {
    return [];
  },
};

export default {};
