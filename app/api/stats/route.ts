import { NextResponse } from 'next/server';
import { dataSource } from '@/lib/data';
import { enrichStats } from '@/lib/data/source';
import { getKitShipmentTotals, isNetsuiteConfigured } from '@/lib/netsuite';

export async function GET() {
  const raw = await dataSource.getRawStats();
  const stats = enrichStats(raw);

  // Layer in real NetSuite shipment totals when configured
  if (isNetsuiteConfigured()) {
    try {
      const ns = await getKitShipmentTotals();
      if (ns.configured) {
        stats.netsuiteKits = {
          hrkShipped: ns.hrkShipped,
          lrkShipped: ns.lrkShipped,
          totalShipped: ns.totalShipped,
          shipmentCount: ns.shipmentCount,
        };
      }
    } catch (err) {
      console.error('[stats] NetSuite kit totals failed:', err);
    }
  }

  return NextResponse.json(stats);
}
