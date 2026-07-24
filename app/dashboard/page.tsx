'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, StatCard, Badge } from '@/app/components/ui';
import { formatCurrency, formatNumber } from '@/app/lib/utils';
import { adminApi, type Lead, MEMBERSHIP_PRICE, MEMBERSHIP_NAME } from '@/lib/api';
import { DollarSign, Users, UserPlus, Flame, Package, Sparkles } from 'lucide-react';

const interestColors: Record<string, { bg: string; text: string }> = {
  cavities: { bg: 'bg-mint-100', text: 'text-primary-600' },
  whitening: { bg: 'bg-amber-50', text: 'text-amber-700' },
  breath: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  telehealth: { bg: 'bg-pink-50', text: 'text-pink-700' },
};

// Kit the lead signed up on (matches the accounts pages' kit badge colors)
const kitBadge: Record<string, { label: string; className: string }> = {
  HRK: { label: 'HRK · Treatment Kit', className: 'bg-rose-50 text-rose-700' },
  LRK: { label: 'LRK · Maintenance Kit', className: 'bg-teal-50 text-teal-700' },
};

interface StatsType {
  total: number;
  active: number;
  mrr: number;
  addonRevenueTotal: number;
  addonRevenueMonthly: number;
  addonsSold: number;
  addonSales: { id: string; name: string; price: number; count: number; revenue: number }[];
}

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getSubscriberStats(), adminApi.getLeads()])
      .then(([s, l]) => {
        setStats(s);
        setLeads(l);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Pipeline = leads we still might convert (new, contacted, qualified)
  const pipelineCount = leads.filter((l) =>
    l.status === 'new' || l.status === 'contacted' || l.status === 'qualified'
  ).length;
  const lostCount = leads.filter((l) => l.status === 'lost').length;

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Overview</h1>
        <p className="text-slate-500 mt-1">
          Membership, add-on sales, and CRM at a glance.
        </p>
      </div>

      {/* Plan callout */}
      <Card className="mb-6 bg-gradient-to-br from-primary-600 to-primary-800 border-0">
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/80 text-sm">The Plan</p>
                <h2 className="text-2xl font-bold text-white">{MEMBERSHIP_NAME}</h2>
                <p className="text-white/80 text-sm mt-1">One subscription. Tons of value. Add-ons available.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-white">${MEMBERSHIP_PRICE}<span className="text-lg font-normal text-white/80">/mo</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Membership MRR"
          value={formatCurrency(stats.mrr)}
          subtitle={`${formatNumber(stats.active)} active members`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Add-on Revenue (Mo)"
          value={formatCurrency(stats.addonRevenueMonthly)}
          subtitle={`${formatCurrency(stats.addonRevenueTotal)} all-time`}
          icon={<Package className="w-5 h-5" />}
        />
        <StatCard
          title="Total Members"
          value={formatNumber(stats.total)}
          subtitle={`${formatNumber(stats.active)} active`}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Leads"
          value={formatNumber(leads.length)}
          subtitle={
            pipelineCount > 0
              ? `${formatNumber(pipelineCount)} in pipeline · ${formatNumber(lostCount)} abandoned`
              : `${formatNumber(lostCount)} abandoned signups`
          }
          icon={<Flame className="w-5 h-5" />}
        />
      </div>

      {/* Add-on sales card */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Add-on Sales</h2>
              <p className="text-xs text-slate-500">Total sold across all members (lifetime)</p>
            </div>
            <Link href="/dashboard/sales" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View sales →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.addonSales.map((a) => (
              <div key={a.id} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs font-medium text-slate-500 truncate">{a.name}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatNumber(a.count)}</p>
                <p className="text-xs text-emerald-600 mt-1 font-medium">{formatCurrency(a.revenue)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">${a.price} each</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Recent Leads</h2>
            <Link href="/dashboard/leads" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {leads.slice(0, 6).map((lead) => {
              const c = interestColors[lead.interest] || interestColors.cavities;
              return (
                <div key={lead.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${c.bg} flex items-center justify-center`}>
                      <span className={`font-semibold ${c.text}`}>
                        {(lead.name || lead.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{lead.name || lead.email}</p>
                      <p className="text-xs text-slate-500">{lead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {lead.promoCode && (
                      <Badge className="bg-violet-50 text-violet-700 border-transparent font-mono uppercase">
                        {lead.promoCode}
                      </Badge>
                    )}
                    {lead.status === 'converted' && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-transparent">Paid ✓</Badge>
                    )}
                    {lead.kit && kitBadge[lead.kit] ? (
                      <Badge className={`${kitBadge[lead.kit].className} border-transparent`}>
                        {kitBadge[lead.kit].label}
                      </Badge>
                    ) : (
                      <Badge className={`${c.bg} ${c.text} border-transparent capitalize`}>
                        interested in {lead.interest.replace('-', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
