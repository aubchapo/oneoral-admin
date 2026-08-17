'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Badge } from '@/app/components/ui';
import { GraduationCap, School, AlertTriangle, Search } from 'lucide-react';

/**
 * The .edu student rate — who's on it and, more usefully, which schools.
 *
 * The schools table leads because it's the question worth asking: a member
 * list tells you who is paying $30, grouping by campus tells you whether a
 * campaign worked and where the next one should go.
 *
 * Schools come from the address that qualified them (`studentEmail`), not the
 * address on their account — those diverge the moment someone switches to a
 * personal inbox, which is exactly what happens after graduation.
 */

type Member = {
  id: string;
  name: string | null;
  email: string;
  studentEmail: string | null;
  school: string | null;
  via: 'direct' | 'household';
  plan: string | null;
  status: string | null;
  hasShipped: boolean;
  verifiedAt: string | null;
  staleVerification: boolean;
  joinedAt: string;
};

type SchoolRow = { school: string; students: number; direct: number; household: number; latest: string };

type Payload = {
  totals: { students: number; schools: number; direct: number; household: number; needsReverification: number };
  schools: SchoolRow[];
  members: Member[];
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function StudentsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/students')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
        return body as Payload;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const members = (data?.members ?? []).filter((m) =>
    !search
      ? true
      : [m.name, m.email, m.studentEmail, m.school].some((v) => (v || '').toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500">Everyone on the $30 .edu rate, and the schools they came from.</p>
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
              { label: 'Students', value: data.totals.students },
              { label: 'Schools', value: data.totals.schools },
              { label: 'Signed up direct', value: data.totals.direct },
              { label: 'Added to a household', value: data.totals.household },
              { label: 'Need re-verification', value: data.totals.needsReverification, warn: true },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      s.warn && s.value > 0 ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {s.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-6">
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <School className="w-4 h-4 text-slate-400" />
                <h2 className="font-bold text-slate-900">Schools</h2>
              </div>
              {data.schools.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No students yet. Campuses appear here as soon as someone signs up with a school address.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-4">School</th>
                        <th className="py-2 pr-4">Students</th>
                        <th className="py-2 pr-4">Direct</th>
                        <th className="py-2 pr-4">Via household</th>
                        <th className="py-2">Most recent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.schools.map((s) => (
                        <tr key={s.school} className="border-b border-slate-100 last:border-0">
                          <td className="py-2.5 pr-4 font-semibold text-slate-900">{s.school}</td>
                          <td className="py-2.5 pr-4">{s.students}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{s.direct}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{s.household}</td>
                          <td className="py-2.5 text-slate-600">{fmtDate(s.latest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-bold text-slate-900">Members</h2>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, email or school"
                    className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-primary-400 w-64"
                  />
                </div>
              </div>

              {members.length === 0 ? (
                <p className="text-sm text-slate-500">Nobody on the student rate yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-4">Member</th>
                        <th className="py-2 pr-4">School</th>
                        <th className="py-2 pr-4">Joined via</th>
                        <th className="py-2 pr-4">Kit</th>
                        <th className="py-2 pr-4">Verified</th>
                        <th className="py-2">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-2.5 pr-4">
                            <p className="font-semibold text-slate-900">{m.name || '—'}</p>
                            <p className="text-xs text-slate-500">{m.email}</p>
                            {m.studentEmail && m.studentEmail !== m.email && (
                              <p className="text-xs text-slate-400">verified as {m.studentEmail}</p>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-700">{m.school ?? '—'}</td>
                          <td className="py-2.5 pr-4">
                            <Badge className={m.via === 'direct' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                              {m.via === 'direct' ? 'Direct' : 'Household'}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">{m.hasShipped ? 'Shipped' : 'Not yet'}</td>
                          <td className="py-2.5 pr-4">
                            {m.staleVerification ? (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {m.verifiedAt ? `${fmtDate(m.verifiedAt)} — stale` : 'never'}
                              </span>
                            ) : (
                              <span className="text-slate-600">{fmtDate(m.verifiedAt)}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-600">{fmtDate(m.joinedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-400 leading-relaxed">
                A .edu address proves affiliation with an accredited school, not current enrolment — faculty, staff and
                alumni hold them too, often for life. Addresses on an <code>alumni.</code> subdomain are rejected at
                signup. Anything older than a year is flagged here as stale so it can be re-checked.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
