import { NextResponse } from 'next/server';

// Proxy to the marketing site's retest pipeline (GET /api/retests): every
// member with a kit, where they are in the 90-day cycle, whether the prompt
// email went out, whether they retested, and the provider's decision.
// Service key stays server-side.
export async function GET() {
  const base = (process.env.ONEORAL_MAIN_SITE_URL || 'http://localhost:3002').replace(/\/$/, '');
  const serviceKey = process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';
  try {
    const res = await fetch(`${base}/api/retests`, {
      headers: { 'x-api-key': serviceKey },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `main site responded ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `main site unreachable at ${base}` }, { status: 502 });
  }
}
