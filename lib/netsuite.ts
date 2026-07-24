/**
 * NetSuite REST API client — read-only helpers used by the admin to surface
 * shipments and tracking. Mirrors the OAuth1/TBA signing in the storefront's
 * own lib/netsuite.ts (the storefront writes sales orders; the admin only reads).
 */

import 'server-only';
import * as crypto from 'crypto';
import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FulfillmentInfo {
  fulfillmentId: string;
  status: 'shipped' | 'packed' | 'picked' | 'pending';
  trackingNumbers: string[];
  shipMethod?: string;
  shipDate?: string;
}

export interface SalesOrderShipment {
  salesOrderId: string;
  poNum: string;
  tranDate: string;
  status: string;
  itemId?: string;
  itemName?: string;
  fulfillments: FulfillmentInfo[];
}

export interface KitShipmentTotals {
  configured: boolean;
  hrkShipped: number;
  lrkShipped: number;
  totalShipped: number;
  shipmentCount: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface NetsuiteConfig {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  realm: string;
  baseUrl: string;
}

function tryGetConfig(): NetsuiteConfig | null {
  const accountId = process.env.NETSUITE_ACCOUNT_ID;
  const consumerKey = process.env.NETSUITE_CLIENT_ID;
  const consumerSecret = process.env.NETSUITE_CLIENT_SECRET;
  const tokenId = process.env.NETSUITE_TOKEN_ID;
  const tokenSecret = process.env.NETSUITE_TOKEN_SECRET;
  if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) return null;

  const isSandbox = process.env.NETSUITE_SANDBOX === 'true';
  // URL uses hyphen + lowercase: 724272-sb1
  const accountSlug = isSandbox ? `${accountId}-sb1` : accountId;
  // Realm uses underscore + uppercase: 724272_SB1
  const realm = isSandbox ? `${accountId}_SB1` : accountId;
  const baseUrl = `https://${accountSlug}.suitetalk.api.netsuite.com`;
  return { accountId, consumerKey, consumerSecret, tokenId, tokenSecret, realm, baseUrl };
}

export function isNetsuiteConfigured(): boolean {
  return tryGetConfig() !== null;
}

