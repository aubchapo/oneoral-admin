import { NextRequest, NextResponse } from 'next/server';

// One ticket + its correspondence chain; PATCH sets status or appends an
// internal note. Proxies the marketing site's /api/support/tickets/[ref].

const base = () => (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002').replace(/\/$/, '');
const key = () => process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  try {
    const res = await fetch(`${base()}/api/support/tickets/${encodeURIComponent(ref)}`, {
      headers: { 'x-api-key': key() },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base()}` }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const body = await req.text();
  try {
    const res = await fetch(`${base()}/api/support/tickets/${encodeURIComponent(ref)}`, {
      method: 'PATCH',
      headers: { 'x-api-key': key(), 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base()}` }, { status: 502 });
  }
}
