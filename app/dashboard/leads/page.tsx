'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui';
import { formatDate, cn } from '@/app/lib/utils';
import { adminApi, type Lead } from '@/lib/api';
import { UserPlus } from 'lucide-react';

const goalColors: Record<string, string> = {
  cavities: 'bg-mint-100 text-primary-600',
  gums: 'bg-green-100 text-green-700',
  whitening: 'bg-amber-100 text-amber-700',
  breath: 'bg-emerald-100 text-emerald-700',
  'drill-free': 'bg-purple-100 text-purple-700',
};

const dropOffColors: Record<string, string> = {
  quiz: 'bg-teal-100 text-teal-700',
  checkout: 'bg-orange-100 text-orange-700',
  payment: 'bg-red-100 text-red-700',
};

const dropOffLabels: Record<string, string> = {
  quiz: 'Quiz',
  checkout: 'Checkout',
  payment: 'Payment',
};

const kitColors: Record<string, string> = {
  HRK: 'bg-rose-50 text-rose-700 border border-rose-200',
  LRK: 'bg-teal-50 text-teal-700 border border-teal-200',
};

const kitLabels: Record<string, string> = {
  HRK: 'HRK · Treatment',
  LRK: 'LRK · Maintenance',
};

const statusColors: Record<string, string> = {
  new: 'bg-mint-100 text-primary-700',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-gray-100 text-gray-800',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDropOff, setFilterDropOff] = useState<string>('all');

  useEffect(() => {
    adminApi.getLeads().then((l) => {
      setLeads(l);
      setLoading(false);
    });
  }, []);

  // Converted leads paid — they never "dropped", so they only show under All
  const filtered =
    filterDropOff === 'all'
      ? leads
      : leads.filter((l) => l.dropOff === filterDropOff && l.status !== 'converted');

  const updateStatus = (id: string, status: Lead['status']) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    adminApi.updateLeadStatus(id, status);
  };

  const dropped = leads.filter((l) => l.status !== 'converted');
  const counts = {
    all: leads.length,
    quiz: dropped.filter(l => l.dropOff === 'quiz').length,
    checkout: dropped.filter(l => l.dropOff === 'checkout').length,
    payment: dropped.filter(l => l.dropOff === 'payment').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
          <UserPlus className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Leads</h1>
          <p className="text-slate-500 mt-1">Quiz and checkout abandonment — follow up to convert.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', key: 'all', color: 'bg-slate-100 text-slate-700' },
          { label: 'Quiz Drop-off', key: 'quiz', color: dropOffColors.quiz },
          { label: 'Checkout Drop-off', key: 'checkout', color: dropOffColors.checkout },
          { label: 'Payment Drop-off', key: 'payment', color: dropOffColors.payment },
        ].map(({ label, key, color }) => (
          <button
            key={key}
            onClick={() => setFilterDropOff(key)}
            className={cn(
              'rounded-xl p-4 text-left transition-all border-2',
              filterDropOff === key ? 'border-slate-900' : 'border-transparent',
              color.includes('bg-') ? '' : 'bg-white'
            )}
          >
            <p className={cn('text-2xl font-bold', color.split(' ')[1])}>{counts[key as keyof typeof counts]}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">
              {filterDropOff === 'all' ? 'All Leads' : `${dropOffLabels[filterDropOff]} Abandonment`}
            </h2>
            <span className="text-sm text-slate-500">{filtered.length} leads</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Lead</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Kit</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Goals</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Dropped at</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">No leads yet. They'll appear here as users go through the quiz and checkout.</td>
                  </tr>
                )}
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                          <span className="font-semibold text-slate-600 text-sm">
                            {(lead.name || lead.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{lead.name || '—'}</p>
                          <p className="text-xs text-slate-500">{lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {lead.kit ? (
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', kitColors[lead.kit])}>
                            {kitLabels[lead.kit]}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        {lead.promoCode && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium uppercase bg-violet-50 text-violet-700 border border-violet-200 whitespace-nowrap">
                            {lead.promoCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(lead.goals ?? []).length > 0
                          ? (lead.goals ?? []).map(g => (
                              <span key={g} className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', goalColors[g] || 'bg-slate-100 text-slate-600')}>
                                {g.replace('-', ' ')}
                              </span>
                            ))
                          : <span className="text-xs text-slate-400">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {lead.status === 'converted' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 whitespace-nowrap">
                          Paid ✓
                        </span>
                      ) : (
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', dropOffColors[lead.dropOff ?? 'quiz'] || 'bg-slate-100 text-slate-600')}>
                          {dropOffLabels[lead.dropOff ?? 'quiz'] ?? lead.dropOff}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value as Lead['status'])}
                        className={cn('px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer', statusColors[lead.status])}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