// ---------------------------------------------------------------------------
// OAuth 1.0a TBA signing
// ---------------------------------------------------------------------------

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildOAuthHeader(method: string, url: string, cfg: NetsuiteConfig): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: cfg.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: cfg.tokenId,
    oauth_version: '1.0',
  };

  const urlObj = new URL(url);
  const baseUrl = `${urlObj.origin}${urlObj.pathname}`;

  const allParams: Record<string, string> = { ...oauthParams };
  urlObj.searchParams.forEach((v, k) => {
    allParams[k] = v;
  });

  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&');

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(cfg.consumerSecret)}&${percentEncode(cfg.tokenSecret)}`;
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const paramParts = Object.keys(headerParams)
    .sort()
    .map((k) => `${k}="${percentEncode(headerParams[k])}"`)
    .join(',');

  return `OAuth realm="${cfg.realm}",${paramParts}`;
}

// ---------------------------------------------------------------------------
// Authenticated helpers
// ---------------------------------------------------------------------------

async function nsFetch(method: string, url: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cfg = tryGetConfig();
  if (!cfg) throw new Error('NetSuite not configured');
  const authHeader = buildOAuthHeader(method, url, cfg);
  const res = await fetch(url, {
    method,
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function suiteQL(query: string): Promise<{ items: Record<string, unknown>[] }> {
  const cfg = tryGetConfig();
  if (!cfg) throw new Error('NetSuite not configured');
  const url = `${cfg.baseUrl}/services/rest/query/v1/suiteql`;
  const authHeader = buildOAuthHeader('POST', url, cfg);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Prefer: 'transient',
    },
    body: JSON.stringify({ q: query }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SuiteQL query failed (${res.status}): ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Public read helpers
// ---------------------------------------------------------------------------

/**
 * Fetch fulfillment / tracking for a single sales order.
 * Mirrors the storefront's getOrderFulfillment() shape.
 */
export async function getOrderFulfillment(salesOrderId: string): Promise<FulfillmentInfo[]> {
  const cfg = tryGetConfig();
  if (!cfg) return [];

  // Find linked fulfillments via previousTransactionLineLink
  const linkResult = await suiteQL(
    `SELECT DISTINCT link.nextdoc AS fulfillment_id
     FROM previousTransactionLineLink link
     WHERE link.previousdoc = ${salesOrderId} AND link.nexttype = 'ItemShip'`
  );

  const fulfillments: FulfillmentInfo[] = [];
  for (const row of linkResult.items) {
    const ffId = String(row.fulfillment_id);
    const ffUrl = `${cfg.baseUrl}/services/rest/record/v1/itemFulfillment/${ffId}?expandSubResources=true`;
    const ffRes = await nsFetch('GET', ffUrl);
    if (!ffRes.ok) continue;
    const ff = ffRes.data as Record<string, unknown>;

    const shipStatusId = (ff.shipStatus as { id?: string })?.id;
    let status: FulfillmentInfo['status'] = 'pending';
    if (shipStatusId === 'C') status = 'shipped';
    else if (shipStatusId === 'B') status = 'packed';
    else if (shipStatusId === 'A') status = 'picked';

    const trackingNumbers: string[] = [];
    for (const key of ['package', 'shipmentPackage'] as const) {
      const packages = ff[key] as
        | { items?: { packageTrackingNumber?: string; trackingNumber?: string }[] }
        | undefined;
      if (packages?.items) {
        for (const pkg of packages.items) {
          const tracking = pkg.packageTrackingNumber || pkg.trackingNumber;
          if (tracking && !trackingNumbers.includes(tracking)) {
            trackingNumbers.push(tracking);
          }
        }
      }
    }

    fulfillments.push({
      fulfillmentId: ffId,
      status,
      trackingNumbers,
      shipMethod: (ff.shipMethod as { refName?: string })?.refName,
      shipDate: ff.tranDate as string | undefined,
    });
  }
  return fulfillments;
}

/**
 * Find sales orders for a list of stripe invoice ids by querying NetSuite for
 * the matching PO# (otherRefNum). The storefront webhook sets PO# = ORD-{invoiceId}.
 */
export async function getSalesOrdersByInvoiceIds(invoiceIds: string[]): Promise<SalesOrderShipment[]> {
  if (!isNetsuiteConfigured() || invoiceIds.length === 0) return [];
  const poList = invoiceIds.map((id) => `'ORD-${id}'`).join(',');

  // Pull sales orders + their first kit-line item, by PO#
  const result = await suiteQL(
    `SELECT
       t.id           AS sales_order_id,
       t.tranid       AS tran_id,
       t.otherRefNum  AS po_num,
       t.trandate     AS tran_date,
       BUILTIN.DF(t.status) AS status,
       (SELECT MIN(tl.item) FROM transactionLine tl WHERE tl.transaction = t.id AND tl.itemtype = 'InvtPart') AS item_id
     FROM transaction t
     WHERE t.type = 'SalesOrd'
       AND t.otherRefNum IN (${poList})`
  );

  const HRK = process.env.NETSUITE_ITEM_ID_HRK;
  const LRK = process.env.NETSUITE_ITEM_ID_LRK;

  const shipments: SalesOrderShipment[] = [];
  for (const row of result.items) {
    const salesOrderId = String(row.sales_order_id);
    const itemId = row.item_id != null ? String(row.item_id) : undefined;
    let itemName: string | undefined;
    if (itemId === HRK) itemName = 'HRK · Treatment Kit';
    else if (itemId === LRK) itemName = 'LRK · Maintenance Kit';

    const fulfillments = await getOrderFulfillment(salesOrderId);

    shipments.push({
      salesOrderId,
      poNum: String(row.po_num ?? ''),
      tranDate: String(row.tran_date ?? ''),
      status: String(row.status ?? ''),
      itemId,
      itemName,
      fulfillments,
    });
  }

  // Newest first
  shipments.sort((a, b) => (a.tranDate < b.tranDate ? 1 : -1));
  return shipments;
}

// Lazy Stripe client (only used for getMemberShipments)
let _stripe: Stripe | null = null;
function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY required for getMemberShipments');
  _stripe = new Stripe(key);
  return _stripe;
}

/**
 * Get all NetSuite shipments for a Stripe customer by walking their paid
 * invoices and looking up the matching sales orders by PO# (ORD-{invoiceId}).
 */
export async function getMemberShipments(stripeCustomerId: string): Promise<SalesOrderShipment[]> {
  if (!isNetsuiteConfigured()) return [];
  const invoiceIds: string[] = [];
  for await (const inv of stripeClient().invoices.list({
    customer: stripeCustomerId,
    status: 'paid',
    limit: 100,
  })) {
    if (inv.id) invoiceIds.push(inv.id);
  }
  if (invoiceIds.length === 0) return [];
  return getSalesOrdersByInvoiceIds(invoiceIds);
}

/**
 * Aggregate kit shipment totals across all OneOral sales orders.
 * Used by the Sales page CariFree card to replace the estimate with real data.
 * Only counts lines that have actually been fulfilled (item ship transactions).
 */
export async function getKitShipmentTotals(): Promise<KitShipmentTotals> {
  if (!isNetsuiteConfigured()) {
    return { configured: false, hrkShipped: 0, lrkShipped: 0, totalShipped: 0, shipmentCount: 0 };
  }
  const HRK = process.env.NETSUITE_ITEM_ID_HRK;
  const LRK = process.env.NETSUITE_ITEM_ID_LRK;
  const customer = process.env.NETSUITE_CUSTOMER_ID;
  if (!HRK || !LRK || !customer) {
    return { configured: false, hrkShipped: 0, lrkShipped: 0, totalShipped: 0, shipmentCount: 0 };
  }

  const result = await suiteQL(
    `SELECT
       SUM(CASE WHEN tl.item = ${HRK} THEN tl.quantity ELSE 0 END) AS hrk,
       SUM(CASE WHEN tl.item = ${LRK} THEN tl.quantity ELSE 0 END) AS lrk,
       COUNT(DISTINCT t.id) AS shipments
     FROM transaction t
     JOIN transactionLine tl ON tl.transaction = t.id
     WHERE tl.item IN (${HRK}, ${LRK})
       AND t.entity = ${customer}
       AND t.type = 'ItemShip'`
  );

  const row = result.items[0] || {};
  const hrkShipped = Number(row.hrk || 0);
  const lrkShipped = Number(row.lrk || 0);
  return {
    configured: true,
    hrkShipped,
    lrkShipped,
    totalShipped: hrkShipped + lrkShipped,
    shipmentCount: Number(row.shipments || 0),
  };
}
