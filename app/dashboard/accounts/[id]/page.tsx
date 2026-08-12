'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Badge } from '@/app/components/ui';
import { formatCurrency, formatDate, cn } from '@/app/lib/utils';
import { adminApi, type Subscriber, MEMBERSHIP_NAME, MEMBERSHIP_PRICE, CARIFREE_KIT_COST } from '@/lib/api';
import { ArrowLeft, Package, User, Mail, Calendar, CreditCard, Truck, MapPin, ExternalLink } from 'lucide-react';

interface ShipmentFulfillment {
  fulfillmentId: string;
  status: 'shipped' | 'packed' | 'picked' | 'pending';
  trackingNumbers: string[];
  shipMethod?: string;
  shipDate?: string;
}
interface Shipment {
  salesOrderId: string;
  poNum: string;
  tranDate: string;
  status: string;
  itemId?: string;
  itemName?: string;
  fulfillments: ShipmentFulfillment[];
}

const fulfillmentStatusStyles: Record<string, string> = {
  shipped: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  packed: 'bg-mint-50 text-primary-600 border-mint-200',
  picked: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
};

function trackingUrl(num: string): string {
  // Best-effort tracking URL — most carriers accept the bare number on Google Search.
  // Refine when we know which carrier the storefront is shipping with.
  return `https://www.google.com/search?q=${encodeURIComponent('package tracking ' + num)}`;
}

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
const kitFullName: Record<string, string> = {
  HRK: 'HRK · Treatment Kit',
  LRK: 'LRK · Maintenance Kit',
};

