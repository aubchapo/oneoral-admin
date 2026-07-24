// =============================================================================
// Live data source: real Stripe subscribers/revenue + real funnel leads.
//
// Activate with:
//   ONEORAL_DATA_SOURCE=live
//   DATABASE_URL=...            (the dry-test funnel's Neon — where leads live)
//   STRIPE_SECRET_KEY=...       (+ the STRIPE_* price ids, for subscribers)
//
//   - Subscribers, revenue, add-on stats → delegated to the Stripe source.
//   - Leads (the CRM pipeline) → read from the funnel's Neon collector.
// =============================================================================
import 'server-only';
import { stripeSource } from './stripe';
import { mockSource } from './mock';
import { getFunnelLeads, updateFunnelLeadStatus } from './leads-neon';
import type { DataSource } from './source';
import type { Lead, LeadStatus, RawStats, Subscriber, SubscribersPage } from './types';

// Subscribers/revenue come from Stripe when a key is configured; until then we
// fall back to mock so the stats pages still render. Leads always come from the
// funnel's Neon — the whole point of `live` mode.
const members: DataSource = process.env.STRIPE_SECRET_KEY ? stripeSource : mockSource;

export const liveSource: DataSource = {
  getRawStats(): Promise<RawStats> {
    return members.getRawStats();
  },

  getSubscribers(page: number, pageSize: number): Promise<SubscribersPage> {
    return members.getSubscribers(page, pageSize);
  },

  getSubscriberById(id: string): Promise<Subscriber | null> {
    return members.getSubscriberById(id);
  },

  getLeads(): Promise<Lead[]> {
    return getFunnelLeads();
  },

  updateLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
    return updateFunnelLeadStatus(id, status);
  },
};
