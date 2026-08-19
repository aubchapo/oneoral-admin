// =============================================================================
// Stripe data source — reads real subscribers, charges, and add-on sales from
// the OneOral Stripe account. Activated by ONEORAL_DATA_SOURCE=stripe.
// =============================================================================
//
// Required env vars (see .env.example):
//   STRIPE_SECRET_KEY              - sk_live_... or sk_test_...
//
// How prices are classified (self-configuring from the Stripe price catalog):
//   The checkout splits every membership into two subscription items — a
//   taxable kit price + a tax-exempt services price — resolved by lookup key
//   per billing cycle. So "membership" is a SET of prices, never one id:
//     oneoral_kit_*        → membership (kit portion)
//     oneoral_services_*   → membership (services portion)
//     oneoral_membership_* → membership (legacy unsplit prices)
//     family_member        → membership (family add-a-member)
//     addon_*              → add-on (recurring + one-time variants)
//     refill_*             → add-on (one-time refills)
//   Prices with no lookup key inherit membership status from their product
//   (covers the original $49.99 price that predates lookup keys).
//
// Notes:
//   - Stripe doesn't own funnel leads. getLeads merges the main site's lead
//     store with Stripe incomplete subscriptions (payment abandonments).
//   - Aggregate stats are cached in-process for STATS_TTL_MS to keep API call
//     volume sane. Restart the dev server (or wait out the TTL) to refresh.
// =============================================================================

import 'server-only';
import Stripe from 'stripe';
import {
  MEMBERSHIP_NAME,
  type Addon,
  type AddonSale,
  type KitType,
  type Lead,
  type LeadDropOff,
  type LeadInterest,
  type LeadStatus,
  type MonthlyRevenuePoint,
  type RawStats,
  type Subscriber,
  type SubscribersPage,
} from './types';
import type { DataSource } from './source';

// ---- Lazy Stripe client (so missing env vars only fail when stripe mode is on) ----

let _stripe: Stripe | null = null;
function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      '[oneoral-admin] STRIPE_SECRET_KEY is not set. Add it to .env.local or switch ONEORAL_DATA_SOURCE=mock.'
    );
  }
  _stripe = new Stripe(key);
  return _stripe;
}

// ---- Price catalog (fetched from Stripe, classified by lookup key) ----

type PriceCategory = 'membership' | 'addon';

interface PriceInfo {
  id: string;
  lookupKey: string | null;
  category: PriceCategory;
  /** Grouping key for add-on sales, e.g. "whitening-trays" (monthly/quarterly/one-time variants share it) */
  addonKey?: string;
  productId: string;
  productName: string;
  /** Dollars */
  unitAmount: number;
  /** Normalized $/month for recurring prices; 0 for one-time */
  monthlyAmount: number;
  /** Billing period in months (1 = monthly, 3 = quarterly, 0 = one-time) */
  intervalMonths: number;
  recurring: boolean;
}

interface Catalog {
  byPriceId: Map<string, PriceInfo>;
  /** Canonical display name + unit price per addonKey (prefers the monthly variant) */
  addonMeta: Map<string, { name: string; price: number }>;
}

const MEMBERSHIP_LOOKUP_RE = /^(oneoral_kit_|oneoral_services_|oneoral_membership_|family_member)/;
const ADDON_LOOKUP_RE = /^(addon_|refill_)/;

function addonKeyFromLookup(lookupKey: string): string {
  // addon_whitening_trays_once_quarterly → whitening-trays ; refill_toothpaste → refill-toothpaste
  return lookupKey
    .replace(/^addon_/, '')
    .replace(/_(once_)?(monthly|quarterly|yearly)$/, '')
    .replace(/_/g, '-');
}

const CATALOG_TTL_MS = 30 * 60 * 1000;
let cachedCatalog: { value: Catalog; expires: number } | null = null;

