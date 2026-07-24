'use client';

// Dry-test funnel dashboard — the admin.oneoral.com home of the lead-funnel's
// /leads page. Reads the funnel's owned collector through /api/funnel/stats
// (server-side proxy holds the token). Webhook URL config stays in the funnel
// app itself (it's per-browser localStorage there).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import {
  FlaskConical,
  CreditCard,
  Users,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  CircleDashed,
  AlertTriangle,
} from 'lucide-react';

// ---- Shapes mirrored from lead-funnel/app/src/lib (leads.ts / events.ts) ----

interface CardIntent {
  kit: string;
  brand: string;
  last4: string;
  at: string;
}

interface FunnelLead {
  id: string;
  firstName: string;
  email: string;
  phone?: string;
  smsConsent: boolean;
  score?: number;
  tier?: string;
  topConcern?: string;
  answers?: Record<string, string>;
  tags: string[];
  source: string;
  kit?: string;
  variants?: Record<string, string>;
  cardIntent?: CardIntent;
  waitlistPosition?: number;
  createdAt: string;
  webhookStatus?: 'pending' | 'success' | 'failed';
  webhookError?: string;
}

type FunnelEventType = 'visit' | 'quiz_start' | 'lead_submit' | 'checkout_start' | 'card_submit' | 'waitlist_join';

interface FunnelEvent {
  id: string;
  type: FunnelEventType;
  at: string;
  sessionId: string;
  kit?: string;
  source?: string;
  leadId?: string;
  variants?: Record<string, string>;
}

// ---- Funnel config mirrored from lead-funnel/app/src/lib (kits.ts / experiments.ts) ----

const KIT_ORDER = ['treatment', 'whitening', 'fresh-breath', 'hydration'] as const;
const KIT_NAMES: Record<string, string> = {
  treatment: 'Treatment Kit',
  whitening: 'Whitening Kit',
  'fresh-breath': 'Fresh Breath Kit',
  hydration: 'Hydration Kit',
};

const EXPERIMENTS: Record<string, string[]> = {
  'hero-headline': ['a', 'b', 'c'],
  'offer-framing': ['a', 'b'],
};
const EXPERIMENT_LABEL: Record<string, string> = {
  'hero-headline': 'Hero headline',
  'offer-framing': 'Offer framing',
};

const FUNNEL_COLUMNS: { type: FunnelEventType; label: string }[] = [
  { type: 'visit', label: 'Visits' },
  { type: 'quiz_start', label: 'Quiz starts' },
  { type: 'lead_submit', label: 'Leads' },
  { type: 'checkout_start', label: 'Checkouts' },
  { type: 'card_submit', label: 'Card submits' },
];

const CONCERN_LABEL: Record<string, string> = {
  whitening: 'Whiter teeth',
  breath: 'Fresher breath',
  cavity_gum: 'Gums & cavities',
  dry_mouth: 'Dry mouth',
  sensitivity: 'Sensitivity',
};

const TIER_BADGE: Record<string, string> = {
  Great: 'bg-mint-50 text-primary-600 border-mint-200',
  Fair: 'bg-amber-50 text-amber-700 border-amber-200',
  'Needs Attention': 'bg-rose-50 text-rose-700 border-rose-200',
};

