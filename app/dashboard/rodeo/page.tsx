'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, Badge } from '@/app/components/ui';
import { Search, MapPin, AlertTriangle, Users } from 'lucide-react';

/**
 * The Rodeo cohort — members in Texas, Colorado and Arizona.
 *
 * The three states the Rodeo Roundup partnership covers, cut into their own
 * segment so the campaign has a denominator: who was already there, and who
 * arrives once it runs.
 *
 * Cut on the DELIVERY address. Someone who moves to Texas keeps their old card,
 * so a billing-address segment would leave them filed in California forever —
 * and the one thing a geographic cohort has to get right is geography.
 *
 * Most members have no separate delivery address today: checkout collects one
 * address, writes it to the Stripe customer, and that is the address the kit
 * ships to. A distinct `shipping` address only exists once someone edits it in
 * the portal. Those rows are marked "one address" rather than dropped — the
 * mark says we couldn't see a divergence, not that the state is wrong.
 */

type Member = {
  id: string;
  name: string;
  email: string;
  state: 'TX' | 'CO' | 'AZ';
  city: string | null;
  via: 'direct' | 'household';
  householdOf: string | null;
  status: string;
  monthlyAmount: number | null;
  startDate: string | null;
  inferred: boolean;
};

type StateRow = {
  code: 'TX' | 'CO' | 'AZ';
  name: string;
  members: number;
  active: number;
  direct: number;
  household: number;
  mrr: number;
};

type Payload = {
  states: StateRow[];
  totals: {
    members: number;
    active: number;
    direct: number;
    household: number;
    mrr: number;
    inferred: number;
    allMembers: number;
  };
  members: Member[];
  warning: string | null;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  onboarding: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function RodeoPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | 'TX' | 'CO' | 'AZ'>('all');

  useEffect(() => {
    fetch('/api/rodeo')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
        return body as Payload;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const members = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.members ?? [])
      .filter((m) => (stateFilter === 'all' ? true : m.state === stateFilter))
      .filter((m) =>
        !q ? true : [m.name, m.email, m.city, m.householdOf].some((v) => (v || '').toLowerCase().includes(q)),
      );
  }, [data, search, stateFilter]);

  const share =
    data && data.totals.allMembers > 0
      ? Math.round((data.totals.members / data.totals.allMembers) * 1000) / 10
      : 0;

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rodeo</h1>
          <p className="text-sm text-slate-500">
            Members in Texas, Colorado and Arizona — the three Rodeo Roundup states.
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Rodeo members', value: String(data.totals.members) },
              { label: 'Active', value: String(data.totals.active) },
              { label: 'Share of all members', value: `${share}%` },
              { label: 'Rodeo MRR', value: money(data.totals.mrr) },
              { label: 'Household seats', value: String(data.totals.household) },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.warning && (
            <Card className="mb-6">
              <CardContent>
                <p className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {data.warning} Primary members are still shown in full.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-400" />
                <h2 className="font-bold text-slate-900">By state</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-4">State</th>
                      <th className="py-2 pr-4">Members</th>
                      <th className="py-2 pr-4">Active</th>
                      <th className="py-2 pr-4">Own plan</th>
                      <th className="py-2 pr-4">Household seat</th>
                      <th className="py-2">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.states.map((s) => (
                      <tr key={s.code} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4">
                          <button
                            onClick={() => setStateFilter(stateFilter === s.code ? 'all' : s.code)}
                            className={`font-semibold ${
                              stateFilter === s.code ? 'text-primary-600' : 'text-slate-900 hover:text-primary-600'
                            }`}
                          >
                            {s.name} <span className="text-slate-400 font-normal">({s.code})</span>
                          </button>
                        </td>
                        <td className="py-2.5 pr-4 font-semibold text-slate-900">{s.members}</td>
                        <td className="py-2.5 pr-4 text-slate-600">{s.active}</td>
                        <td className="py-2.5 pr-4 text-slate-600">{s.direct}</td>
                        <td className="py-2.5 pr-4 text-slate-600">{s.household}</td>
                        <td className="py-2.5 text-slate-600">{money(s.mrr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400">Click a state to filter the list below.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-bold text-slate-900">
                  Members{stateFilter !== 'all' && <span className="text-slate-400"> · {stateFilter}</span>}
                </h2>
                <div className="flex items-center gap-2">
                  {stateFilter !== 'all' && (
                    <button
                      onClick={() => setStateFilter('all')}
                      className="text-xs font-semibold text-primary-600 hover:underline"
                    >
                      Show all three
                    </button>
                  )}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Name, email or city"
                      className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-primary-400 w-64"
                    />
                  </div>
                </div>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nobody ships to {stateFilter === 'all' ? 'Texas, Colorado or Arizona' : stateFilter} yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-4">Member</th>
                        <th className="py-2 pr-4">Ships to</th>
                        <th className="py-2 pr-4">Plan</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">$/mo</th>
                        <th className="py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={`${m.via}-${m.id}`} className="border-b border-slate-100 last:border-0">
                          <td className="py-2.5 pr-4">
                            <p className="font-semibold text-slate-900">{m.name}</p>
                            <p className="text-xs text-slate-500">{m.email}</p>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-700">
                            {m.city ? `${m.city}, ${m.state}` : m.state}
                            {m.inferred && (
                              <span
                                title="No separate delivery address on file. This is the single address on their Stripe customer — the same one their kit ships to."
                                className="ml-1.5 text-xs text-slate-400"
                              >
                                one address
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            {m.via === 'direct' ? (
                              <Badge className="bg-sky-50 text-sky-700 border-sky-200">Own plan</Badge>
                            ) : (
                              <div>
                                <Badge className="bg-slate-100 text-slate-600 border-slate-200">Household</Badge>
                                {m.householdOf && (
                                  <p className="mt-1 text-xs text-slate-400">on {m.householdOf}&apos;s plan</p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge className={STATUS_TONE[m.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}>
                              {m.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">
                            {m.monthlyAmount == null ? (
                              <span className="text-slate-400">on primary</span>
                            ) : (
                              money(m.monthlyAmount)
                            )}
                          </td>
                          <td className="py-2.5 text-slate-600">{fmtDate(m.startDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                Segmented on where the kit ships, not where the card bills — a member who moves to Texas keeps their old
                card, and a billing cut would leave them counted in the state they left.
                {data.totals.inferred > 0 && (
                  <>
                    {' '}
                    {data.totals.inferred} of {data.totals.members} hold a single address on their Stripe customer
                    rather than a separate ship-to, marked <span className="text-slate-500">one address</span> above.
                    That address is still the one their kit ships to — checkout collects one, and a distinct delivery
                    address only appears once a member edits it in the portal.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
