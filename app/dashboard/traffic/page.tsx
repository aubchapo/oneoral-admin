'use client';

// Traffic analytics — owned first-party pageview data from the marketing
// site's /api/traffic collector (proxied through /api/traffic here).

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, StatCard } from '@/app/components/ui';
import { cn, formatNumber } from '@/app/lib/utils';
import { Globe, Users, Eye, MousePointerClick, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface CountEntry { key: string; pageviews: number; visitors: number }

interface TrafficStats {
  days: number;
  totals: { pageviews: number; visitors: number };
  daily: { day: string; pageviews: number; visitors: number }[];
  paths: CountEntry[];
  referrers: CountEntry[];
  utmSources: CountEntry[];
  countries: CountEntry[];
  devices: CountEntry[];
}

const RANGES = [7, 30, 90] as const;

function BreakdownCard({ title, rows, emptyLabel }: { title: string; rows: CountEntry[]; emptyLabel: string }) {
  const max = Math.max(...rows.map((r) => r.pageviews), 1);
  return (
    <Card>
      <CardContent>
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-3">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-slate-800">{r.key}</span>
                  <span className="shrink-0 tabular-nums text-slate-500 text-xs">
                    {formatNumber(r.visitors)} visitors · {formatNumber(r.pageviews)} views
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary-600/70"
                    style={{ width: `${Math.max((r.pageviews / max) * 100, 3)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function TrafficPage() {
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/traffic?days=${range}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `traffic ${res.status}`);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'collector unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const pagesPerVisit =
    stats && stats.totals.visitors > 0
      ? (stats.totals.pageviews / stats.totals.visitors).toFixed(1)
      : '—';
  const topReferrer = stats?.referrers[0]?.key ?? '—';

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Traffic</h1>
            <p className="text-slate-500 mt-1">
              Owned first-party pageview analytics from www.oneoral.com.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors',
                days === r
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {r}d
            </button>
          ))}
          <button
            onClick={() => void load(days)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Traffic collector unreachable: {error}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              The marketing site serves the data (<code className="bg-amber-100 px-1 py-0.5 rounded">/api/traffic</code>);
              this admin needs <code className="bg-amber-100 px-1 py-0.5 rounded">ONEORAL_MAIN_SITE_URL</code> +{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded">ONEORAL_SERVICE_API_KEY</code> set.
            </p>
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Visitors"
              value={formatNumber(stats.totals.visitors)}
              subtitle={`Unique sessions · last ${stats.days}d`}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Pageviews"
              value={formatNumber(stats.totals.pageviews)}
              subtitle={`Last ${stats.days}d`}
              icon={<Eye className="w-5 h-5" />}
            />
            <StatCard
              title="Pages / Visit"
              value={pagesPerVisit}
              subtitle="Depth per session"
              icon={<MousePointerClick className="w-5 h-5" />}
            />
            <StatCard
              title="Top Referrer"
              value={topReferrer}
              subtitle="By pageviews"
              icon={<Globe className="w-5 h-5" />}
            />
          </div>

          <Card className="mb-6">
            <CardContent>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Visitors & Pageviews</h2>
              {stats.daily.length === 0 ? (
                <p className="text-sm text-slate-400 py-10 text-center">
                  No traffic recorded yet — data appears as soon as the beacon is live on www.oneoral.com.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.daily}>
                      <defs>
                        <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1a3d2b" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#1a3d2b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="vis" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7ecfb0" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#7ecfb0" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis dataKey="day" stroke="var(--chart-axis)" tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis stroke="var(--chart-axis)" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="pageviews" stroke="var(--chart-primary)" strokeWidth={2.5} fill="url(#pv)" name="Pageviews" />
                      <Area type="monotone" dataKey="visitors" stroke="#7ecfb0" strokeWidth={2.5} fill="url(#vis)" name="Visitors" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <BreakdownCard title="Top Pages" rows={stats.paths} emptyLabel="No pageviews yet." />
            <BreakdownCard title="Referrers" rows={stats.referrers} emptyLabel="No external referrers yet." />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BreakdownCard title="UTM Sources" rows={stats.utmSources} emptyLabel="No tagged campaigns yet." />
            <BreakdownCard title="Countries" rows={stats.countries} emptyLabel="No geo data yet (set by Vercel in prod)." />
            <BreakdownCard title="Devices" rows={stats.devices} emptyLabel="No device data yet." />
          </div>
        </>
      )}
    </div>
  );
}
