import { NextRequest, NextResponse } from 'next/server';

// Proxy to the marketing site's internal referrals endpoint.
// Referral rows live in the marketing app's Postgres, so admin reads them
// over the service key rather than holding a second connection to the same
// database — same arrangement as the support inbox and students list.

const base = () => (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:6001').replace(/\/$/, '');
const key = () => process.env.ONEORAL_SERVICE_API_KEY || process.env.SERVICE_API_KEY || '';

export async function GET(req: NextRequest) {
  const qs = new URL(req.url).search;
  try {
    const res = await fetch(`${base()}/api/internal/referrals${qs}`, {
      headers: { 'x-api-key': key() },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: `main site responded ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base()}` }, { status: 502 });
  }
}