async function getCatalog(): Promise<Catalog> {
  if (cachedCatalog && cachedCatalog.expires > Date.now()) return cachedCatalog.value;

  const byPriceId = new Map<string, PriceInfo>();
  const membershipProductIds = new Set<string>();
  const raw: Stripe.Price[] = [];
  for await (const price of stripe().prices.list({ limit: 100, expand: ['data.product'] })) {
    raw.push(price);
  }

  const build = (price: Stripe.Price, category: PriceCategory, addonKey?: string): PriceInfo => {
    const product = price.product as Stripe.Product;
    const unitAmount = (price.unit_amount ?? 0) / 100;
    const rec = price.recurring;
    const intervalMonths =
      rec?.interval === 'month'
        ? rec.interval_count || 1
        : rec?.interval === 'year'
          ? 12 * (rec.interval_count || 1)
          : 0;
    const monthlyAmount = intervalMonths > 0 ? unitAmount / intervalMonths : 0;
    return {
      id: price.id,
      lookupKey: price.lookup_key ?? null,
      category,
      addonKey,
      productId: typeof product === 'string' ? product : product.id,
      productName: typeof product === 'string' ? product : product.name,
      unitAmount,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      intervalMonths,
      recurring: !!rec,
    };
  };

  // Pass 1 — classify by lookup key
  const unclassified: Stripe.Price[] = [];
  for (const price of raw) {
    const key = price.lookup_key ?? '';
    if (MEMBERSHIP_LOOKUP_RE.test(key)) {
      const info = build(price, 'membership');
      byPriceId.set(price.id, info);
      membershipProductIds.add(info.productId);
    } else if (ADDON_LOOKUP_RE.test(key)) {
      byPriceId.set(price.id, build(price, 'addon', addonKeyFromLookup(key)));
    } else {
      unclassified.push(price);
    }
  }
  // Extra hint: an explicitly configured membership price id always counts
  const envMembership = process.env.STRIPE_MEMBERSHIP_PRICE_ID;

  // Pass 2 — no lookup key: membership if it shares a membership product
  for (const price of unclassified) {
    const product = price.product as Stripe.Product;
    const productId = typeof product === 'string' ? product : product.id;
    if (membershipProductIds.has(productId) || price.id === envMembership) {
      byPriceId.set(price.id, build(price, 'membership'));
    }
    // Anything else (unknown one-offs) stays out of the catalog and is ignored.
  }

  // Add-on display meta: prefer the monthly recurring variant's name/price
  const addonMeta = new Map<string, { name: string; price: number }>();
  for (const info of byPriceId.values()) {
    if (info.category !== 'addon' || !info.addonKey) continue;
    const existing = addonMeta.get(info.addonKey);
    const isMonthly = /_monthly$/.test(info.lookupKey ?? '') && info.recurring;
    if (!existing || isMonthly) {
      addonMeta.set(info.addonKey, {
        name: info.productName.replace(/^OneOral /, ''),
        price: info.unitAmount,
      });
    }
  }

  const value: Catalog = { byPriceId, addonMeta };
  cachedCatalog = { value, expires: Date.now() + CATALOG_TTL_MS };
  return value;
}

/** Pull the price id off an invoice line item across Stripe API versions. */
function lineItemPriceId(line: Stripe.InvoiceLineItem): string | null {
  // Newer API: line.pricing.price_details.price
  // Older API: line.price.id
  const anyLine = line as unknown as {
    pricing?: { price_details?: { price?: string | null } };
    price?: { id?: string | null } | null;
  };
  return anyLine.pricing?.price_details?.price ?? anyLine.price?.id ?? null;
}

/** What the line actually collected, in dollars — list amount minus the
 *  discounts allocated to it (a 100%-off comp invoice nets $0, 50% nets half). */
function lineItemNet(line: Stripe.InvoiceLineItem): number {
  const discounts =
    (line.discount_amounts ?? []).reduce((sum, d) => sum + (d.amount ?? 0), 0);
  return ((line.amount ?? 0) - discounts) / 100;
}

// ---- Status mapping ----

function mapSubscriptionStatus(sub: Stripe.Subscription): Subscriber['status'] {
  // Customer-portal "pause" sets pause_collection but leaves status === 'active'
  if (sub.pause_collection) return 'paused';
  const s = sub.status;
  if (s === 'active' || s === 'trialing') return 'active';
  // Signup never completed first payment — not the same as a real cancellation
  if (s === 'incomplete' || s === 'incomplete_expired') return 'incomplete';
  if (s === 'past_due' || s === 'paused' || s === 'unpaid') return 'paused';
  return 'cancelled';
}

function kitTypeFromMetadata(metadata: Stripe.Metadata | null | undefined): KitType | undefined {
  const m = metadata?.membershipType;
  if (m === 'complete') return 'HRK';
  if (m === 'essential') return 'LRK';
  return undefined;
}

/** True when the subscription contains at least one membership-classified item. */
function isMembershipSub(sub: Stripe.Subscription, catalog: Catalog): boolean {
  return sub.items.data.some((it) => catalog.byPriceId.get(it.price.id)?.category === 'membership');
}

