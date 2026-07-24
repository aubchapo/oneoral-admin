// =============================================================================
// DataSource interface — implemented by mock and live adapters.
// All API route handlers go through this interface. To plug in real data,
// implement liveSource in ./live.ts and set ONEORAL_DATA_SOURCE=live.
// =============================================================================

import {
  MEMBERSHIP_PRICE,
  CARIFREE_KIT_COST,
  KITS_PER_YEAR,
  type Lead,
  type LeadStatus,
  type RawStats,
  type Stats,
  type Subscriber,
  type SubscribersPage,
} from './types';

export interface DataSource {
  /** Aggregate counts. Derived margin/MRR are added by enrichStats(). */
  getRawStats(): Promise<RawStats>;

  getSubscribers(page: number, pageSize: number): Promise<SubscribersPage>;
  getSubscriberById(id: string): Promise<Subscriber | null>;

  getLeads(): Promise<Lead[]>;
  updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null>;
}

/**
 * Enriches raw counts with derived fields (MRR, COGS, margin).
 * Live and mock sources both go through this so the UI sees one shape.
 */
export function enrichStats(raw: RawStats): Stats {
  // Prefer the data source's real MRR (actual plan amounts); estimate otherwise.
  const mrr = raw.mrr ?? Math.round(raw.active * MEMBERSHIP_PRICE * 100) / 100;

  // CariFree kits ship to every currently-subscribed member (active OR paused),
  // not just active. One kit per quarter per member.
  const kitsPerQuarter = raw.subscribed;
  const kitsPerYear = raw.subscribed * KITS_PER_YEAR;
  const kitCostPerQuarter = Math.round(kitsPerQuarter * CARIFREE_KIT_COST * 100) / 100;
  const kitCostPerYear = Math.round(kitsPerYear * CARIFREE_KIT_COST * 100) / 100;

  // Real margin from trailing-12mo paid Stripe revenue minus the kits
  // that would have shipped over those 12 months for the current subscriber base.
  const membershipRevenue12mo = raw.monthlyRevenue.reduce((s, m) => s + m.membership, 0);
  const grossMargin12mo = Math.round((membershipRevenue12mo - kitCostPerYear) * 100) / 100;
  const grossMarginPercent = membershipRevenue12mo > 0 ? grossMargin12mo / membershipRevenue12mo : 0;

  // Trends from monthly history (current vs prior month)
  const months = raw.monthlyRevenue;
  const current = months[months.length - 1];
  const prior = months[months.length - 2];
  const trend = (a: number, b: number) => (b > 0 ? (a - b) / b : 0);
  const currentTotal = current ? current.membership + current.addons : 0;
  const priorTotal = prior ? prior.membership + prior.addons : 0;
  const revenueTrend = trend(currentTotal, priorTotal);
  const addonTrend = trend(current?.addons ?? 0, prior?.addons ?? 0);
  const trailingRevenue12mo = months.reduce((s, m) => s + m.membership + m.addons, 0);

  return {
    ...raw,
    mrr,
    kitsPerQuarter,
    kitsPerYear,
    kitCostPerQuarter,
    kitCostPerYear,
    membershipRevenue12mo: Math.round(membershipRevenue12mo * 100) / 100,
    grossMargin12mo,
    grossMarginPercent,
    revenueTrend,
    addonTrend,
    trailingRevenue12mo: Math.round(trailingRevenue12mo * 100) / 100,
  };
}