/** Unique sessions that fired `type` (checkout events can repeat across kits). */
function sessionCount(events: FunnelEvent[], type: FunnelEventType): number {
  return new Set(events.filter((e) => e.type === type).map((e) => e.sessionId)).size;
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

// ---- CSV export (mirrors lead-funnel leadsToCsv) ----

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(leads: FunnelLead[]) {
  const headers = [
    'name', 'email', 'phone', 'sms_consent', 'score', 'tier', 'top_concern', 'source', 'kit',
    'hero_variant', 'offer_variant', 'card_submitted', 'card_brand', 'card_last4',
    'card_submitted_at', 'waitlist_position', 'answers_json', 'tags', 'created_at',
  ];
  const rows = leads.map((l) =>
    [
      l.firstName,
      l.email,
      l.smsConsent && l.phone ? l.phone : '',
      String(l.smsConsent),
      l.score != null ? String(l.score) : '',
      l.tier ?? '',
      l.topConcern ?? '',
      l.source,
      l.kit ?? '',
      l.variants?.['hero-headline'] ?? '',
      l.variants?.['offer-framing'] ?? '',
      String(!!l.cardIntent),
      l.cardIntent?.brand ?? '',
      l.cardIntent?.last4 ?? '',
      l.cardIntent?.at ?? '',
      l.waitlistPosition != null ? String(l.waitlistPosition) : '',
      l.answers ? JSON.stringify(l.answers) : '',
      (l.tags ?? []).join(';'),
      l.createdAt,
    ].map(csvEscape).join(',')
  );
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oneoral-drytest-leads.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function DryTestPage() {
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/funnel/stats', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `stats ${res.status}`);
      setLeads(data.leads ?? []);
      setEvents(data.events ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'collector unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kitDemand = useMemo(() => {
    const rows = KIT_ORDER.map((id) => {
      const checkoutStarts = events.filter((e) => e.type === 'checkout_start' && e.kit === id).length;
      const cardSubmits = events.filter((e) => e.type === 'card_submit' && e.kit === id).length;
      const rate = checkoutStarts > 0 ? cardSubmits / checkoutStarts : 0;
      return { id, name: KIT_NAMES[id], checkoutStarts, cardSubmits, rate };
    });
    return rows.sort((a, b) => b.rate - a.rate || b.cardSubmits - a.cardSubmits);
  }, [events]);

  const maxKitRate = Math.max(...kitDemand.map((r) => r.rate), 0.0001);

  const variantFunnels = useMemo(
    () =>
      Object.keys(EXPERIMENTS).map((expKey) => ({
        expKey,
        rows: EXPERIMENTS[expKey].map((variant) => {
          const scoped = events.filter((e) => e.variants?.[expKey] === variant);
          const counts = Object.fromEntries(
            FUNNEL_COLUMNS.map(({ type }) => [type, sessionCount(scoped, type)])
          ) as Record<FunnelEventType, number>;
          return { variant, counts };
        }),
      })),
    [events]
  );

  const totalCardSubmitters = useMemo(() => sessionCount(events, 'card_submit'), [events]);

  if (loading && leads.length === 0 && events.length === 0 && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Dry Test — Leads & Demand</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary-600">
                <CreditCard className="w-4 h-4" />
                {totalCardSubmitters} card {totalCardSubmitters === 1 ? 'submitter' : 'submitters'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={() => downloadCsv(leads)}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Collector unreachable: {error}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Set <code className="bg-amber-100 px-1 py-0.5 rounded">FUNNEL_URL</code> (the funnel deployment) and{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded">FUNNEL_ADMIN_TOKEN</code> (its ADMIN_TOKEN) on this
              admin project, then refresh.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Demand by kit — the dry-test headline panel */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <CreditCard className="w-5 h-5 text-primary-600" />
            Demand by kit — which kit do people actually pay for?
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            card_submit ÷ checkout_start per kit. ≥8% with adequate traffic = greenlight inventory for that kit.
            Decisions are per-kit and independent.
          </p>
          <ul className="mt-4 space-y-3">
            {kitDemand.map(({ id, name, checkoutStarts, cardSubmits, rate }) => {
              const greenlight = rate >= 0.08 && cardSubmits > 0;
              return (
                <li key={id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-900">
                      {name}
                      {greenlight && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-mint-200 bg-mint-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-600">
                          Greenlight
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {cardSubmits}/{checkoutStarts} ·{' '}
                      <strong className={cn('font-semibold', greenlight ? 'text-primary-600' : 'text-slate-900')}>
                        {pct(cardSubmits, checkoutStarts)}
                      </strong>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full transition-all', greenlight ? 'bg-primary-600' : 'bg-primary-600/35')}
                      style={{ width: `${Math.max((rate / maxKitRate) * 100, rate > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            Direct kit links for ad campaigns:{' '}
            {KIT_ORDER.map((id, i) => (
              <span key={id}>
                {i > 0 && ' · '}
                <code className="rounded bg-slate-100 px-1 py-0.5">/checkout?kit={id}</code>
              </span>
            ))}
          </p>
        </CardContent>
      </Card>

      {/* Funnel by variant */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <FlaskConical className="w-5 h-5 text-primary-600" />
            Funnel by variant
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Unique sessions per step. Headline metric: card-submit rate (card submits ÷ leads). Override variants for
            QA with <code className="rounded bg-slate-100 px-1 py-0.5">?v=hero-headline:b,offer-framing:a</code>
          </p>
          {variantFunnels.map(({ expKey, rows }) => (
            <div key={expKey} className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {EXPERIMENT_LABEL[expKey] ?? expKey}
              </h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Variant</th>
                      {FUNNEL_COLUMNS.map((c) => (
                        <th key={c.type} className="px-3 py-2 font-semibold">{c.label}</th>
                      ))}
                      <th className="px-3 py-2 font-semibold text-primary-600">Card rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ variant, counts }) => (
                      <tr key={variant} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-3 text-base font-bold uppercase text-slate-800">{variant}</td>
                        {FUNNEL_COLUMNS.map((c) => (
                          <td key={c.type} className="px-3 py-2.5 tabular-nums text-slate-700">{counts[c.type]}</td>
                        ))}
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-primary-600">
                          {pct(counts.card_submit, counts.lead_submit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Leads table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Dry-test leads</h2>
            <span className="text-sm text-slate-500">{leads.length} leads</span>
          </div>
          {leads.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-400">
              No leads yet — share the quiz link and they'll appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-left text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-xs uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Tier</th>
                    <th className="px-4 py-3 font-semibold">Concern</th>
                    <th className="px-4 py-3 font-semibold">Kit</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Card</th>
                    <th className="px-4 py-3 font-semibold">Webhook</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{l.firstName || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{l.email}</td>
                      <td className="px-4 py-3 text-base font-semibold tabular-nums text-primary-600">
                        {l.score != null ? l.score : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {l.tier ? (
                          <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', TIER_BADGE[l.tier] ?? 'bg-slate-100 text-slate-600 border-slate-200')}>
                            {l.tier}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {l.topConcern ? (CONCERN_LABEL[l.topConcern] ?? l.topConcern) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.kit ? (KIT_NAMES[l.kit] ?? l.kit) : '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                            l.source === 'direct-kit-link'
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                          )}
                        >
                          {l.source === 'direct-kit-link' ? 'Ad direct' : 'Quiz'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {l.cardIntent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                            <CreditCard className="w-3.5 h-3.5" />
                            •••• {l.cardIntent.last4}
                            {l.waitlistPosition != null && (
                              <span className="font-medium text-slate-500">#{l.waitlistPosition}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {l.webhookStatus === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-label="Delivered" />
                        ) : l.webhookStatus === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                            <XCircle className="w-4 h-4" />
                            {l.webhookError ?? 'Failed'}
                          </span>
                        ) : l.webhookStatus === 'pending' ? (
                          <CircleDashed className="w-4 h-4 text-slate-400" aria-label="Pending" />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-slate-500">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Webhook (Zapier / Make / Klaviyo) delivery is configured in the funnel app's own /leads page — status per lead
        shows above. The Clear button lives there too; the collector database is the source of truth here.
      </p>
    </div>
  );
}