export default function MemberDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [member, setMember] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [shipmentsConfigured, setShipmentsConfigured] = useState(true);
  const [shipmentsLoading, setShipmentsLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    adminApi
      .getSubscriberById(params.id)
      .then((m) => {
        if (!m) setNotFound(true);
        else setMember(m);
      })
      .finally(() => setLoading(false));

    // Fetch shipments in parallel — independent of member data
    fetch(`/api/subscribers/${params.id}/shipments`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setShipments(data.shipments || []);
        setShipmentsConfigured(data.configured !== false);
      })
      .catch(() => setShipments([]))
      .finally(() => setShipmentsLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (notFound || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Member not found.</p>
          <Link
            href="/dashboard/accounts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 lg:py-10 max-w-5xl mx-auto">
      <button
        onClick={() => router.push('/dashboard/accounts')}
        className="flex items-center gap-2 text-slate-600 hover:text-primary-600 mb-6 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Accounts
      </button>

      {/* Header card */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold">
                {member.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{member.name}</h1>
                <p className="text-slate-500">{member.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge className={cn('border capitalize', statusStyles[member.status])}>{member.status}</Badge>
                  <Badge variant="info">{MEMBERSHIP_NAME}</Badge>
                  {member.kitType && (
                    <Badge className={cn('border', kitStyles[member.kitType])}>
                      {kitFullName[member.kitType]}
                    </Badge>
                  )}
                  {member.promoCode && (
                    <Badge className="bg-violet-50 text-violet-700 border-violet-200 font-mono uppercase">
                      {member.promoCode}
                    </Badge>
                  )}
                  {member.isFounding && (
                    <span title="Whitening is free for 12 months while this membership stays active. Cancelling forfeits the remaining boxes and the spot is not restored.">
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        {member.foundingSlot ? `Founding 500 · #${member.foundingSlot}` : 'Founding 500'}
                      </Badge>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase">Lifetime Value</p>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(member.totalSpent)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardContent>
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Account Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Customer ID</p>
                <p className="font-mono text-sm text-slate-900">{member.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Primary Concern</p>
                <p className="text-sm text-slate-900 capitalize">{member.interest.replace('-', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Member Since
                </p>
                <p className="text-sm text-slate-900">{formatDate(member.startDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> Next Billing
                </p>
                <p className="text-sm text-slate-900">
                  {member.status === 'paused'
                    ? `Paused${member.pauseResumesAt ? ` · resumes ${formatDate(member.pauseResumesAt)}` : ' indefinitely'}`
                    : member.status === 'incomplete'
                    ? 'Signup never completed'
                    : member.status === 'cancelled'
                    ? 'Cancelled'
                    : member.nextBillingDate === '-'
                    ? '—'
                    : formatDate(member.nextBillingDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </p>
                <p className="text-sm text-slate-900 break-all">{member.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Monthly</p>
                <p className="text-sm text-slate-900">
                  {member.monthlyAmount > 0 ? `$${member.monthlyAmount.toFixed(2)}/mo` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Spend Breakdown</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase">Membership</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(member.membershipSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Add-ons</p>
                <p className="text-2xl font-bold text-primary-600">{formatCurrency(member.addonSpent)}</p>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 uppercase">Total LTV</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(member.totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        // Member-level CariFree margin: based on actual paid months, not tenure.
        // A member who never paid was never shipped a kit.
        const monthsBilled = Math.round(member.membershipSpent / MEMBERSHIP_PRICE);
        const kitsSent = monthsBilled === 0 ? 0 : Math.ceil(monthsBilled / 3);
        const cogs = kitsSent * CARIFREE_KIT_COST;
        const margin = member.totalSpent - cogs;
        const marginPct = member.totalSpent > 0 ? Math.round((margin / member.totalSpent) * 100) : 0;
        return (
          <Card className="mb-6 border-l-4 border-l-amber-500">
            <CardContent>
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600" />
                CariFree Cost & Margin
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Kits Sent</p>
                  <p className="text-xl font-bold text-slate-900">{kitsSent}</p>
                  <p className="text-xs text-slate-400 mt-1">${CARIFREE_KIT_COST} ea · quarterly</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">COGS</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(cogs)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Net Margin</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(margin)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Margin %</p>
                  <p className="text-xl font-bold text-emerald-600">{marginPct}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Shipments & tracking from NetSuite */}
      <Card className="mb-6">
        <CardContent>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-600" />
            Shipments & Tracking
            {shipments && shipments.length > 0 && (
              <span className="text-sm font-normal text-slate-500">({shipments.length})</span>
            )}
          </h2>
          {!shipmentsConfigured ? (
            <p className="text-sm text-slate-500 italic">NetSuite not configured.</p>
          ) : shipmentsLoading ? (
            <div className="py-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : !shipments || shipments.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No shipments yet from NetSuite.</p>
          ) : (
            <div className="space-y-4">
              {shipments.map((s) => (
                <div key={s.salesOrderId} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.itemName || 'Sales Order'}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">PO {s.poNum}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(s.tranDate)}</p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">{s.status || 'Pending'}</Badge>
                  </div>
                  {s.fulfillments.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />
                      Awaiting fulfillment
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {s.fulfillments.map((f) => (
                        <div key={f.fulfillmentId} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge className={cn('border capitalize', fulfillmentStatusStyles[f.status])}>{f.status}</Badge>
                            {f.shipDate && (
                              <span className="text-xs text-slate-500">{formatDate(f.shipDate)}</span>
                            )}
                            {f.shipMethod && (
                              <span className="text-xs text-slate-400">· {f.shipMethod}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {f.trackingNumbers.length === 0 ? (
                              <span className="text-xs text-slate-400">No tracking yet</span>
                            ) : (
                              f.trackingNumbers.map((t) => (
                                <a
                                  key={t}
                                  href={trackingUrl(t)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-mono text-primary-600 hover:text-primary-700"
                                >
                                  {t}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Purchased Add-ons ({member.addons.length})
          </h2>
          {member.addons.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No add-ons purchased yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-3">Add-on</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-3">Purchased</th>
                    <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {member.addons.map((a, idx) => (
                    <tr key={`${a.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(a.purchasedAt)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(a.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
