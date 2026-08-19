import { NextRequest, NextResponse } from 'next/server';
import { dataSource } from '@/lib/data';
import type { Subscriber } from '@/lib/data/types';

/**
 * The Rodeo cohort — every member whose kit ships to Texas, Colorado or
 * Arizona.
 *
 * These are the three states the Rodeo Roundup partnership covers (REG-BD-001),
 * so this is the denominator any Rodeo campaign gets measured against: who was
 * already there before it ran, and who arrived after.
 *
 * Segmented on the DELIVERY address, never the billing one. A member who moves
 * from California to Texas keeps the California card, and a billing-address
 * segment would file them in the wrong state permanently — which for a
 * geographically-scoped partnership is the one error that makes the number
 * useless.
 *
 * Caveat worth knowing when reading `inferred`: most customers carry a single
 * address today. Checkout collects one, writes it to `customer.address`, and
 * fulfilment ships to it; `customer.shipping` only appears once a member edits
 * their address in the portal, which writes both. So an `inferred` row is not a
 * wrong state — it is a row where no second address existed to disagree.
 *
 * Two populations, because they hold their address in different places:
 *   • primaries    — Stripe customer `shipping.address` (the data source)
 *   • family seats — the marketing app's own User row, via /api/internal/households
 */

export const dynamic = 'force-dynamic';

const RODEO_STATES = ['TX', 'CO', 'AZ'] as const;
type RodeoState = (typeof RODEO_STATES)[number];

const STATE_NAMES: Record<RodeoState, string> = { TX: 'Texas', CO: 'Colorado', AZ: 'Arizona' };

const base = () => (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:6001').replace(/\/$/, '');
const key = () => process.env.ONEORAL_SERVICE_API_KEY || process.env.SERVICE_API_KEY || '';

type HouseholdsPayload = {
  households: {
    primary: { name: string | null; email: string };
    members: {
      id: string;
      name: string | null;
      email: string;
      seatTier: string;
      status: string;
      shipsTo: string | null;
      hasShipped: boolean;
      joinedAt: string;
    }[];
  }[];
};

type RodeoMember = {
  id: string;
  name: string;
  email: string;
  state: RodeoState;
  city: string | null;
  /** How they pay: their own subscription, or a seat on someone's household. */
  via: 'direct' | 'household';
  /** Household seats only — who pays for them. */
  householdOf: string | null;
  status: string;
  monthlyAmount: number | null;
  startDate: string | null;
  /**
   * No separate `shipping` address existed, so the state came from the single
   * address on the customer — which is also the one their kit ships to.
   */
  inferred: boolean;
};

const isRodeoState = (s: string | undefined): s is RodeoState =>
  !!s && (RODEO_STATES as readonly string[]).includes(s);

/** "Austin, TX" → { city: "Austin", state: "TX" }. */
function parseShipsTo(shipsTo: string | null): { city: string | null; state: string | undefined } {
  if (!shipsTo) return { city: null, state: undefined };
  const parts = shipsTo.split(',').map((p) => p.trim());
  const state = parts.pop()?.toUpperCase();
  return { city: parts.join(', ') || null, state };
}

/**
 * Household seats. Best-effort: the marketing app being unreachable costs us
 * the family members, not the whole tab — the primaries are the bulk of it and
 * come from Stripe.
 */
async function householdMembers(): Promise<{ rows: RodeoMember[]; error: string | null }> {
  try {
    const res = await fetch(`${base()}/api/internal/households`, {
      headers: { 'x-api-key': key() },
      cache: 'no-store',
    });
    if (!res.ok) return { rows: [], error: `Household seats unavailable — main site responded ${res.status}.` };
    const data = (await res.json()) as HouseholdsPayload;

    const rows: RodeoMember[] = [];
    for (const h of data.households ?? []) {
      for (const m of h.members ?? []) {
        const { city, state } = parseShipsTo(m.shipsTo);
        if (!isRodeoState(state)) continue;
        rows.push({
          id: m.id,
          name: m.name || m.email,
          email: m.email,
          state,
          city,
          via: 'household',
          householdOf: h.primary.name || h.primary.email,
          status: m.status,
          // A seat bills on the primary's invoice, not their own.
          monthlyAmount: null,
          startDate: m.joinedAt.slice(0, 10),
          inferred: false,
        });
      }
    }
    return { rows, error: null };
  } catch {
    return { rows: [], error: `Household seats unavailable — main site unreachable at ${base()}.` };
  }
}

export async function GET(_req: NextRequest) {
  // One page big enough to hold everyone: this is a whole-cohort count, and a
  // paged read would silently report a fraction of it as the total.
  const { subscribers, total } = await dataSource.getSubscribers(1, 10_000);

  const direct: RodeoMember[] = (subscribers as Subscriber[])
    .filter((s) => isRodeoState(s.shipState))
    .map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      state: s.shipState as RodeoState,
      city: s.shipCity ?? null,
      via: 'direct' as const,
      householdOf: null,
      status: s.status,
      monthlyAmount: s.monthlyAmount,
      startDate: s.startDate,
      inferred: !!s.shipStateFromBilling,
    }));

  const household = await householdMembers();
  const members = [...direct, ...household.rows].sort(
    (a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.name.localeCompare(b.name),
  );

  const states = RODEO_STATES.map((code) => {
    const rows = members.filter((m) => m.state === code);
    return {
      code,
      name: STATE_NAMES[code],
      members: rows.length,
      active: rows.filter((m) => m.status === 'active').length,
      direct: rows.filter((m) => m.via === 'direct').length,
      household: rows.filter((m) => m.via === 'household').length,
      // Only paying subscriptions carry an amount; seats bill on the primary.
      mrr: Math.round(rows.reduce((n, m) => n + (m.status === 'active' ? m.monthlyAmount ?? 0 : 0), 0) * 100) / 100,
    };
  });

  return NextResponse.json({
    states,
    totals: {
      members: members.length,
      active: members.filter((m) => m.status === 'active').length,
      direct: direct.length,
      household: household.rows.length,
      mrr: Math.round(states.reduce((n, s) => n + s.mrr, 0) * 100) / 100,
      inferred: members.filter((m) => m.inferred).length,
      // The base the segment was cut from, so a small cohort reads as a share
      // rather than a bare number.
      allMembers: total,
    },
    members,
    warning: household.error,
  });
}
