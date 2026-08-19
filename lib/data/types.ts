// =============================================================================
// OneOral Admin — Data Layer Types & Constants
// -----------------------------------------------------------------------------
// This file is the single source of truth for the shapes the UI consumes and
// the API routes serve. The mock and live data sources both implement these.
// =============================================================================

// ---------- Pricing & catalog constants ----------

export const MEMBERSHIP_PRICE = 49.99;
export const MEMBERSHIP_NAME = 'OneOral Membership';

// CariFree COGS — each member receives a quarterly kit
export const CARIFREE_KIT_COST = 15;
export const KITS_PER_YEAR = 4;
export const KIT_COST_PER_MONTH = (CARIFREE_KIT_COST * KITS_PER_YEAR) / 12;

// Add-on catalog. The live source MUST return revenue/counts keyed by these ids.
export const ADDON_CATALOG: { id: string; name: string; price: number }[] = [
  { id: 'whitening', name: 'Whitening Kit', price: 39 },
  { id: 'mints', name: 'Mints', price: 12 },
  { id: 'mouth-spray', name: 'Mouth Spray', price: 18 },
];

// ---------- Lead types (CRM) ----------

export type LeadInterest = 'cavities' | 'whitening' | 'breath' | 'telehealth' | 'gums' | 'drill-free';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type LeadDropOff = 'quiz' | 'checkout' | 'payment';

export interface Lead {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  goals?: string[];      // multi-select quiz goals
  dropOff?: LeadDropOff; // where they abandoned
  interest: LeadInterest;
  /** Kit they signed up on / were recommended (quiz risk → HRK/LRK), when known */
  kit?: KitType;
  /** Promo code applied at checkout (Stripe subscription metadata), when known */
  promoCode?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Back-compat alias for any older callers
  solution: LeadInterest;
}

// ---------- Subscriber / member types ----------

export type SubscriberStatus = 'active' | 'paused' | 'cancelled' | 'incomplete';

export interface Addon {
  id: string;
  name: string;
  price: number;
  purchasedAt: string;
}

export type KitType = 'HRK' | 'LRK';

export interface Subscriber {
  id: string;
  email: string;
  name: string;
  status: SubscriberStatus;
  interest: string;
  startDate: string;
  nextBillingDate: string;
  monthlyAmount: number; // real normalized $/month from their Stripe sub items
  membershipSpent: number;
  addons: Addon[];
  addonSpent: number;
  totalSpent: number;
  /** ISO date — only set when status === 'paused' and Stripe has a resumes_at */
  pauseResumesAt?: string;
  /** Kit type from quiz (stripe metadata.membershipType): complete=HRK, essential=LRK */
  kitType?: KitType;
  /** Promo code applied at checkout (Stripe subscription metadata) */
  promoCode?: string;
  /**
   * Founding-500 free-whitening member. `foundingSlot` is their 1-based spot
   * number; it's absent on subscriptions that took the offer but whose
   * invoice.paid claim hasn't landed yet, so treat isFounding as the flag and
   * the slot as decoration.
   */
  isFounding?: boolean;
  foundingSlot?: number;
  /**
   * Where the kit actually goes — read from the Stripe customer's SHIPPING
   * address, not the billing one. Someone who moves to Texas keeps a
   * California card, and billing would file them under the wrong state for
   * good; delivery is the only field that says where a member lives.
   */
  shipState?: string;
  shipCity?: string;
  /**
   * True when no shipping address existed and the billing address was read
   * instead. Shown rather than hidden: a state inferred from billing is a
   * guess, and a segment built on guesses should say so.
   */
  shipStateFromBilling?: boolean;
  /**
   * What this customer pays for OTHER people's seats, and how many. Kept apart
   * from `monthlyAmount` on purpose: a primary paying 2 x $39.99 for family
   * members was having that total reported as his own rate, when his plan is a
   * different subscription at a different price.
   */
  familySeatMonthly?: number;
  familySeats?: number;
  /** False for someone who only pays for others and holds no plan themselves. */
  hasOwnMembership?: boolean;
  // Back-compat
  plan: string;
  solution: string;
}

// ---------- Stats returned by /api/stats ----------

export interface AddonSale {
  id: string;
  name: string;
  price: number;
  count: number;
  revenue: number;
}

/** Members per promo code (from Stripe subscription metadata.promoCode). */
export interface PromoUsage {
  code: string;
  /** Unique customers who ever signed up with this code (excl. incomplete) */
  members: number;
  /** Of those, currently active */
  active: number;
}

/** Single point in the trailing-12-month history. */
export interface MonthlyRevenuePoint {
  /** ISO YYYY-MM */
  key: string;
  /** Display label, e.g. "Apr 2026" */
  label: string;
  membership: number;
  addons: number;
  newSubs: number;
  churned: number;
}

/** Raw stats the data source must compute (everything else is derived). */
export interface RawStats {
  total: number;
  active: number;
  /** Currently subscribed (active OR paused). Cancelled excluded. */
  subscribed: number;
  /** Real MRR from actual subscription items (quarterly plans normalized to $/mo).
   *  When absent, enrichStats falls back to active × MEMBERSHIP_PRICE. */
  mrr?: number;
  /** Recurring revenue split by billing cycle (stripe source only):
   *  monthlyRR = $/month billed by monthly-plan members;
   *  quarterlyRR = $/quarter billed by quarterly-plan members. */
  monthlyRR?: number;
  quarterlyRR?: number;
  monthlyPlanMembers?: number;
  quarterlyPlanMembers?: number;
  addonRevenueTotal: number;
  addonRevenueMonthly: number;
  addonsSold: number;
  addonSales: AddonSale[];
  /** Promo-code usage across members, most-used first (stripe source only) */
  promoUsage?: PromoUsage[];
  /** Trailing 12 months, oldest → newest. Both arrays the same length. */
  monthlyRevenue: MonthlyRevenuePoint[];
}

/** Real shipment totals from NetSuite (only present when ONEORAL connected). */
export interface NetsuiteKitTotals {
  hrkShipped: number;
  lrkShipped: number;
  totalShipped: number;
  shipmentCount: number;
}

/** Final stats payload served to the UI. */
export interface Stats extends RawStats {
  mrr: number;
  // CariFree COGS / margin — kits ship per subscribed member (active or paused)
  kitsPerQuarter: number;       // = subscribed
  kitsPerYear: number;          // = subscribed × 4
  kitCostPerQuarter: number;    // = kitsPerQuarter × $15
  kitCostPerYear: number;       // = kitsPerYear × $15
  membershipRevenue12mo: number;
  grossMargin12mo: number;      // membershipRevenue12mo − (kitsShipped over those 12mo × $15)
  grossMarginPercent: number;
  // Real trends (current month vs prior month, fraction e.g. 0.12 = +12%)
  revenueTrend: number;
  addonTrend: number;
  // Trailing 12mo total revenue (membership + addons)
  trailingRevenue12mo: number;
  // Real NetSuite shipment data — present only when configured
  netsuiteKits?: NetsuiteKitTotals;
}

// ---------- Pagination contracts ----------

export interface SubscribersPage {
  subscribers: Subscriber[];
  total: number;
}
