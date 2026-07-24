import { NextResponse } from 'next/server';
import { getMemberShipments, isNetsuiteConfigured } from '@/lib/netsuite';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isNetsuiteConfigured()) {
    return NextResponse.json({ shipments: [], configured: false });
  }
  try {
    const shipments = await getMemberShipments(id);
    return NextResponse.json({ shipments, configured: true });
  } catch (err) {
    console.error('[shipments] failed:', err);
    return NextResponse.json(
      { error: (err as Error).message, shipments: [], configured: true },
      { status: 500 }
    );
  }
}
