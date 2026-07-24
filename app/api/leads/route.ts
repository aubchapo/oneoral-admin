import { NextResponse } from 'next/server';
import { dataSource } from '@/lib/data';

export async function GET() {
  const leads = await dataSource.getLeads();
  return NextResponse.json({ leads });
}
