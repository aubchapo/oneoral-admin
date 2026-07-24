// =============================================================================
// Mock data source — deterministic seeded generators.
// Active when ONEORAL_DATA_SOURCE !== 'live' (the default during development).
// =============================================================================

import {
  ADDON_CATALOG,
  MEMBERSHIP_NAME,
  MEMBERSHIP_PRICE,
  type Addon,
  type Lead,
  type LeadInterest,
  type LeadStatus,
  type RawStats,
  type Subscriber,
  type SubscribersPage,
} from './types';
import type { DataSource } from './source';

// ---- Per-addon purchase probability (mock only) ----
const ADDON_PROBABILITY: Record<string, number> = {
  whitening: 0.45,
  mints: 0.55,
  'mouth-spray': 0.4,
};

// ---- Names / domains ----
const firstNames = [
  'James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth',
  'David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen',
  'Christopher','Nancy','Daniel','Lisa','Matthew','Betty','Anthony','Margaret','Mark','Sandra',
  'Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle',
  'Kenneth','Dorothy','Kevin','Carol','Brian','Amanda','George','Melissa','Edward','Deborah',
  'Ronald','Stephanie','Timothy','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia',
];
const lastNames = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
];
const interests: LeadInterest[] = ['cavities','whitening','breath','telehealth'];
const emailDomains = ['gmail.com','yahoo.com','outlook.com','icloud.com','hotmail.com'];

function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Per subscriber: 8 base rolls + one roll per addon — keep this constant so we
// can skip ahead deterministically for pagination.
const ROLLS_PER_SUB = 8 + ADDON_CATALOG.length;
const TOTAL_SUBSCRIBERS = 30000;

function generateSubscriber(index: number, random: () => number): Subscriber {
  const firstName = firstNames[Math.floor(random() * firstNames.length)];
  const lastName = lastNames[Math.floor(random() * lastNames.length)];
  const domain = emailDomains[Math.floor(random() * emailDomains.length)];
  const interest = interests[Math.floor(random() * interests.length)];

  const statusRoll = random();
  const status: Subscriber['status'] =
    statusRoll < 0.85 ? 'active' : statusRoll < 0.95 ? 'paused' : 'cancelled';

  const monthsAgo = Math.floor(random() * 18) + 1;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsAgo);

  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  const totalSpentRoll = random();
  const emailNum = Math.floor(random() * 100);

  const monthsBilled = status === 'cancelled' ? Math.max(1, Math.floor(totalSpentRoll * 6) + 1) : monthsAgo;
  const membershipSpent = Math.round(monthsBilled * MEMBERSHIP_PRICE * 100) / 100;

  const addons: Addon[] = [];
  ADDON_CATALOG.forEach((a, i) => {
    const r = random();
    const prob = ADDON_PROBABILITY[a.id] ?? 0.3;
    if (r < prob) {
      const purchase = new Date(startDate);
      purchase.setDate(purchase.getDate() + (i * 17 + (index % 30)));
      addons.push({
        id: a.id,
        name: a.name,
        price: a.price,
        purchasedAt: purchase.toISOString().split('T')[0],
      });
    }
  });
  const addonSpent = addons.reduce((sum, a) => sum + a.price, 0);

  return {
    id: `sub-${String(index + 1).padStart(6, '0')}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${emailNum}@${domain}`,
    name: `${firstName} ${lastName}`,
    status,
    interest,
    startDate: startDate.toISOString().split('T')[0],
    nextBillingDate: status === 'cancelled' ? '-' : nextBillingDate.toISOString().split('T')[0],
    monthlyAmount: MEMBERSHIP_PRICE,
    membershipSpent,
    addons,
    addonSpent,
    totalSpent: Math.round((membershipSpent + addonSpent) * 100) / 100,
    plan: MEMBERSHIP_NAME,
    solution: interest,
  };
}

// ---- Cached aggregate stats (mock) ----
let cachedRawStats: RawStats | null = null;

