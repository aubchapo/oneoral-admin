import { NextRequest, NextResponse } from 'next/server';

// Proxy to the marketing site's support inbox (GET /api/support/tickets).
// Tickets live in the marketing app's Postgres alongside the CariFree relay
// state, so admin reads them over the service key rather than holding a second
// connection to the same database. Key stays server-side.

const base = () => (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002').replace(/\/$/, '');
const key = () => process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';

export async function GET(req: NextRequest) {
  const qs = new URL(req.url).search;
  try {
    const res = await fetch(`${base()}/api/support/tickets${qs}`, {
      headers: { 'x-api-key': key() },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: `main site responded ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base()}` }, { status: 502 });
  }
}
