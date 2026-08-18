'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui';
import { cn } from '@/app/lib/utils';
import { FlaskConical, Upload, RefreshCw, FileText, AlertTriangle, Check, X } from 'lucide-react';

// The Bio Test queue: every salivary panel from payment through the licensed
// dentist's order, the kit, and the published result — plus any lab report that
// arrived without matching an order, which is the one thing here that always
// needs a human.

type Order = {
  id: string;
  status: string;
  member: { id: string; name: string | null; email: string };
  state: string | null;
  consultId: string | null;
  requestedAt: string | null;
  decision: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  declineReason: string | null;
  specimenId: string | null;
  kitShippedAt: string | null;
  trackingNumber: string | null;
  collectedAt: string | null;
  reportedAt: string | null;
  publishedAt: string | null;
  notifiedAt: string | null;
  patientDob: string | null;
  patientSex: string | null;
  simplytestOrderNumber: string | null;
  labOrderedAt: string | null;
  labStatus: string | null;
  labError: string | null;
  reviewReason: string | null;
  createdAt: string;
  pdfUrl: string | null;
};

type InboxRow = {
  id: string;
  source: string;
  fileName: string | null;
  specimenId: string | null;
  patientName: string | null;
  patientDob: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  pdfUrl: string | null;
  suggestions: { orderId: string; userId: string; name: string | null; email: string; nameMatches: boolean }[];
};

