import { NextResponse } from 'next/server';

// Proxy to the portal's Bio Test pipeline (app.oneoral.com). The queue itself
// lives next to the member data; this keeps the service key server-side.

const base = () => (process.env.ONEORAL_PORTAL_URL || 'https://app.oneoral.com').replace(/\/$/, '');
const key = () => process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';

export async function GET() {
  try {
    const res = await fetch(`${base()}/api/internal/bio-test`, {
      headers: { 'x-api-key': key() },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `portal responded ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: `portal unreachable at ${base()}` }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${base()}/api/internal/bio-test`, {
      method: 'POST',
      headers: { 'x-api-key': key(), 'content-type': 'application/json' },
      body,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: `portal unreachable at ${base()}` }, { status: 502 });
  }
}
