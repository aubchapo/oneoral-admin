'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Badge, Pagination } from '@/app/components/ui';
import { formatCurrency, formatDate, cn } from '@/app/lib/utils';
import { adminApi, type Subscriber, MEMBERSHIP_NAME } from '@/lib/api';
import { Users, Search, Package } from 'lucide-react';

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  incomplete: 'bg-slate-100 text-slate-600 border-slate-200',
};

const kitStyles: Record<string, string> = {
  HRK: 'bg-rose-50 text-rose-700 border-rose-200',
  LRK: 'bg-teal-50 text-teal-700 border-teal-200',
};
const kitLabel: Record<string, string> = {
  HRK: 'Treatment',
  LRK: 'Maintenance',
};

export default function AccountsPage() {
  const router = useRouter();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi
      .getSubscribers(page, pageSize)
      .then(({ subscribers, total }) => {
        setSubscribers(subscribers);
        setTotal(total);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  const filtered = search
    ? subscribers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase())
      )
    : subscribers;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-primary-600 shadow-lg shadow-primary-500/30">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Accounts</h1>
          <p className="text-slate-500 mt-1">
            All {MEMBERSHIP_NAME} subscribers and the add-ons they&apos;ve purchased.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">
              Members <span className="text-sm font-normal text-slate-500">({total.toLocaleString()})</span>
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search this page..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Member</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Kit</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Started</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-6 py-3">Next Bill</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-6 py-3">Add-ons</th>
                    <th className="text-right text-xs font-semibold text-slate-600 uppercase px-6 py-3">Add-on $</th>
                    <th className="text-right text-xs font-semibold text-slate-600 uppercase px-6 py-3">LTV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/dashboard/accounts/${s.id}`)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 text-sm">{s.name}</p>
                          {s.isFounding && (
                            <span title="Founding 500 — whitening free for 12 months while the membership stays active">
                              <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
                                {s.foundingSlot ? `Founding #${s.foundingSlot}` : 'Founding 500'}
                              </Badge>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{s.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        {s.kitType ? (
                          <Badge className={cn('border', kitStyles[s.kitType])}>
                            {s.kitType} · {kitLabel[s.kitType]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={cn('border capitalize', statusStyles[s.status])}>{s.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatDate(s.startDate)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {s.status === 'paused' ? (
                          <span className="text-amber-600 font-medium">
                            Paused{s.pauseResumesAt ? ` · resumes ${formatDate(s.pauseResumesAt)}` : ''}
                          </span>
                        ) : s.status === 'incomplete' ? (
                          <span className="text-slate-500">Never completed</span>
                        ) : s.nextBillingDate === '-' ? (
                          '—'
                        ) : (
                          formatDate(s.nextBillingDate)
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {s.addons.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium">
                            <Package className="w-3 h-3" />
                            {s.addons.length}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 text-right">
                        {s.addonSpent > 0 ? formatCurrency(s.addonSpent) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-emerald-600 text-right">
                        {formatCurrency(s.totalSpent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={pageSize}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

    </div>
  );
}