const STATUS_META: Record<string, { label: string; chip: string }> = {
  paid: { label: 'Paid — opening order', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
  awaiting_provider: { label: 'With the dentist', chip: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Approved — placing order', chip: 'bg-sky-100 text-sky-700 border-sky-200' },
  lab_ordered: { label: 'Ordered at the lab', chip: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  declined: { label: 'Declined', chip: 'bg-red-100 text-red-700 border-red-200' },
  kit_shipped: { label: 'Kit shipped', chip: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  specimen_received: { label: 'At the lab', chip: 'bg-violet-100 text-violet-700 border-violet-200' },
  published: { label: 'Published', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  needs_review: { label: 'Needs review', chip: 'bg-red-100 text-red-700 border-red-200' },
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function BioTestsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [labLive, setLabLive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bio-tests', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load the queue');
      setOrders(data.orders || []);
      setInbox(data.inbox || []);
      setLabLive(Boolean(data.labOrderingLive));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setNote(null);
    try {
      const res = await fetch('/api/bio-tests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setNote('Done.');
      await load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    setBusy('upload');
    setNote(null);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/bio-tests/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setNote(
        data.status === 'published'
          ? `Published to the member and emailed (specimen ${data.specimen}).`
          : data.status === 'duplicate'
          ? `Already published — nothing re-sent (specimen ${data.specimen}).`
          : data.status === 'unmatched'
          ? `Parsed specimen ${data.specimen}, but no order carries it. Match it below.`
          : `Couldn't read that report: ${data.error}`,
      );
      await load();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  const awaitingResult = orders.filter((o) => ['approved', 'kit_shipped', 'specimen_received'].includes(o.status));

  return (
    // Same frame as every other tab. This one had only `space-y-6`, so it ran
    // edge to edge against the sidebar while Accounts, Sales, Support and the
    // rest sat inside a padded, max-width column.
    <div className="px-5 py-6 lg:py-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FlaskConical size={22} /> Bio Tests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Salivary panels from payment to published result. Emailed reports file themselves; drop a PDF here when you pull one
            from the lab portal by hand.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy === 'upload'}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            <Upload size={15} /> {busy === 'upload' ? 'Reading report…' : 'Upload a lab report'}
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {labLive === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The SimplyTest bot is in <b>dry run</b> — it fills the order form and stops without submitting. Set
          <code className="mx-1 rounded bg-amber-100 px-1">SIMPLYTEST_MODE=live</code> on the portal once you&apos;ve watched
          one go through.
        </div>
      )}

      {note && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{note}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Reports that couldn't file themselves — always the top of the page. */}
      {inbox.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">Reports waiting on a human ({inbox.length})</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {inbox.map((row) => (
                <div key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">{row.specimenId || row.fileName || 'Unreadable report'}</span>
                    <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                      via {row.source}
                    </span>
                    <span className="text-slate-400">{fmtDate(row.createdAt)}</span>
                    {row.pdfUrl && (
                      <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900">
                        <FileText size={12} /> PDF
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {row.patientName ? `Report names ${row.patientName}${row.patientDob ? ` (${row.patientDob})` : ''}. ` : ''}
                    {row.error}
                  </p>
                  {row.status === 'unmatched' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.suggestions.length === 0 && (
                        <span className="text-[12px] text-slate-400">No order is waiting on a result — check the member paid.</span>
                      )}
                      {row.suggestions.map((s) => (
                        <button
                          key={s.orderId}
                          disabled={Boolean(busy)}
                          onClick={() => act('match', { inboxId: row.id, orderId: s.orderId }, `match-${row.id}`)}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50',
                            s.nameMatches
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          File onto {s.name || s.email}
                          {s.nameMatches ? ' · name matches' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {awaitingResult.length > 0 && (
        <p className="text-[13px] text-slate-500">
          {awaitingResult.length} panel{awaitingResult.length === 1 ? '' : 's'} out with members, waiting on the lab.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">State</th>
                  <th className="px-5 py-3 font-semibold">Lab order</th>
                  <th className="px-5 py-3 font-semibold">Specimen</th>
                  <th className="px-5 py-3 font-semibold">Reported</th>
                  <th className="px-5 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{o.member.name || '—'}</div>
                      <div className="text-[12px] text-slate-500">{o.member.email}</div>
                      <div className="text-[11px] text-slate-400">Ordered {fmtDate(o.createdAt)}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          'inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          STATUS_META[o.status]?.chip || 'bg-slate-100 text-slate-700 border-slate-200',
                        )}
                      >
                        {STATUS_META[o.status]?.label || o.status}
                      </span>
                      {o.reviewReason && <div className="mt-1 text-[11px] text-red-600">{o.reviewReason}</div>}
                      {o.declineReason && <div className="mt-1 text-[11px] text-slate-500">{o.declineReason}</div>}
                      {o.publishedAt && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          Published {fmtDate(o.publishedAt)}{o.notifiedAt ? ' · emailed' : ' · email not sent'}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{o.state || '—'}</td>
                    <td className="px-5 py-3.5">
                      {o.simplytestOrderNumber ? (
                        <a
                          href={`https://providerportal.simplytest.com/orders`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[12px] font-semibold text-slate-700 hover:text-slate-900"
                        >
                          #{o.simplytestOrderNumber}
                        </a>
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
                      {o.labStatus && <div className="text-[11px] text-slate-500">{o.labStatus}</div>}
                      {o.labError && <div className="mt-0.5 text-[11px] text-red-600">{o.labError}</div>}
                      {!o.patientDob && o.status !== 'published' && (
                        <div className="mt-0.5 text-[11px] text-amber-600">no DOB/sex on file</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {o.specimenId ? (
                        <span className="font-mono text-[12px] text-slate-700">{o.specimenId}</span>
                      ) : (
                        <SpecimenInput
                          disabled={Boolean(busy) || !['approved', 'needs_review'].includes(o.status)}
                          onSubmit={(specimenId, trackingNumber) =>
                            act('specimen', { orderId: o.id, specimenId, trackingNumber }, `specimen-${o.id}`)
                          }
                        />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {fmtDate(o.reportedAt)}
                      {o.pdfUrl && (
                        <a href={o.pdfUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-900">
                          <FileText size={12} /> PDF
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {o.status === 'awaiting_provider' && (
                        <div className="flex gap-1.5">
                          <button
                            disabled={Boolean(busy)}
                            onClick={() => act('decision', { orderId: o.id, decision: 'approved', decidedBy: 'admin' }, `d-${o.id}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            <Check size={12} /> Approved
                          </button>
                          <button
                            disabled={Boolean(busy)}
                            onClick={() => {
                              const reason = window.prompt('Why was it declined? (shown to the member)');
                              if (reason !== null) act('decision', { orderId: o.id, decision: 'declined', decidedBy: 'admin', reason }, `d-${o.id}`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <X size={12} /> Declined
                          </button>
                        </div>
                      )}
                      {o.status === 'approved' && !o.simplytestOrderNumber && (
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => act('place_lab_order', { orderId: o.id }, `lab-${o.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[12px] font-semibold text-sky-800 transition hover:bg-sky-100 disabled:opacity-50"
                        >
                          <FlaskConical size={12} /> {labLive ? 'Place lab order' : 'Test the form'}
                        </button>
                      )}
                      {o.status === 'paid' && (
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => act('retry_provider', { orderId: o.id }, `r-${o.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RefreshCw size={12} /> Send to dentist
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!orders.length && !loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                      No Bio Tests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Recording the specimen id is what lets the returning report file itself, so
// it is captured right where the kit is marked as shipped.
function SpecimenInput({ disabled, onSubmit }: { disabled: boolean; onSubmit: (specimenId: string, tracking: string) => void }) {
  const [specimen, setSpecimen] = useState('');
  const [tracking, setTracking] = useState('');
  if (disabled) return <span className="text-[12px] text-slate-400">—</span>;
  return (
    <div className="space-y-1.5">
      <input
        value={specimen}
        onChange={(e) => setSpecimen(e.target.value)}
        placeholder="Specimen ID"
        className="w-32 rounded border border-slate-200 px-2 py-1 font-mono text-[12px] focus:border-slate-400 focus:outline-none"
      />
      <input
        value={tracking}
        onChange={(e) => setTracking(e.target.value)}
        placeholder="Tracking (opt.)"
        className="w-32 rounded border border-slate-200 px-2 py-1 text-[12px] focus:border-slate-400 focus:outline-none"
      />
      <button
        onClick={() => specimen.trim() && onSubmit(specimen.trim(), tracking.trim())}
        className="block rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-700"
      >
        Kit shipped
      </button>
    </div>
  );
}