/**
 * Is this subscription the customer's OWN membership?
 *
 * Family seats and practice platform fees are billed on the same membership
 * prices, so isMembershipSub() says yes to all three — which is correct when
 * the question is "is this membership revenue" and wrong when it's "what is
 * this person on". A primary paying for two family members carries a second
 * subscription of 2 x $39.99, and picking that one made the admin report $79.98
 * as his monthly when his own plan is $65.56. The portal hit the identical bug
 * and marks the two exceptions in metadata (see lib/plan-addons.ts there);
 * this is the same test, on this side of the wall.
 */
function isOwnMembershipSub(sub: Stripe.Subscription, catalog: Catalog): boolean {
  const kind = sub.metadata?.kind;
  return isMembershipSub(sub, catalog) && kind !== 'family_members' && kind !== 'practice_platform_fee';
}

/** What a customer pays for OTHER people's seats — never part of their own plan. */
function familySeatMonthly(
  subs: Stripe.Subscription[],
  catalog: Catalog,
  coupons: Map<string, CouponTerms>
): { monthly: number; seats: number } {
  let monthly = 0;
  let seats = 0;
  for (const sub of subs) {
    if (sub.metadata?.kind !== 'family_members') continue;
    if (sub.status !== 'active' && sub.status !== 'trialing' && sub.status !== 'past_due') continue;
    monthly += subTotalMonthly(sub, catalog, coupons);
    seats += sub.items.data.reduce((n, it) => Math.max(n, it.quantity ?? 1), 0);
  }
  return { monthly: Math.round(monthly * 100) / 100, seats };
}

// ---- Coupons (so RR reflects what members actually pay, not list price) ----

interface CouponTerms {
  percentOff: number | null;
  amountOff: number | null; // cents
  duration: string | null;
}

let cachedCoupons: { value: Map<string, CouponTerms>; expires: number } | null = null;

async function getCoupons(): Promise<Map<string, CouponTerms>> {
  if (cachedCoupons && cachedCoupons.expires > Date.now()) return cachedCoupons.value;
  const map = new Map<string, CouponTerms>();
  try {
    for await (const c of stripe().coupons.list({ limit: 100 })) {
      map.set(c.id, {
        percentOff: c.percent_off ?? null,
        amountOff: c.amount_off ?? null,
        duration: c.duration ?? null,
      });
    }
  } catch (err) {
    console.error('[stripe] coupons.list failed — RR will use list prices:', err);
  }
  cachedCoupons = { value: map, expires: Date.now() + CATALOG_TTL_MS };
  return map;
}

/**
 * The sub's ongoing recurring discount (skips one-shot coupons and expired
 * windows). A 100%-off admin/affiliate comp yields multiplier 0 — those members
 * contribute nothing to RR; a 50% forever code contributes half.
 */
function recurringDiscount(
  sub: Stripe.Subscription,
  coupons: Map<string, CouponTerms>
): { multiplier: number; amountOff: number } {
  let multiplier = 1;
  let amountOff = 0;
  const raw: unknown[] = [
    ...(Array.isArray(sub.discounts) ? sub.discounts : []),
    (sub as unknown as { discount?: unknown }).discount,
  ];
  for (const item of raw) {
    if (!item || typeof item === 'string') continue; // unexpanded — nothing to apply
    const d = item as {
      end?: number | null;
      coupon?: string | { id?: string; percent_off?: number | null; amount_off?: number | null; duration?: string | null } | null;
      source?: { coupon?: string | null } | null;
    };
    if (d.end && d.end * 1000 < Date.now()) continue; // discount window over
    let terms: CouponTerms | undefined;
    if (d.coupon && typeof d.coupon === 'object') {
      // Older API shape: coupon embedded on the discount
      terms = {
        percentOff: d.coupon.percent_off ?? null,
        amountOff: d.coupon.amount_off ?? null,
        duration: d.coupon.duration ?? null,
      };
    } else {
      // Newer API shape: discount.source.coupon is an id
      const id = typeof d.coupon === 'string' ? d.coupon : (d.source?.coupon ?? null);
      if (id) terms = coupons.get(id);
    }
    if (!terms) continue;
    if (terms.duration === 'once') continue; // first invoice only — not recurring
    if (terms.percentOff) multiplier *= 1 - terms.percentOff / 100;
    if (terms.amountOff) amountOff += terms.amountOff / 100;
  }
  return { multiplier, amountOff };
}

/** What the sub actually bills per period for membership, after ongoing discounts. */
function subRecurring(
  sub: Stripe.Subscription,
  catalog: Catalog,
  coupons: Map<string, CouponTerms>
): { period: number; months: number } {
  let periodTotal = 0;
  let months = 1;
  for (const it of sub.items.data) {
    const info = catalog.byPriceId.get(it.price.id);
    if (info?.category === 'membership') {
      periodTotal += info.unitAmount * (it.quantity ?? 1);
      months = Math.max(months, info.intervalMonths || 1);
    }
  }
  const { multiplier, amountOff } = recurringDiscount(sub, coupons);
  const period = Math.max(0, periodTotal * multiplier - amountOff);
  return { period: Math.round(period * 100) / 100, months };
}

