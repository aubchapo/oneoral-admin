import { NextRequest, NextResponse } from 'next/server';

// Send an agent reply on a ticket. The marketing app owns the send (it holds
// the support@ SMTP credentials and the masked-relay logic); admin only relays
// the body and surfaces the error text so a failed send is visible in the UI.

const base = () => (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002').replace(/\/$/, '');
const key = () => process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';

export async function POST(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const body = await req.text();
  try {
    const res = await fetch(`${base()}/api/support/tickets/${encodeURIComponent(ref)}/reply`, {
      method: 'POST',
      headers: { 'x-api-key': key(), 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base()}` }, { status: 502 });
  }
}
