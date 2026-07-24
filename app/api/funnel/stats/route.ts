import { NextResponse } from 'next/server';

// Proxy to the dry-test funnel's owned collector (lead-funnel/app on Vercel).
// The token stays server-side; the dashboard page only ever talks to this route.
//   FUNNEL_URL         - funnel deployment base (default: local vite dev)
//   FUNNEL_ADMIN_TOKEN - the funnel project's ADMIN_TOKEN (gates GET /api/stats)
export async function GET() {
  const base = (process.env.FUNNEL_URL || 'http://localhost:3012').replace(/\/$/, '');
  const token = process.env.FUNNEL_ADMIN_TOKEN;
  try {
    const res = await fetch(`${base}/api/stats`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `collector responded ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `collector unreachable at ${base}` }, { status: 502 });
  }
}