/**
 * Everything recurring on this subscription as $/month — membership AND the
 * add-ons riding on it.
 *
 * Separate from subRecurring() on purpose. That one answers "how much
 * membership revenue" and feeds the dashboard's MRR, which is deliberately kept
 * apart from add-on revenue. This one answers "what does this person actually
 * pay every month", which is the number on their own billing page and the only
 * one they'd recognise: a member on the complete plan with three add-ons is
 * charged $65.56, and reporting $49.99 because the add-ons sat in items we
 * skipped made the admin disagree with the member's own screen.
 *
 * Per-item normalisation, so a quarterly add-on on a monthly plan is counted at
 * a third of its charge rather than at face value.
 */
function subTotalMonthly(
  sub: Stripe.Subscription,
  catalog: Catalog,
  coupons: Map<string, CouponTerms>
): number {
  let monthly = 0;
  for (const it of sub.items.data) {
    const info = catalog.byPriceId.get(it.price.id);
    if (!info?.recurring) continue;
    monthly += info.monthlyAmount * (it.quantity ?? 1);
  }
  const { multiplier, amountOff } = recurringDiscount(sub, coupons);
  const { months } = subRecurring(sub, catalog, coupons);
  const net = monthly * multiplier - amountOff / Math.max(1, months);
  return Math.round(Math.max(0, net) * 100) / 100;
}

/** Real $/month across the sub's membership items (discounts applied, quarterly normalized). */
function subMonthlyAmount(
  sub: Stripe.Subscription,
  catalog: Catalog,
  coupons: Map<string, CouponTerms>
): number {
  const { period, months } = subRecurring(sub, catalog, coupons);
  return Math.round((period / months) * 100) / 100;
}

// ---- Subscriber assembly ----

interface BuiltSubscriber {
  subscriber: Subscriber;
  active: boolean;
}

async function buildSubscriberFromCustomer(
  customer: Stripe.Customer,
  subscription: Stripe.Subscription | null,
  catalog: Catalog,
  coupons: Map<string, CouponTerms>,
  options: { includeInvoices?: boolean } = {}
): Promise<BuiltSubscriber> {
  const status = subscription ? mapSubscriptionStatus(subscription) : 'cancelled';
  const startDate = subscription
    ? new Date(subscription.start_date * 1000).toISOString().split('T')[0]
    : new Date(customer.created * 1000).toISOString().split('T')[0];
  // Newer Stripe API: period info lives on each subscription item
  const periodEnd = subscription?.items?.data?.[0]?.current_period_end;
  const nextBillingDate =
    subscription && status === 'active' && periodEnd
      ? new Date(periodEnd * 1000).toISOString().split('T')[0]
      : '-';

  const pauseResumesAt =
    subscription?.pause_collection?.resumes_at
      ? new Date(subscription.pause_collection.resumes_at * 1000).toISOString().split('T')[0]
      : undefined;

  const monthlyAmount = subscription ? subTotalMonthly(subscription, catalog, coupons) : 0;

  let membershipSpent = 0;
  let addonSpent = 0;
  const addons: Addon[] = [];

  if (options.includeInvoices) {
    // Walk paid invoices to compute exact spend split (only for the detail view)
    for await (const inv of stripe().invoices.list({ customer: customer.id, status: 'paid', limit: 100 })) {
      for (const line of inv.lines.data) {
        const lineAmount = lineItemNet(line);
        const info = catalog.byPriceId.get(lineItemPriceId(line) ?? '');
        if (!info) continue;
        if (info.category === 'membership') {
          membershipSpent += lineAmount;
        } else if (info.addonKey) {
          const meta = catalog.addonMeta.get(info.addonKey);
          addonSpent += lineAmount;
          addons.push({
            id: info.addonKey,
            name: meta?.name ?? info.productName,
            price: info.unitAmount,
            purchasedAt: new Date((inv.created ?? 0) * 1000).toISOString().split('T')[0],
          });
        }
      }
    }
  } else {
    // Fast path for the list view: estimate membership spend from tenure.
    // Accurate enough for display; the detail page does the real walk.
    const startMs = new Date(startDate).getTime();
    const months = Math.max(0, Math.round((Date.now() - startMs) / (1000 * 60 * 60 * 24 * 30)));
    membershipSpent = Math.round(months * monthlyAmount * 100) / 100;
  }

  // Delivery beats billing, always. `customer.address` is what the card says;
  // `customer.shipping.address` is where the box goes, and the two diverge the
  // moment someone moves without reissuing a card.
  const shipAddress = customer.shipping?.address ?? null;
  const billingAddress = customer.address ?? null;
  const deliveryAddress = shipAddress ?? billingAddress;

  const subscriber: Subscriber = {
    id: customer.id,
    email: customer.email ?? '',
    name: customer.name ?? customer.email ?? customer.id,
    status,
    interest: 'cavities', // Stripe doesn't track this; default for now
    startDate,
    nextBillingDate,
    monthlyAmount,
    membershipSpent: Math.round(membershipSpent * 100) / 100,
    addons,
    addonSpent: Math.round(addonSpent * 100) / 100,
    totalSpent: Math.round((membershipSpent + addonSpent) * 100) / 100,
    pauseResumesAt,
    kitType: kitTypeFromMetadata(subscription?.metadata) ?? kitTypeFromMetadata(customer.metadata),
    promoCode: subscription?.metadata?.promoCode || customer.metadata?.promoCode || undefined,
    isFounding: subscription?.metadata?.foundingWhitening === 'true' || undefined,
    foundingSlot: subscription?.metadata?.foundingWhiteningSlot
      ? Number(subscription.metadata.foundingWhiteningSlot)
      : undefined,
    shipState: deliveryAddress?.state?.toUpperCase() || undefined,
    shipCity: deliveryAddress?.city || undefined,
    shipStateFromBilling: !shipAddress?.state && !!billingAddress?.state ? true : undefined,
    plan: MEMBERSHIP_NAME,
    solution: 'cavities',
  };

  return { subscriber, active: status === 'active' };
}

