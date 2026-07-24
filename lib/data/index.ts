// =============================================================================
// Data source resolver. Picks an adapter based on ONEORAL_DATA_SOURCE.
//
// Modes:
//   - mock   (default) → lib/data/mock.ts
//   - stripe          → lib/data/stripe.ts (real Stripe account)
//   - live            → lib/data/live.ts (placeholder for a custom backend)
//
// IMPORTANT: only import this from server-side code (route handlers, RSCs).
// =============================================================================

import 'server-only';
import { mockSource } from './mock';
import { stripeSource } from './stripe';
import { liveSource } from './live';
import type { DataSource } from './source';

const mode = (process.env.ONEORAL_DATA_SOURCE ?? 'mock').toLowerCase();

function pick(): { source: DataSource; mode: 'mock' | 'stripe' | 'live' } {
  if (mode === 'stripe') return { source: stripeSource, mode: 'stripe' };
  if (mode === 'live') return { source: liveSource, mode: 'live' };
  return { source: mockSource, mode: 'mock' };
}

const resolved = pick();
export const dataSource: DataSource = resolved.source;
export const dataSourceMode = resolved.mode;
