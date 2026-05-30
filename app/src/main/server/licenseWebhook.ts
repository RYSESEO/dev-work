import crypto from 'node:crypto';
import { signLicenseKey, type LicensePayload, type SignedLicenseTier } from '../services/licenseSigning.js';

/**
 * Self-hosted license-signing webhook (checkout option 2).
 *
 * A checkout provider (Lemon Squeezy by default) fires a webhook on a completed
 * purchase. This module verifies that webhook came from the provider, maps the
 * purchased product/variant to a license tier, and mints a cryptographically
 * signed key with {@link signLicenseKey} — the *same* signer the desktop app
 * verifies against, so issued keys are format-compatible by construction.
 *
 * The Ed25519 private key only ever lives in this function's environment /
 * secret store. It is never shipped in the app or committed to the repo.
 */

/** Minimal shape of a Lemon Squeezy webhook order item we rely on. */
export interface LemonSqueezyOrderItem {
  product_id?: number;
  variant_id?: number;
  product_name?: string;
  variant_name?: string;
}

/** Minimal shape of a Lemon Squeezy webhook event. */
export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, unknown>;
  };
  data: {
    id?: string;
    type?: string;
    attributes: {
      user_email?: string;
      user_name?: string;
      first_order_item?: LemonSqueezyOrderItem;
      product_id?: number;
      variant_id?: number;
    };
  };
}

/** Maps a provider's product/variant identifiers to a license tier. */
export interface TierMapping {
  proVariantIds?: number[];
  teamVariantIds?: number[];
  proProductIds?: number[];
  teamProductIds?: number[];
}

export interface IssueOptions {
  /** PKCS#8 PEM Ed25519 private key. Keep secret. */
  privateKeyPem: string;
  mapping: TierMapping;
  /**
   * How many calendar years the license is valid for. The resulting key
   * expires Dec 31 of `currentYear + durationYears`. Defaults to 1.
   */
  durationYears?: number;
  /** Bind the key to the buyer's email (recommended). Defaults to true. */
  bindEmail?: boolean;
  /** Injectable clock for deterministic tests. */
  now?: Date;
}

export interface IssuedLicense {
  key: string;
  email: string;
  tier: SignedLicenseTier;
  payload: LicensePayload;
}

/**
 * Verifies a Lemon Squeezy webhook signature.
 *
 * Lemon Squeezy signs the raw request body with HMAC-SHA256 using your webhook
 * signing secret and sends the hex digest in the `X-Signature` header. The
 * comparison is constant-time to avoid timing attacks.
 */
export function verifyLemonSqueezySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(signatureHeader.trim(), 'hex');
  } catch {
    return false;
  }
  if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function isWebhookEvent(value: unknown): value is LemonSqueezyWebhookEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const meta = v.meta as Record<string, unknown> | undefined;
  const data = v.data as Record<string, unknown> | undefined;
  return (
    typeof meta === 'object' &&
    meta !== null &&
    typeof meta.event_name === 'string' &&
    typeof data === 'object' &&
    data !== null &&
    typeof data.attributes === 'object' &&
    data.attributes !== null
  );
}

/** Parses a raw JSON body into a typed webhook event, or null if malformed. */
export function parseWebhookEvent(rawBody: string): LemonSqueezyWebhookEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  return isWebhookEvent(parsed) ? parsed : null;
}

/** Resolves the buyer's email from the event, or null if absent. */
export function extractEmail(event: LemonSqueezyWebhookEvent): string | null {
  const email = event.data.attributes.user_email;
  return typeof email === 'string' && email.includes('@') ? email.trim() : null;
}

/** Maps the purchased product/variant to a tier, or null if it matches none. */
export function resolveTier(event: LemonSqueezyWebhookEvent, mapping: TierMapping): SignedLicenseTier | null {
  const item = event.data.attributes.first_order_item;
  const variantId = item?.variant_id ?? event.data.attributes.variant_id;
  const productId = item?.product_id ?? event.data.attributes.product_id;

  const inList = (list: number[] | undefined, id: number | undefined): boolean =>
    typeof id === 'number' && Array.isArray(list) && list.includes(id);

  // Team takes precedence over Pro if (mis)configured to overlap.
  if (inList(mapping.teamVariantIds, variantId) || inList(mapping.teamProductIds, productId)) {
    return 'team';
  }
  if (inList(mapping.proVariantIds, variantId) || inList(mapping.proProductIds, productId)) {
    return 'pro';
  }
  return null;
}

/** Calendar year the license should be valid through (expires Dec 31). */
export function computeExpiryYear(now: Date, durationYears = 1): number {
  return now.getFullYear() + Math.max(1, Math.trunc(durationYears));
}

/**
 * Mints a signed license key for a verified purchase event, or null if the
 * event does not map to a sellable tier or has no buyer email.
 */
export function issueSignedKeyForEvent(event: LemonSqueezyWebhookEvent, opts: IssueOptions): IssuedLicense | null {
  const tier = resolveTier(event, opts.mapping);
  if (!tier) return null;
  const email = extractEmail(event);
  if (!email) return null;

  const payload: LicensePayload = {
    v: 1,
    tier,
    expiryYear: computeExpiryYear(opts.now ?? new Date(), opts.durationYears ?? 1),
    serial: crypto.randomBytes(6).toString('hex').toUpperCase(),
    ...(opts.bindEmail === false ? {} : { email })
  };

  const key = signLicenseKey(payload, opts.privateKeyPem);
  return { key, email, tier, payload };
}
