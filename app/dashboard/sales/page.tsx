'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, StatCard } from '@/app/components/ui';
import { formatCurrency, formatNumber, cn } from '@/app/lib/utils';
import { adminApi, MEMBERSHIP_PRICE, MEMBERSHIP_NAME, CARIFREE_KIT_COST, KITS_PER_YEAR } from '@/lib/api';
import { TrendingUp, DollarSign, Package, Repeat, Truck, Tag } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';

import type { Stats } from '@/lib/api';

type SalesTab = 'revenue' | 'addons' | 'costs' | 'promos';

const TABS: { key: SalesTab; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'addons', label: 'Add-ons' },
  { key: 'costs', label: 'Costs & Margin' },
  { key: 'promos', label: 'Promo Codes' },
];

export default function SalesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<SalesTab>('revenue');

  useEffect(() => {
    adminApi.getSubscriberStats().then((s) => setStats(s));
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Real monthly history straight from the data source
  const monthlyData = stats.monthlyRevenue.map((m) => ({
    month: m.label.split(' ')[0], // short month label for the axis
    membership: m.membership,
    addons: m.addons,
    newSubs: m.newSubs,
    churn: m.churned,
  }));

  const totalNewSubs = monthlyData.reduce((sum, d) => sum + d.newSubs, 0);
  const arpu = stats.active > 0 ? Math.round(stats.mrr / stats.active) : 0;
  const attachRate =
    stats.total > 0 ? Math.round((stats.addonsSold / stats.total) * 100) : 0;
  const revenueTrendPct = Math.round(stats.revenueTrend * 100);
  const addonTrendPct = Math.round(stats.addonTrend * 100);

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/30">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Sales Tracking</h1>
          <p className="text-slate-500 mt-1">
            {MEMBERSHIP_NAME} (${MEMBERSHIP_PRICE}/mo) + add-on sales performance.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-semibold transition-colors',
              tab === t.key
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Revenue ─── */}
      {tab === 'revenue' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Trailing 12mo Revenue"
              value={formatCurrency(stats.trailingRevenue12mo)}
              subtitle="Membership + add-ons"
              icon={<DollarSign className="w-5 h-5" />}
              trend={revenueTrendPct}
            />
            <StatCard
              title="Membership MRR"
              value={formatCurrency(stats.mrr)}
              subtitle={`${formatNumber(stats.active)} active`}
              icon={<Repeat className="w-5 h-5" />}
            />
            <StatCard
              title="Quarterly RR"
              value={formatCurrency(stats.quarterlyRR ?? 0)}
              subtitle={`${formatNumber(stats.quarterlyPlanMembers ?? 0)} on quarterly · effectively ${formatCurrency((stats.quarterlyRR ?? 0) / 3)}/mo`}
              icon={<Repeat className="w-5 h-5" />}
            />
            <StatCard
              title="Monthly RR"
              value={formatCurrency(stats.monthlyRR ?? 0)}
              subtitle={`${formatNumber(stats.monthlyPlanMembers ?? 0)} on monthly plans`}
              icon={<Repeat className="w-5 h-5" />}
            />
          </div>

          <Card className="mb-6">
            <CardContent>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Revenue (12 months)</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="month" stroke="var(--chart-axis)" />
                    <YAxis stroke="var(--chart-axis)" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="membership" stroke="var(--chart-primary)" strokeWidth={3} name="Membership" />
                    <Line type="monotone" dataKey="addons" stroke="#7ecfb0" strokeWidth={3} name="Add-ons" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">New vs. Churned Subscribers</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="month" stroke="var(--chart-axis)" />
                    <YAxis stroke="var(--chart-axis)" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="newSubs" fill="var(--chart-secondary)" name="New" />
                    <Bar dataKey="churn" fill="#ef4444" name="Churn" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Net new this year: <span className="font-semibold text-slate-800">{formatNumber(totalNewSubs)}</span>
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Add-ons ─── */}
      {tab === 'addons' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Add-on Revenue (Mo)"
              value={formatCurrency(stats.addonRevenueMonthly)}
              subtitle={`${formatCurrency(stats.addonRevenueTotal)} all-time`}
              icon={<Package className="w-5 h-5" />}
              trend={addonTrendPct}
            />
            <StatCard
              title="Add-ons Sold"
              value={formatNumber(stats.addonsSold)}
              subtitle="All-time units"
              icon={<Package className="w-5 h-5" />}
            />
            <StatCard
              title="Add-on Attach Rate"
              value={`${attachRate}%`}
              subtitle="Add-ons sold per member (lifetime)"
            />
            <StatCard
              title="ARPU"
              value={formatCurrency(arpu)}
              subtitle="Monthly revenue per active member"
              icon={<DollarSign className="w-5 h-5" />}
            />
          </div>

          <Card className="mb-6">
            <CardContent>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Add-on Sales by Product</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.addonSales} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis type="number" stroke="var(--chart-axis)" tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" stroke="var(--chart-axis)" width={130} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Bar dataKey="revenue" fill="var(--chart-primary)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800">Add-on Catalog Performance</h2>
                <p className="text-xs text-slate-500">Lifetime units and revenue per add-on</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Add-on</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-6 py-3">Price</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-6 py-3">Units Sold</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-6 py-3">Revenue</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-6 py-3">Attach %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.addonSales
                      .slice()
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{a.name}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(a.price)}</td>
                          <td className="px-6 py-4 text-right text-slate-700">{formatNumber(a.count)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-emerald-600">
                            {formatCurrency(a.revenue)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600">
                            {Math.round((a.count / stats.total) * 100)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Costs & Margin ─── */}
      {tab === 'costs' && (
        <Card className="border-l-4 border-l-amber-500">
          <CardContent>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-600" />
                  CariFree Cost Tracker
                </h2>
                <p className="text-xs text-slate-500">
                  Trailing 12 months · ${CARIFREE_KIT_COST}/kit · {KITS_PER_YEAR} kits/member/year
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase">Gross Margin</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {Math.round(stats.grossMarginPercent * 100)}%
                </p>
              </div>
            </div>
            {stats.netsuiteKits ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-rose-50 rounded-xl p-4">
                    <p className="text-xs text-rose-700 uppercase">HRK Shipped</p>
                    <p className="text-xl font-bold text-rose-900">{formatNumber(stats.netsuiteKits.hrkShipped)}</p>
                    <p className="text-xs text-rose-600 mt-1">Treatment Kit</p>
                  </div>
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-xs text-teal-700 uppercase">LRK Shipped</p>
                    <p className="text-xl font-bold text-teal-900">{formatNumber(stats.netsuiteKits.lrkShipped)}</p>
                    <p className="text-xs text-teal-600 mt-1">Maintenance Kit</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase">Total COGS</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(stats.netsuiteKits.totalShipped * CARIFREE_KIT_COST)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatNumber(stats.netsuiteKits.totalShipped)} kits · ${CARIFREE_KIT_COST} ea
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-xs text-emerald-700 uppercase">12mo Gross Margin</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {formatCurrency(
                        Math.round((stats.membershipRevenue12mo - stats.netsuiteKits.totalShipped * CARIFREE_KIT_COST) * 100) / 100
                      )}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">Stripe revenue − real COGS</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Real shipment data from NetSuite ({formatNumber(stats.netsuiteKits.shipmentCount)} fulfillments)
                </p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase">Kits / Quarter</p>
                    <p className="text-xl font-bold text-slate-900">{formatNumber(stats.kitsPerQuarter)}</p>
                    <p className="text-xs text-slate-400 mt-1">1 per subscribed member</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase">Quarterly COGS</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(stats.kitCostPerQuarter)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase">Annual COGS</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(stats.kitCostPerYear)}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatNumber(stats.kitsPerYear)} kits/yr</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-xs text-emerald-700 uppercase">12mo Gross Margin</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats.grossMargin12mo)}</p>
                    <p className="text-xs text-emerald-600 mt-1">Revenue − annual COGS</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 italic">
                  Estimated — connect NetSuite for real shipment data
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Promo Codes ─── */}
      {tab === 'promos' && (
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-600" />
              Promo Code Usage
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Members who signed up with a code (from Stripe subscription metadata). Full-price signups excluded.
            </p>
            {stats.promoUsage && stats.promoUsage.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full max-w-xl">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-600 uppercase">
                      <th className="py-2 pr-6">Code</th>
                      <th className="py-2 pr-6 text-right">Members</th>
                      <th className="py-2 text-right">Currently Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.promoUsage.map((p) => (
                      <tr key={p.code}>
                        <td className="py-2.5 pr-6">
                          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-mono font-semibold uppercase text-violet-700">
                            {p.code}
                          </span>
                        </td>
                        <td className="py-2.5 pr-6 text-right font-semibold tabular-nums text-slate-900">{p.members}</td>
                        <td className="py-2.5 text-right tabular-nums text-slate-700">{p.active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No promo codes used yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