// ---- In-process caches ----

const STATS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUBS_TTL_MS = 5 * 60 * 1000;
const PAID_TTL_MS = 5 * 60 * 1000;

let cachedRawStats: { value: RawStats; expires: number } | null = null;
let cachedAllSubscribers: { value: Subscriber[]; expires: number } | null = null;
let cachedPaidByEmail: { value: Map<string, string | undefined>; expires: number } | null = null;

/**
 * Everyone who actually got past payment (any non-incomplete membership sub),
 * keyed by lowercased email → promo code they used (if any). Leads matching
 * this map are customers, not drop-offs.
 */
async function getPaidByEmail(catalog: Catalog): Promise<Map<string, string | undefined>> {
  if (cachedPaidByEmail && cachedPaidByEmail.expires > Date.now()) return cachedPaidByEmail.value;

  const paid = new Map<string, string | undefined>();
  for await (const sub of stripe().subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'] })) {
    if (!isMembershipSub(sub, catalog)) continue;
    if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') continue;
    const customer = sub.customer as Stripe.Customer;
    if (typeof customer === 'string' || customer.deleted || !customer.email) continue;
    const email = customer.email.toLowerCase();
    const promo = sub.metadata?.promoCode || customer.metadata?.promoCode || undefined;
    if (!paid.has(email) || (promo && !paid.get(email))) paid.set(email, promo);
  }
  cachedPaidByEmail = { value: paid, expires: Date.now() + PAID_TTL_MS };
  return paid;
}

// ---- DataSource implementation ----

