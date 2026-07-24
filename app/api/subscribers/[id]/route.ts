import { NextResponse } from 'next/server';
import { dataSource } from '@/lib/data';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subscriber = await dataSource.getSubscriberById(id);
  if (!subscriber) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ subscriber });
}
