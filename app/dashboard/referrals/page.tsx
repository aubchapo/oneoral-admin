'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Badge } from '@/app/components/ui';
import { Gift, Search } from 'lucide-react';

/**
 * Give-$20-get-$20: every referral, who sent it, who joined, and whether the
 * credit landed. Rows are written by the marketing app's invoice.paid webhook
 * and credited by its track-shipments cron when the friend's first kit ships.
 */

type Referral = {
  id: string;
  code: string;
  status: 'joined' | 'credited' | 'void';
  creditCents: number;
  createdAt: string;
  creditedAt: string | null;
  referrerName: string | null;
  referrerEmail: string;
  referredName: string | null;
  referredEmail: string | null;
};

type Payload = {
  totals: { referrals: number; credited: number; pending: number; creditCentsIssued: number };
  referrals: Referral[];
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function ReferralsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/referrals')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
        return body as Payload;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const rows = (data?.referrals ?? []).filter((r) =>
    !search
      ? true
      : [r.referrerName, r.referrerEmail, r.referredName, r.referredEmail, r.code].some((v) =>
          (v || '').toLowerCase().includes(search.toLowerCase()),
        ),
  );

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Referrals</h1>
          <p className="text-sm text-slate-500">
            Give $20, get $20 — who referred whom, and whether the credit landed.
          </p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Referrals', value: data.totals.referrals },
              { label: 'Credits issued', value: data.totals.credited },
              { label: 'Credit pending', value: data.totals.pending, warn: true },
              { label: 'Credit paid out', value: `$${(data.totals.creditCentsIssued / 100).toFixed(0)}` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      'warn' in s && s.warn && typeof s.value === 'number' && s.value > 0
                        ? 'text-amber-600'
                        : 'text-slate-900'
                    }`}
                  >
                    {s.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent>
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search referrer, friend, or code…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>

              {rows.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No referrals yet. Rows appear when a friend checks out with a member&apos;s code.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-4">Referrer</th>
                        <th className="py-2 pr-4">Friend</th>
                        <th className="py-2 pr-4">Code</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Joined</th>
                        <th className="py-2">Credited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-2.5 pr-4">
                            <p className="font-medium text-slate-900">{r.referrerName || '—'}</p>
                            <p className="text-xs text-slate-500">{r.referrerEmail}</p>
                          </td>
                          <td className="py-2.5 pr-4">
                            <p className="font-medium text-slate-900">{r.referredName || '—'}</p>
                            <p className="text-xs text-slate-500">{r.referredEmail || '—'}</p>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{r.code}</td>
                          <td className="py-2.5 pr-4">
                            {r.status === 'credited' ? (
                              <Badge variant="success">+${(r.creditCents / 100).toFixed(0)} credited</Badge>
                            ) : r.status === 'void' ? (
                              <Badge variant="default">void</Badge>
                            ) : (
                              <Badge variant="warning">pending</Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">{fmtDate(r.createdAt)}</td>
                          <td className="py-2.5 text-slate-600">{fmtDate(r.creditedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
