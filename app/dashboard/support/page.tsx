'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import { Inbox, RefreshCw, Search, Send, ShieldAlert } from 'lucide-react';

// The support inbox. Every ticket the contact form and the support@ relay have
// ever produced lived in Postgres with nothing rendering it — this is that
// screen. Left: the queue. Right: the full correspondence chain plus a reply
// box that sends from support@oneoral.com on the ticket's masked thread.

type Ticket = {
  id: string;
  ref: string;
  name: string;
  email: string;
  subject: string;
  preview: string;
  category: string;
  routing: string;
  status: string;
  isProductComplaint: boolean;
  forwardedToCarifreeAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type Message = {
  id: string;
  direction: string;
  fromEmail: string | null;
  body: string;
  createdAt: string;
};

type TicketDetail = Ticket & {
  message: string;
  phone: string | null;
  address: string | null;
  issueType: string | null;
  orderNumber: string | null;
  trackingNumber: string | null;
  productSku: string | null;
  lotNumber: string | null;
  photo: string | null;
  messages: Message[];
};

const STATUS_META: Record<string, { label: string; chip: string }> = {
  open: { label: 'Open', chip: 'bg-sky-100 text-sky-700 border-sky-200' },
  awaiting_carifree: { label: 'Awaiting CariFree', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  awaiting_member: { label: 'Awaiting member', chip: 'bg-violet-100 text-violet-700 border-violet-200' },
  resolved: { label: 'Resolved', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', chip: 'bg-slate-100 text-slate-600 border-slate-200' },
  spam: { label: 'Spam', chip: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const DIRECTION_META: Record<string, { label: string; cls: string; align: 'left' | 'right' }> = {
  member_in: { label: 'Member', cls: 'bg-white border-slate-200', align: 'left' },
  member_out: { label: 'Us → member', cls: 'bg-primary-50 border-primary-200', align: 'right' },
  carifree_out: { label: 'Us → CariFree', cls: 'bg-amber-50 border-amber-200', align: 'right' },
  carifree_in: { label: 'CariFree', cls: 'bg-amber-50 border-amber-200', align: 'left' },
  agent_note: { label: 'Internal note', cls: 'bg-slate-50 border-dashed border-slate-300', align: 'left' },
};

const FILTERS = ['open', 'awaiting_member', 'awaiting_carifree', 'resolved', 'spam', 'all'] as const;
const filterLabel = (f: string) =>
  f === 'all' ? 'All' : (STATUS_META[f]?.label ?? f);

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('open');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams({ status: filter });
      if (search) qs.set('q', search);
      const res = await fetch(`/api/support?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setCounts(data.counts ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  const openTicket = useCallback(async (ref: string) => {
    setSelected(ref);
    setDetail(null);
    setReply('');
    setSendError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/support/${ref}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API ${res.status}`);
      setDetail(data.ticket);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to load ticket');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const setStatus = async (ref: string, status: string) => {
    const res = await fetch(`/api/support/${ref}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setDetail(d => (d ? { ...d, status } : d));
      load();
    }
  };

  const sendReply = async () => {
    if (!detail || !reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/support/${detail.ref}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API ${res.status}`);
      setDetail(data.ticket);
      setReply('');
      load();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const spamCount = counts.spam ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-primary-600" />
            Support inbox
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every ticket from the contact form and the support@oneoral.com relay. Replies send from
            support@ on the member&rsquo;s existing thread.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {spamCount > 0 && filter !== 'spam' && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {spamCount} submission{spamCount === 1 ? '' : 's'} auto-flagged as spam and never replied to.
          <button onClick={() => setFilter('spam')} className="underline font-medium">Review</button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filter === f
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
            )}
          >
            {filterLabel(f)}
            {counts[f] != null && f !== 'all' && <span className="ml-1.5 opacity-70">{counts[f]}</span>}
          </button>
        ))}
        <form
          onSubmit={e => { e.preventDefault(); setSearch(query.trim()); }}
          className="flex items-center gap-2 ml-auto"
        >
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ref, name, email, message…"
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
        </form>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
        {/* Queue */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {loading && tickets.length === 0 && (
              <p className="p-6 text-sm text-slate-400">Loading…</p>
            )}
            {!loading && tickets.length === 0 && (
              <p className="p-6 text-sm text-slate-400">Nothing in this queue.</p>
            )}
            {tickets.map(t => {
              const meta = STATUS_META[t.status] ?? { label: t.status, chip: 'bg-slate-100 text-slate-600 border-slate-200' };
              return (
                <button
                  key={t.ref}
                  onClick={() => openTicket(t.ref)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors',
                    selected === t.ref && 'bg-primary-50 hover:bg-primary-50',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">{t.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{when(t.updatedAt)}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{t.email}</div>
                  <div className="text-sm text-slate-700 mt-1 truncate">{t.subject}</div>
                  <div className="text-xs text-slate-400 truncate">{t.preview}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', meta.chip)}>
                      {meta.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-slate-50 text-slate-500 border-slate-200">
                      {t.category}
                    </span>
                    {t.forwardedToCarifreeAt && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-50 text-amber-700 border-amber-200">
                        sent to CariFree
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto font-mono">{t.ref}</span>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Thread */}
        <Card className="min-h-[320px]">
          <CardContent className="p-5">
            {!selected && <p className="text-sm text-slate-400">Pick a ticket to read the thread.</p>}
            {selected && detailLoading && <p className="text-sm text-slate-400">Loading ticket…</p>}
            {detail && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{detail.subject}</h2>
                    <p className="text-sm text-slate-500">
                      {detail.name} · {detail.email}
                      {detail.phone ? ` · ${detail.phone}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {detail.ref} · opened {when(detail.createdAt)}
                    </p>
                  </div>
                  <select
                    value={detail.status}
                    onChange={e => setStatus(detail.ref, e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                  >
                    {Object.entries(STATUS_META).map(([value, m]) => (
                      <option key={value} value={value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {(detail.orderNumber || detail.trackingNumber || detail.productSku || detail.address) && (
                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-0.5">
                    {detail.orderNumber && <div><span className="text-slate-400">Order</span> {detail.orderNumber}</div>}
                    {detail.trackingNumber && <div><span className="text-slate-400">Tracking</span> {detail.trackingNumber}</div>}
                    {detail.productSku && <div><span className="text-slate-400">SKU</span> {detail.productSku}{detail.lotNumber ? ` · lot ${detail.lotNumber}` : ''}</div>}
                    {detail.address && <div><span className="text-slate-400">Address</span> {detail.address}</div>}
                  </div>
                )}

                {detail.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.photo} alt="Member-supplied photo of the issue" className="max-h-64 rounded-lg border border-slate-200" />
                )}

                <div className="space-y-3">
                  {detail.messages.map(m => {
                    const meta = DIRECTION_META[m.direction] ?? { label: m.direction, cls: 'bg-white border-slate-200', align: 'left' as const };
                    return (
                      <div key={m.id} className={cn('flex', meta.align === 'right' && 'justify-end')}>
                        <div className={cn('max-w-[85%] border rounded-xl px-3.5 py-2.5', meta.cls)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-slate-500">{meta.label}</span>
                            <span className="text-[11px] text-slate-400">{when(m.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {detail.status === 'spam' ? (
                  <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    Flagged as spam — no reply was sent. If this is a real member, set the status to
                    Open and the reply box comes back.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      rows={5}
                      placeholder={`Reply to ${detail.name.split(/\s+/)[0] || 'the member'}… sends from support@oneoral.com`}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                    {sendError && <p className="text-sm text-red-600">{sendError}</p>}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-400">
                        Goes out as support@oneoral.com with Reply-To support+{detail.ref}@oneoral.com,
                        so their answer lands back on this thread.
                      </p>
                      <button
                        onClick={sendReply}
                        disabled={sending || !reply.trim()}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        <Send className="w-4 h-4" />
                        {sending ? 'Sending…' : 'Send reply'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