function computeRawStats(): RawStats {
  if (cachedRawStats) return cachedRawStats;

  const random = seededRandom(12345);
  let active = 0;
  let addonRevenueTotal = 0;
  let addonsSold = 0;
  const addonCounts: Record<string, number> = {};
  ADDON_CATALOG.forEach((a) => (addonCounts[a.id] = 0));

  for (let i = 0; i < TOTAL_SUBSCRIBERS; i++) {
    random(); random(); random(); random(); // name/domain/interest
    const statusRoll = random();
    if (statusRoll < 0.85) active++;
    random(); random(); random(); // monthsAgo, totalSpentRoll, emailNum
    ADDON_CATALOG.forEach((a) => {
      const r = random();
      const prob = ADDON_PROBABILITY[a.id] ?? 0.3;
      if (r < prob) {
        addonCounts[a.id]++;
        addonsSold++;
        addonRevenueTotal += a.price;
      }
    });
  }

  const addonSales = ADDON_CATALOG.map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price,
    count: addonCounts[a.id],
    revenue: addonCounts[a.id] * a.price,
  }));

  // Synthesize 12 months of revenue history (deterministic) so the contract
  // matches what the live source returns.
  const months: { key: string; label: string; membership: number; addons: number; newSubs: number; churned: number }[] = [];
  const now = new Date();
  const mrr = active * MEMBERSHIP_PRICE;
  const addonsMonthly = addonRevenueTotal / 12;
  const r = seededRandom(7777);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const growth = 0.55 + (11 - i) * 0.04 + r() * 0.05;
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      membership: Math.round(mrr * growth),
      addons: Math.round(addonsMonthly * (0.6 + (11 - i) * 0.04 + r() * 0.08)),
      newSubs: 200 + Math.floor(r() * 800),
      churned: 30 + Math.floor(r() * 120),
    });
  }

  cachedRawStats = {
    total: TOTAL_SUBSCRIBERS,
    active,
    // Mock: assume active + ~5% of total are subscribed-but-paused
    subscribed: active + Math.round(TOTAL_SUBSCRIBERS * 0.05),
    addonRevenueTotal,
    addonRevenueMonthly: Math.round(addonRevenueTotal / 12),
    addonsSold,
    addonSales,
    monthlyRevenue: months,
  };
  return cachedRawStats;
}

function generateSubscribersPage(page: number, pageSize: number): Subscriber[] {
  const subscribers: Subscriber[] = [];
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, TOTAL_SUBSCRIBERS);
  const random = seededRandom(12345);
  for (let i = 0; i < startIndex; i++) {
    for (let j = 0; j < ROLLS_PER_SUB; j++) random();
  }
  for (let i = startIndex; i < endIndex; i++) {
    subscribers.push(generateSubscriber(i, random));
  }
  return subscribers;
}

// ---- Leads ----
let cachedLeads: Lead[] | null = null;

function generateLeads(): Lead[] {
  const leads: Lead[] = [];
  const random = seededRandom(67890);
  const sources = ['Quiz', 'Smile Simulator', 'Direct', 'Referral', 'Social Media', 'Google Ads'];

  for (let i = 0; i < 500; i++) {
    const firstName = firstNames[Math.floor(random() * firstNames.length)];
    const lastName = lastNames[Math.floor(random() * lastNames.length)];
    const domain = emailDomains[Math.floor(random() * emailDomains.length)];
    const interest = interests[Math.floor(random() * interests.length)];
    const source = sources[Math.floor(random() * sources.length)];

    const statusRoll = random();
    const status: LeadStatus =
      statusRoll < 0.4 ? 'new' :
      statusRoll < 0.65 ? 'contacted' :
      statusRoll < 0.8 ? 'qualified' :
      statusRoll < 0.95 ? 'converted' : 'lost';

    const daysAgo = Math.floor(random() * 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    leads.push({
      id: `lead-${String(i + 1).padStart(5, '0')}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(random() * 100)}@${domain}`,
      name: `${firstName} ${lastName}`,
      phone: random() > 0.4 ? `555-${String(Math.floor(random() * 10000)).padStart(4, '0')}` : undefined,
      interest,
      solution: interest,
      status,
      source,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });
  }

  return leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// =============================================================================
// DataSource implementation
// =============================================================================

export const mockSource: DataSource = {
  async getRawStats(): Promise<RawStats> {
    return computeRawStats();
  },

  async getSubscribers(page: number, pageSize: number): Promise<SubscribersPage> {
    return {
      subscribers: generateSubscribersPage(page, pageSize),
      total: TOTAL_SUBSCRIBERS,
    };
  },

  async getSubscriberById(id: string): Promise<Subscriber | null> {
    const match = id.match(/^sub-(\d+)$/);
    if (!match) return null;
    const index = parseInt(match[1], 10) - 1;
    if (index < 0 || index >= TOTAL_SUBSCRIBERS) return null;
    const random = seededRandom(12345);
    for (let i = 0; i < index; i++) {
      for (let j = 0; j < ROLLS_PER_SUB; j++) random();
    }
    return generateSubscriber(index, random);
  },

  async getLeads(): Promise<Lead[]> {
    if (!cachedLeads) cachedLeads = generateLeads();
    return cachedLeads;
  },

  async updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    if (!cachedLeads) cachedLeads = generateLeads();
    const lead = cachedLeads.find((l) => l.id === id);
    if (!lead) return null;
    lead.status = status;
    lead.updatedAt = new Date().toISOString();
    return lead;
  },
};
