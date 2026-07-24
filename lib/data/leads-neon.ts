// =============================================================================
// Funnel leads, read from the dry-test collector's Neon Postgres.
// The lead-funnel app writes `funnel_leads` / `funnel_events`; this maps those
// rows into the CRM `Lead` shape. Lead STATUS (the CRM pipeline) is owned here —
// the funnel never sets it, so we add a `status` column and persist changes.
// =============================================================================
import 'server-only';
import { neon } from '@neondatabase/serverless';
import type { Lead, LeadInterest, LeadStatus } from './types';

let _sql: ReturnType<typeof neon> | undefined;
function db() {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.ONEORAL_DB_URL;
    if (!url) throw new Error('[oneoral-admin] DATABASE_URL not set — cannot read funnel leads');
    _sql = neon(url);
  }
  return _sql;
}

let ensured = false;
async function ensureStatusColumn() {
  if (ensured) return;
  await db()`ALTER TABLE funnel_leads ADD COLUMN IF NOT EXISTS status text`;
  ensured = true;
}

// Funnel concern / kit → CRM interest.
const INTEREST_BY_CONCERN: Record<string, LeadInterest> = {
  whitening: 'whitening',
  breath: 'breath',
  cavity_gum: 'cavities',
  dry_mouth: 'cavities',
  sensitivity: 'cavities',
};
const INTEREST_BY_KIT: Record<string, LeadInterest> = {
  whitening: 'whitening',
  'fresh-breath': 'breath',
  treatment: 'cavities',
  hydration: 'cavities',
};
const SOURCE_LABEL: Record<string, string> = {
  quiz: 'Quiz',
  'direct-kit-link': 'Direct kit link',
};

interface FunnelLeadData {
  id: string;
  firstName?: string;
  email?: string;
  phone?: string;
  score?: number;
  tier?: string;
  topConcern?: string;
  kit?: string;
  answers?: Record<string, string | string[]>;
  tags?: string[];
  source?: string;
  cardIntent?: { last4?: string };
  waitlistPosition?: number;
  createdAt?: string;
}

function mapLead(data: FunnelLeadData, status: string | null, events: string[]): Lead {
  const interest: LeadInterest =
    (data.topConcern && INTEREST_BY_CONCERN[data.topConcern]) ||
    (data.kit && INTEREST_BY_KIT[data.kit]) ||
    'cavities';

  const hasCard = !!data.cardIntent;
  // dropOff = the furthest point they reached (higher intent = later stage).
  const dropOff: Lead['dropOff'] =
    hasCard || events.includes('card_submit') || events.includes('waitlist_join')
      ? 'payment'
      : events.includes('checkout_start')
        ? 'checkout'
        : 'quiz';

  const problem = data.answers?.problem;
  const goals = Array.isArray(problem)
    ? problem
    : typeof problem === 'string'
      ? [problem]
      : (data.tags ?? []).filter((t) => t.startsWith('concern=')).map((t) => t.split('=')[1]);

  const notes =
    [
      data.score != null ? `Score ${data.score}` : null,
      data.tier ?? null,
      hasCard ? `Card •••• ${data.cardIntent?.last4 ?? ''} (dry-test, not charged)` : null,
      data.waitlistPosition != null ? `Waitlist #${data.waitlistPosition}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined;

  const createdAt = data.createdAt ?? new Date().toISOString();
  return {
    id: data.id,
    email: data.email ?? '',
    name: data.firstName || undefined,
    phone: data.phone || undefined,
    goals: goals.length ? goals : undefined,
    dropOff,
    interest,
    status: (status as LeadStatus) ?? 'new',
    source: data.source ? SOURCE_LABEL[data.source] ?? data.source : undefined,
    notes,
    createdAt,
    updatedAt: createdAt,
    solution: interest,
  };
}

export async function getFunnelLeads(): Promise<Lead[]> {
  await ensureStatusColumn();
  const rows = (await db()`
    SELECT l.data, l.status,
           COALESCE(ARRAY_AGG(DISTINCT e.type) FILTER (WHERE e.type IS NOT NULL), '{}') AS events
    FROM funnel_leads l
    LEFT JOIN funnel_events e ON e.lead_id = l.id
    GROUP BY l.id, l.data, l.status, l.created_at
    ORDER BY l.created_at DESC
  `) as { data: FunnelLeadData; status: string | null; events: string[] }[];
  return rows.map((r) => mapLead(r.data, r.status, r.events ?? []));
}

export async function updateFunnelLeadStatus(id: string, status: LeadStatus): Promise<Lead | null> {
  await ensureStatusColumn();
  const rows = (await db()`
    UPDATE funnel_leads SET status = ${status} WHERE id = ${id} RETURNING data, status
  `) as { data: FunnelLeadData; status: string | null }[];
  if (!rows.length) return null;
  const evRows = (await db()`
    SELECT COALESCE(ARRAY_AGG(DISTINCT type), '{}') AS events FROM funnel_events WHERE lead_id = ${id}
  `) as { events: string[] }[];
  return mapLead(rows[0].data, rows[0].status, evRows[0]?.events ?? []);
}
