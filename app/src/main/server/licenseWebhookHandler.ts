import type { LicenseEmailSender } from './email.js';
import {
  issueSignedKeyForEvent,
  parseWebhookEvent,
  verifyLemonSqueezySignature,
  type TierMapping
} from './licenseWebhook.js';

export interface WebhookEnv {
  /** Lemon Squeezy webhook signing secret (HMAC). */
  signingSecret: string;
  /** PKCS#8 PEM Ed25519 private key. */
  privateKeyPem: string;
  mapping: TierMapping;
  durationYears?: number;
  bindEmail?: boolean;
  /** Provider event names that should mint a key. Defaults to ['order_created']. */
  acceptedEvents?: string[];
  /** Optional delivery (e.g. Resend). When omitted, the key is returned in the response. */
  sendEmail?: LicenseEmailSender;
  /** Injectable clock for tests. */
  now?: Date;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Handles a raw Lemon Squeezy webhook request end-to-end:
 * verify signature → parse → filter event → mint signed key → deliver.
 *
 * Returns a status + JSON body suitable for any HTTP runtime (Node http,
 * Vercel, Lambda, Cloudflare). The signed key is only included in the response
 * body when no email sender is configured, to avoid leaking keys into logs.
 */
export async function handleLemonSqueezyWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
  env: WebhookEnv
): Promise<WebhookResult> {
  if (!verifyLemonSqueezySignature(rawBody, signatureHeader, env.signingSecret)) {
    return { status: 401, body: { error: 'invalid signature' } };
  }

  const event = parseWebhookEvent(rawBody);
  if (!event) {
    return { status: 400, body: { error: 'invalid payload' } };
  }

  const accepted = env.acceptedEvents ?? ['order_created'];
  if (!accepted.includes(event.meta.event_name)) {
    return { status: 200, body: { ignored: true, event: event.meta.event_name } };
  }

  const issued = issueSignedKeyForEvent(event, {
    privateKeyPem: env.privateKeyPem,
    mapping: env.mapping,
    durationYears: env.durationYears,
    bindEmail: env.bindEmail,
    now: env.now
  });
  if (!issued) {
    return { status: 422, body: { error: 'purchase does not map to a sellable tier or has no email' } };
  }

  if (env.sendEmail) {
    try {
      await env.sendEmail(issued);
    } catch (err) {
      return {
        status: 502,
        body: { error: 'failed to deliver license email', detail: (err as Error).message }
      };
    }
    return { status: 200, body: { issued: true, tier: issued.tier, email: issued.email, delivered: true } };
  }

  // No email configured: caller is responsible for delivery, so return the key.
  return {
    status: 200,
    body: { issued: true, tier: issued.tier, email: issued.email, delivered: false, key: issued.key }
  };
}
