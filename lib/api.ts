// =============================================================================
// Client-facing SDK. UI components import from here.
//
// Internally this is now a thin fetch wrapper around /api/* route handlers, so
// the data source is fully abstracted from the UI. To swap mock → real data,
// implement lib/data/live.ts and set ONEORAL_DATA_SOURCE=live in .env.local.
// =============================================================================

import type {
  Lead,
  LeadStatus,
  Stats,
  Subscriber,
  SubscribersPage,
} from './data/types';

// Re-export types & constants so existing imports keep working.
export type {
  Lead,
  LeadInterest,
  LeadStatus,
  Subscriber,
  SubscriberStatus,
  Addon,
  Stats,
  RawStats,
  AddonSale,
  SubscribersPage,
} from './data/types';
export {
  MEMBERSHIP_PRICE,
  MEMBERSHIP_NAME,
  CARIFREE_KIT_COST,
  KITS_PER_YEAR,
  KIT_COST_PER_MONTH,
  ADDON_CATALOG,
} from './data/types';

// Legacy alias for the older `User` import
import type { User } from './types';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${url}`);
  return (await res.json()) as T;
}

export const adminApi = {
  getSubscriberStats: (): Promise<Stats> => getJson<Stats>('/api/stats'),

  getSubscribers: (page = 1, pageSize = 50): Promise<SubscribersPage> =>
    getJson<SubscribersPage>(`/api/subscribers?page=${page}&pageSize=${pageSize}`),

  getSubscriberById: async (id: string): Promise<Subscriber | null> => {
    const res = await fetch(`/api/subscribers/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load subscriber ${id}`);
    const data = (await res.json()) as { subscriber: Subscriber };
    return data.subscriber;
  },

  getAddonSales: async () => {
    const stats = await getJson<Stats>('/api/stats');
    return stats.addonSales;
  },

  getLeads: async (): Promise<Lead[]> => {
    const data = await getJson<{ leads: Lead[] }>('/api/leads');
    return data.leads;
  },

  updateLeadStatus: async (id: string, status: LeadStatus): Promise<Lead | null> => {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to update lead');
    const data = (await res.json()) as { lead: Lead };
    return data.lead;
  },

  // Legacy/no-op
  getUsers: async (): Promise<User[]> => [],
};
