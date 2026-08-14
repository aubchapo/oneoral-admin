import { NextResponse } from 'next/server';

// Hand a lab report PDF downloaded from the lab portal to the ingest pipeline.
// Same parse/match/publish path an emailed result takes — this is just the
// manual door into it.

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const base = (process.env.ONEORAL_PORTAL_URL || 'https://app.oneoral.com').replace(/\/$/, '');
  const key = process.env.ONEORAL_SERVICE_API_KEY || 'oneoral_service_key_dev_2024';

  const inbound = await req.formData();
  const file = inbound.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a PDF to upload' }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.set('file', file, file.name);
  outbound.set('source', 'upload');

  try {
    const res = await fetch(`${base}/api/lab/ingest`, {
      method: 'POST',
      headers: { 'x-api-key': key },
      body: outbound,
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: `portal unreachable at ${base}` }, { status: 502 });
  }
}