export const stripeSource: DataSource = {
  async getRawStats(): Promise<RawStats> {
    if (cachedRawStats && cachedRawStats.expires > Date.now()) return cachedRawStats.value;

    const catalog = await getCatalog();
    const coupons = await getCoupons();

    // ---- Build trailing-12-month buckets up front ----
    const now = new Date();
    const months: MonthlyRevenuePoint[] = [];
    const monthIndex = new Map<string, number>(); // YYYY-MM → index in months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthIndex.set(key, months.length);
      months.push({
        key,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        membership: 0,
        addons: 0,
        newSubs: 0,
        churned: 0,
      });
    }
    const monthKeyForUnix = (sec: number) => {
      const d = new Date(sec * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    // ---- Walk ALL subscriptions: count unique customers + new/churn buckets ----
    // Membership = any sub containing a membership-classified price item.
    // Incomplete signups are leads, not members — they're excluded from totals.
    const seen = new Set<string>();
    const activeCustomers = new Set<string>();
    const subscribedCustomers = new Set<string>(); // active OR paused (still receiving kits)
    const promoMembers = new Map<string, Set<string>>(); // code → unique customers
    const promoActive = new Map<string, Set<string>>();
    const monthlyPlanCustomers = new Set<string>();
    const quarterlyPlanCustomers = new Set<string>();
    let mrr = 0;
    let monthlyRR = 0; // $/month billed by monthly-plan members
    let quarterlyRR = 0; // $/quarter billed by quarterly-plan members
    for await (const sub of stripe().subscriptions.list({ status: 'all', limit: 100, expand: ['data.discounts'] })) {
      if (!isMembershipSub(sub, catalog)) continue;
      // Skip incompletes entirely from member counts
      if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') continue;

      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      seen.add(customerId);
      const isActive = (sub.status === 'active' || sub.status === 'trialing') && !sub.pause_collection;
      const isPaused = !!sub.pause_collection || sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'paused';
      if (isActive) {
        activeCustomers.add(customerId);
        // Billing-cycle split on what they ACTUALLY pay: 100%-off comps
        // (admin/affiliate) contribute $0 and stay out of the plan buckets;
        // 50%-off members count at half.
        const { period, months } = subRecurring(sub, catalog, coupons);
        mrr += period / months;
        if (period > 0) {
          if (months >= 3) {
            quarterlyRR += period;
            quarterlyPlanCustomers.add(customerId);
          } else {
            monthlyRR += period;
            monthlyPlanCustomers.add(customerId);
          }
        }
      }
      if (isActive || isPaused) subscribedCustomers.add(customerId);
      // Promo-code usage
      const promo = sub.metadata?.promoCode;
      if (promo) {
        if (!promoMembers.has(promo)) promoMembers.set(promo, new Set());
        promoMembers.get(promo)!.add(customerId);
        if (isActive) {
          if (!promoActive.has(promo)) promoActive.set(promo, new Set());
          promoActive.get(promo)!.add(customerId);
        }
      }
      // New signups bucket
      const startKey = monthKeyForUnix(sub.start_date);
      const startIdx = monthIndex.get(startKey);
      if (startIdx !== undefined) months[startIdx].newSubs += 1;
      // Churn bucket
      if (sub.canceled_at) {
        const cancelKey = monthKeyForUnix(sub.canceled_at);
        const cancelIdx = monthIndex.get(cancelKey);
        if (cancelIdx !== undefined) months[cancelIdx].churned += 1;
      }
    }
    const total = seen.size;
    const active = activeCustomers.size;
    const subscribed = subscribedCustomers.size;

    // ---- Walk paid invoices for the last 12 months: bucket revenue per month ----
    const addonCounts: Record<string, number> = {};
    const addonRevenue: Record<string, number> = {};
    let addonsSold = 0;
    let addonRevenueTotal = 0;
    let addonRevenueLast30Days = 0;

    const oneYearAgo = Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60;
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    for await (const inv of stripe().invoices.list({
      status: 'paid',
      created: { gte: oneYearAgo },
      limit: 100,
    })) {
      const invDate = inv.created ?? 0;
      const invKey = monthKeyForUnix(invDate);
      const invMonthIdx = monthIndex.get(invKey);

      for (const line of inv.lines.data) {
        const lineAmount = lineItemNet(line);
        const info = catalog.byPriceId.get(lineItemPriceId(line) ?? '');
        if (!info) continue; // unknown one-offs stay out of both buckets

        if (info.category === 'membership') {
          if (invMonthIdx !== undefined) months[invMonthIdx].membership += lineAmount;
          continue;
        }
        const key = info.addonKey!;
        const qty = line.quantity ?? 1;
        addonCounts[key] = (addonCounts[key] ?? 0) + qty;
        addonRevenue[key] = (addonRevenue[key] ?? 0) + lineAmount;
        addonsSold += qty;
        addonRevenueTotal += lineAmount;
        if (invDate >= thirtyDaysAgo) addonRevenueLast30Days += lineAmount;
        if (invMonthIdx !== undefined) months[invMonthIdx].addons += lineAmount;
      }
    }

    // Round monthly buckets
    months.forEach((m) => {
      m.membership = Math.round(m.membership * 100) / 100;
      m.addons = Math.round(m.addons * 100) / 100;
    });

    // Add-on sales from the real catalog (every add-on, sold or not), plus any
    // keys that only appear in historical invoices (e.g. retired prices).
    const addonKeys = new Set<string>([...catalog.addonMeta.keys(), ...Object.keys(addonCounts)]);
    const addonSales: AddonSale[] = Array.from(addonKeys)
      .map((key) => {
        const meta = catalog.addonMeta.get(key);
        return {
          id: key,
          name: meta?.name ?? key.replace(/-/g, ' '),
          price: meta?.price ?? 0,
          count: addonCounts[key] ?? 0,
          revenue: Math.round((addonRevenue[key] ?? 0) * 100) / 100,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name));

    const value: RawStats = {
      total,
      active,
      subscribed,
      mrr: Math.round(mrr * 100) / 100,
      monthlyRR: Math.round(monthlyRR * 100) / 100,
      quarterlyRR: Math.round(quarterlyRR * 100) / 100,
      monthlyPlanMembers: monthlyPlanCustomers.size,
      quarterlyPlanMembers: quarterlyPlanCustomers.size,
      addonRevenueTotal: Math.round(addonRevenueTotal * 100) / 100,
      addonRevenueMonthly: Math.round(addonRevenueLast30Days * 100) / 100,
      addonsSold,
      addonSales,
      promoUsage: Array.from(promoMembers.entries())
        .map(([code, members]) => ({
          code,
          members: members.size,
          active: promoActive.get(code)?.size ?? 0,
        }))
        .sort((a, b) => b.members - a.members || a.code.localeCompare(b.code)),
      monthlyRevenue: months,
    };
    cachedRawStats = { value, expires: Date.now() + STATS_TTL_MS };
    return value;
  },

  async getSubscribers(page: number, pageSize: number): Promise<SubscribersPage> {
    if (!cachedAllSubscribers || cachedAllSubscribers.expires < Date.now()) {
      const catalog = await getCatalog();
      const coupons = await getCoupons();
      // Collect every subscription per customer first, then decide. Deciding
      // inside the loop is what produced the family-seat bug: each subscription
      // was ranked on status and start date alone, so a primary's 2 x $39.99
      // seat subscription — newer than his own plan and equally active — won,
      // and the admin reported what he pays for other people as his own rate.
      const byCustomerSubs = new Map<string, { customer: Stripe.Customer; subs: Stripe.Subscription[] }>();

      for await (const sub of stripe().subscriptions.list({
        status: 'all',
        limit: 100,
        expand: ['data.customer', 'data.discounts'],
      })) {
        if (!isMembershipSub(sub, catalog)) continue;
        // Incompletes are leads, not members — skip
        if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') continue;

        const customer = sub.customer as Stripe.Customer;
        if (typeof customer === 'string' || customer.deleted) continue;
        const entry = byCustomerSubs.get(customer.id);
        if (entry) entry.subs.push(sub);
        else byCustomerSubs.set(customer.id, { customer, subs: [sub] });
      }

      // Their own plan, best first: active beats paused beats cancelled, newest
      // breaks a tie. Stripe writes a fresh subscription record on every
      // resubscribe, which is the reason a customer has more than one at all.
      const rank: Record<string, number> = { active: 4, trialing: 4, past_due: 3, paused: 3, unpaid: 3, canceled: 2 };
      const best = (subs: Stripe.Subscription[]): Stripe.Subscription | null =>
        subs.reduce<Stripe.Subscription | null>((winner, s) => {
          if (!winner) return s;
          const a = rank[s.status] ?? 1;
          const b = rank[winner.status] ?? 1;
          return a > b || (a === b && s.created > winner.created) ? s : winner;
        }, null);

      const list: Subscriber[] = [];
      for (const { customer, subs } of byCustomerSubs.values()) {
        const own = subs.filter((s) => isOwnMembershipSub(s, catalog));
        // Someone whose only subscription is a family plan pays for other
        // people and holds no membership themselves. They still belong in the
        // list — falling back to `subs` keeps them visible rather than making
        // a paying customer disappear — but the seat figures below say plainly
        // that the money is other people's.
        const chosen = best(own.length ? own : subs);
        const built = await buildSubscriberFromCustomer(customer, chosen, catalog, coupons);
        const family = familySeatMonthly(subs, catalog, coupons);
        list.push({
          ...built.subscriber,
          hasOwnMembership: own.length > 0,
          familySeatMonthly: family.monthly || undefined,
          familySeats: family.seats || undefined,
        });
      }

      list.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
      cachedAllSubscribers = { value: list, expires: Date.now() + SUBS_TTL_MS };
    }

    const all = cachedAllSubscribers.value;
    const start = (page - 1) * pageSize;
    return {
      subscribers: all.slice(start, start + pageSize),
      total: all.length,
    };
  },

  async getSubscriberById(id: string): Promise<Subscriber | null> {
    try {
      const catalog = await getCatalog();
      const coupons = await getCoupons();
      const customer = await stripe().customers.retrieve(id);
      if ((customer as Stripe.DeletedCustomer).deleted) return null;
      const subs = await stripe().subscriptions.list({ customer: id, status: 'all', limit: 20, expand: ['data.discounts'] });
      // Their own plan — never the family-seat subscription, which is billed on
      // the same prices and would otherwise report other people's seats as this
      // person's rate.
      const own = subs.data.filter((s) => isOwnMembershipSub(s, catalog));
      const membershipSub = own[0] ?? subs.data.find((s) => isMembershipSub(s, catalog)) ?? subs.data[0] ?? null;
      const built = await buildSubscriberFromCustomer(
        customer as Stripe.Customer,
        membershipSub,
        catalog,
        coupons,
        { includeInvoices: true }
      );
      const family = familySeatMonthly(subs.data, catalog, coupons);
      return {
        ...built.subscriber,
        hasOwnMembership: own.length > 0,
        familySeatMonthly: family.monthly || undefined,
        familySeats: family.seats || undefined,
      };
    } catch (err) {
      if ((err as { code?: string })?.code === 'resource_missing') return null;
      throw err;
    }
  },

  // ---- Leads = quiz/checkout abandonment from main site + Stripe incomplete subs ----
  async getLeads(): Promise<Lead[]> {
    const leads: Lead[] = [];
    const seenEmails = new Set<string>();
    const catalog = await getCatalog();
    // Cross-reference against real paying customers: a lead who completed
    // payment is converted (not "dropped at payment"), and carries their promo.
    const paidByEmail = await getPaidByEmail(catalog);

    // 1. Fetch quiz/checkout leads from main site API
    const mainSiteUrl = process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002';
    const serviceKey = process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';
    try {
      const res = await fetch(`${mainSiteUrl}/api/leads`, {
        headers: { 'x-api-key': serviceKey },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json() as { leads: Array<{ id: string; email: string; name?: string; goals?: string[]; dropOff?: string; status: string; source?: string; kit?: string | null; createdAt: string; updatedAt: string }> };
        for (const l of data.leads) {
          if (seenEmails.has(l.email)) continue;
          seenEmails.add(l.email);
          const primary = (l.goals?.[0] ?? 'cavities') as LeadInterest;
          const paidKey = l.email.toLowerCase();
          const isPaid = paidByEmail.has(paidKey);
          leads.push({
            id: l.id,
            email: l.email,
            name: l.name || undefined,
            goals: l.goals || [],
            dropOff: (l.dropOff as LeadDropOff) || 'quiz',
            interest: primary,
            solution: primary,
            kit: l.kit === 'HRK' || l.kit === 'LRK' ? l.kit : undefined,
            promoCode: isPaid ? paidByEmail.get(paidKey) : undefined,
            status: isPaid ? 'converted' : (l.status as LeadStatus),
            source: l.source || 'Quiz',
            createdAt: l.createdAt,
            updatedAt: l.updatedAt,
          });
        }
      }
    } catch { /* main site offline — skip */ }

    // 2. Merge Stripe incomplete subscriptions (payment abandonments)
    for (const status of ['incomplete', 'incomplete_expired'] as const) {
      for await (const sub of stripe().subscriptions.list({
        status,
        limit: 100,
        expand: ['data.customer'],
      })) {
        if (!isMembershipSub(sub, catalog)) continue;
        const customer = sub.customer as Stripe.Customer;
        if (typeof customer === 'string' || customer.deleted) continue;
        if (seenEmails.has(customer.email ?? '')) continue;
        // They abandoned once but paid on another attempt — customer, not lead
        if (customer.email && paidByEmail.has(customer.email.toLowerCase())) continue;
        seenEmails.add(customer.email ?? '');

        const createdAt = new Date(customer.created * 1000).toISOString();
        leads.push({
          id: customer.id,
          email: customer.email ?? '',
          name: customer.name ?? undefined,
          phone: customer.phone ?? undefined,
          goals: [],
          dropOff: 'payment',
          interest: 'cavities',
          solution: 'cavities',
          kit: kitTypeFromMetadata(sub.metadata) ?? kitTypeFromMetadata(customer.metadata),
          promoCode: sub.metadata?.promoCode || undefined,
          status: status === 'incomplete' ? 'new' : 'lost',
          source: 'Stripe',
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    return leads.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    // For main-site leads (cuid), persist via main site API
    if (!id.startsWith('cus_')) {
      const mainSiteUrl = process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002';
      const serviceKey = process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';
      try {
        const res = await fetch(`${mainSiteUrl}/api/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-api-key': serviceKey },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = await res.json() as { lead: Lead };
          return data.lead;
        }
      } catch { /* ignore */ }
    }
    // Stripe-sourced leads: no-op (UI stays optimistic)
    return null;
  },
};
