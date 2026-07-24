import { NextRequest, NextResponse } from 'next/server';

// Proxy to the marketing site's owned traffic collector (GET /api/traffic).
// Service key stays server-side.
export async function GET(req: NextRequest) {
  const base = (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002').replace(/\/$/, '');
  const serviceKey = process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';
  const days = req.nextUrl.searchParams.get('days') || '30';
  try {
    const res = await fetch(`${base}/api/traffic?days=${encodeURIComponent(days)}`, {
      headers: { 'x-api-key': serviceKey },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `collector responded ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base}` }, { status: 502 });
  }
}
