import { NextResponse } from 'next/server';
import { dataSource } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
  const result = await dataSource.getSubscribers(page, pageSize);
  return NextResponse.json(result);
}
