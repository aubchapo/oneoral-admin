import { NextResponse } from 'next/server';
import { dataSource } from '@/lib/data';
import type { LeadStatus } from '@/lib/data/types';

const VALID: LeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'lost'];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status as LeadStatus | undefined;
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const lead = await dataSource.updateLeadStatus(id, status);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ lead });
}
