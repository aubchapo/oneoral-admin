'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import { ClipboardCheck, Mail, RefreshCw } from 'lucide-react';

// The 90-day retest pipeline: who's coming up on their window, whether the
// prompt email went out (and when), whether they acted, and what the provider
// decided — so nobody ever hunts through a sent-mail tab to answer "did we
// email them?".

type Bucket = 'upcoming' | 'window_open' | 'overdue' | 'urgent' | 'awaiting_signoff' | 'done';

type Member = {
  email: string;
  name: string | null;
  track: 'treatment' | 'maintenance';
  dayOfCycle: number | null;
  windowOpensAt: string | null;
  cutoffAt: string | null;
  promptEmailSentAt: string | null;
  baselineRisk: number | null;
  held: boolean;
  reassessment: {
    createdAt: string;
    decision: string;
    riskPercentage: number;
    adherence: number;
    signoffStatus: string | null;
    signoffBy: string | null;
    signoffAt: string | null;
  } | null;
  bucket: Bucket;
  recentEmails: { subject: string; template: string | null; app: string; sentAt: string }[];
};

const BUCKET_META: Record<Bucket, { label: string; chip: string }> = {
  urgent: { label: 'Urgent consult', chip: 'bg-red-100 text-red-700 border-red-200' },
  awaiting_signoff: { label: 'Awaiting sign-off', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  overdue: { label: 'Overdue (past day 83)', chip: 'bg-orange-100 text-orange-700 border-orange-200' },
  window_open: { label: 'Window open (76–83)', chip: 'bg-sky-100 text-sky-700 border-sky-200' },
  upcoming: { label: 'Coming up', chip: 'bg-slate-100 text-slate-600 border-slate-200' },
  done: { label: 'Done', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

function decisionLabel(m: Member): { text: string; cls: string } {
  const ra = m.reassessment;
  if (!ra) {
    if (m.bucket === 'upcoming') return { text: `opens ${fmt(m.windowOpensAt)}`, cls: 'text-slate-400' };
    return { text: 'not taken', cls: 'text-orange-600 font-medium' };
  }
  if (ra.decision === 'urgent_consult' && ra.signoffStatus === 'pending')
    return { text: 'urgent — consult', cls: 'text-red-600 font-semibold' };
  if (ra.signoffStatus === 'pending') return { text: 'needs sign-off', cls: 'text-amber-600 font-medium' };
  if (ra.decision === 'auto_approve')
    return {
      text: m.track === 'maintenance' ? 'auto: stays Maintenance' : 'auto: graduated',
      cls: 'text-emerald-600 font-medium',
    };
  const map: Record<string, string> = {
    approved_maintenance: 'dentist: → Maintenance',
    keep_treatment: 'dentist: stay Treatment',
    approved_treatment: 'dentist: → Treatment',
    stay_maintenance: 'dentist: stays Maintenance',
  };
  return { text: map[ra.signoffStatus ?? ''] ?? ra.signoffStatus ?? '—', cls: 'text-emerald-700 font-medium' };
}

export default function RetestsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [counts, setCounts] = useState<Record<Bucket, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Bucket | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/retests', { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setMembers(Array.isArray(data.members) ? data.members : []);
      setCounts(data.counts ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const visible = filter === 'all' ? members : members.filter((m) => m.bucket === filter);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary-600" /> 90-Day Retests
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Who&apos;s due, who was emailed, who acted, and what the dentist decided.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Bucket chips */}
      {counts && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold',
              filter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200',
            )}
          >
            All ({members.length})
          </button>
          {(Object.keys(BUCKET_META) as Bucket[]).map((b) => (
            <button
              key={b}
              onClick={() => setFilter(filter === b ? 'all' : b)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold',
                filter === b ? 'ring-2 ring-slate-900 ring-offset-1' : '',
                BUCKET_META[b].chip,
              )}
            >
              {BUCKET_META[b].label} ({counts[b] ?? 0})
            </button>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">Couldn&apos;t load the pipeline: {error}</CardContent>
        </Card>
      )}

      {!error && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Prompt email</th>
                  <th className="px-4 py-3">Retest</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Kit</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Loading pipeline…
                    </td>
                  </tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Nobody in this bucket.
                    </td>
                  </tr>
                )}
                {!loading &&
                  visible.map((m) => {
                    const d = decisionLabel(m);
                    const isOpen = expanded === m.email;
                    return (
                      <>
                        <tr
                          key={m.email}
                          onClick={() => setExpanded(isOpen ? null : m.email)}
                          className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{m.name || m.email}</div>
                            {m.name && <div className="text-xs text-slate-400">{m.email}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                m.track === 'treatment' ? 'bg-mint-100 text-primary-600' : 'bg-slate-100 text-slate-600',
                              )}
                            >
                              {m.track === 'treatment' ? 'Treatment' : 'Maintenance'}
                            </span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {m.dayOfCycle !== null ? `${m.dayOfCycle} / 90` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {m.promptEmailSentAt ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <Mail className="w-3.5 h-3.5" /> sent {fmt(m.promptEmailSentAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                {m.bucket === 'upcoming' ? `due ${fmt(m.windowOpensAt)}` : 'not sent'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {m.reassessment ? `${fmt(m.reassessment.createdAt)} · risk ${m.reassessment.riskPercentage}%` : '—'}
                          </td>
                          <td className={cn('px-4 py-3', d.cls)}>{d.text}</td>
                          <td className="px-4 py-3">
                            {m.held ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                HELD
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">on schedule</span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${m.email}-detail`} className="border-b border-slate-100 bg-slate-50/50">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                                    Timeline
                                  </div>
                                  <ul className="space-y-1 text-xs text-slate-600">
                                    <li>Window opens: {fmt(m.windowOpensAt)} · cutoff: {fmt(m.cutoffAt)}</li>
                                    <li>Prompt email: {m.promptEmailSentAt ? fmt(m.promptEmailSentAt) : 'not yet sent'}</li>
                                    {m.reassessment && (
                                      <>
                                        <li>
                                          Retest taken: {fmt(m.reassessment.createdAt)} — risk{' '}
                                          {m.reassessment.riskPercentage}%
                                          {m.baselineRisk !== null && ` (was ${m.baselineRisk}% at onboarding)`} ·
                                          adherence {m.reassessment.adherence}%
                                        </li>
                                        {m.reassessment.signoffAt && (
                                          <li>
                                            Sign-off: {fmt(m.reassessment.signoffAt)} by{' '}
                                            {m.reassessment.signoffBy || 'provider'}
                                          </li>
                                        )}
                                      </>
                                    )}
                                  </ul>
                                </div>
                                <div>
                                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1.5">
                                    Recent emails
                                  </div>
                                  {m.recentEmails.length === 0 ? (
                                    <p className="text-xs text-slate-400">
                                      None logged yet (logging began Aug 2026).
                                    </p>
                                  ) : (
                                    <ul className="space-y-1 text-xs text-slate-600">
                                      {m.recentEmails.map((e, i) => (
                                        <li key={i} className="truncate">
                                          <span className="text-slate-400">{fmt(e.sentAt)}</span> — {e.subject}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
