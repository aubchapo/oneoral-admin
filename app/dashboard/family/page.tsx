'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Badge } from '@/app/components/ui';
import { Users, AlertTriangle, MapPin, Search } from 'lucide-react';

/**
 * Household plans — who pays, who's on them, and what's owed.
 *
 * Pending invites are shown apart from joined members on purpose. Both are
 * billed from the moment the invite is sent, and they look identical on an
 * invoice, so a seat charged for someone who never made an account is
 * invisible unless the two are counted separately. Expired invites are worse
 * still: unusable, and billing until the sweep reclaims them.
 *
 * "Expected" is what our records say is owed. Stripe is the authority on what
 * is actually charged — the portal reconciles the two per household; this is
 * for spotting the pattern across all of them.
 */

type Member = {
  id: string;
  name: string | null;
  email: string;
  seatTier: string;
  status: string;
  shipsTo: string | null;
  hasShipped: boolean;
  joinedAt: string;
};

type Household = {
  id: string;
  primary: { name: string | null; email: string; hasStripe: boolean };
  members: Member[];
  pendingInvites: { name: string; email: string; seatTier: string; sentAt: string; expiresAt: string }[];
  expiredInvites: number;
  seatCount: number;
  studentSeats: number;
  expectedMonthlyCents: number;
};

type Payload = {
  totals: {
    households: number;
    seats: number;
    members: number;
    pendingInvites: number;
    expiredInvites: number;
    studentSeats: number;
    expectedMonthlyCents: number;
  };
  households: Household[];
};

const money = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function FamilyPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/households')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
        return body as Payload;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const households = (data?.households ?? []).filter((h) =>
    !search
      ? true
      : [h.primary.name, h.primary.email, ...h.members.map((m) => m.email), ...h.members.map((m) => m.name)].some((v) =>
          (v || '').toLowerCase().includes(search.toLowerCase()),
        ),
  );

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Family Plans</h1>
          <p className="text-sm text-slate-500">Households, their seats, and where each member&rsquo;s kit ships.</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Households', value: String(data.totals.households) },
              { label: 'Seats billed', value: String(data.totals.seats) },
              { label: 'Joined', value: String(data.totals.members) },
              { label: 'Invites pending', value: String(data.totals.pendingInvites) },
              { label: 'Invites expired', value: String(data.totals.expiredInvites), warn: data.totals.expiredInvites > 0 },
              { label: 'Expected / month', value: money(data.totals.expectedMonthlyCents) },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${s.warn ? 'text-amber-600' : 'text-slate-900'}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Primary or member"
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-primary-400 w-64"
              />
            </div>
          </div>

          {households.length === 0 ? (
            <Card>
              <CardContent>
                <p className="text-sm text-slate-500">No household plans yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {households.map((h) => (
                <Card key={h.id}>
                  <CardContent>
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-slate-900">{h.primary.name || h.primary.email}</p>
                        <p className="text-xs text-slate-500">{h.primary.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">{money(h.expectedMonthlyCents)}<span className="text-xs font-semibold text-slate-500"> / mo</span></p>
                        <p className="text-xs text-slate-500">
                          {h.seatCount} seat{h.seatCount === 1 ? '' : 's'}
                          {h.studentSeats > 0 ? ` · ${h.studentSeats} student` : ''}
                        </p>
                      </div>
                    </div>

                    {h.expiredInvites > 0 && (
                      <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {h.expiredInvites} expired invite{h.expiredInvites === 1 ? '' : 's'} — billing until the daily
                        sweep releases the seat{h.expiredInvites === 1 ? '' : 's'}.
                      </p>
                    )}

                    <div className="space-y-1.5">
                      {h.members.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900">{m.name || m.email}</span>
                          <Badge className={m.seatTier === 'student' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                            {m.seatTier === 'student' ? 'Student' : 'Family'}
                          </Badge>
                          <Badge className={m.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200'}>
                            {m.status === 'active' ? 'Active' : 'Onboarding'}
                          </Badge>
                          {m.shipsTo && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="w-3 h-3" /> {m.shipsTo}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{m.hasShipped ? 'kit shipped' : 'no kit yet'}</span>
                        </div>
                      ))}

                      {h.pendingInvites.map((i) => (
                        <div key={i.email} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-slate-500">{i.name || i.email}</span>
                          <Badge className={i.seatTier === 'student' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                            {i.seatTier === 'student' ? 'Student' : 'Family'}
                          </Badge>
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200">Invite pending</Badge>
                          <span className="text-xs text-slate-400">
                            sent {fmtDate(i.sentAt)} · expires {fmtDate(i.expiresAt)} · billing already
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            A seat is charged when the invite is sent, not when it&rsquo;s accepted — so pending invites are already on
            the primary&rsquo;s card. Expected is what our records say is owed; Stripe is the authority on what was
            actually charged.
          </p>
        </>
      )}
    </div>
  );
}
