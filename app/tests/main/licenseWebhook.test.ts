import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebhookServer } from '../../src/main/server/server.js';
import { generateLicenseKeypair, verifyLicenseKey } from '../../src/main/services/licenseSigning.js';
import {
  computeExpiryYear,
  extractEmail,
  issueSignedKeyForEvent,
  parseWebhookEvent,
  resolveTier,
  verifyLemonSqueezySignature,
  type LemonSqueezyWebhookEvent,
  type TierMapping
} from '../../src/main/server/licenseWebhook.js';
import { handleLemonSqueezyWebhook, type WebhookEnv } from '../../src/main/server/licenseWebhookHandler.js';

const SECRET = 'whsec_test_secret';
const MAPPING: TierMapping = { proVariantIds: [101], teamVariantIds: [202], teamProductIds: [9] };

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function makeEvent(overrides: Partial<LemonSqueezyWebhookEvent['data']['attributes']> = {}): LemonSqueezyWebhookEvent {
  return {
    meta: { event_name: 'order_created' },
    data: {
      id: '1',
      type: 'orders',
      attributes: {
        user_email: 'buyer@acme.com',
        first_order_item: { product_id: 1, variant_id: 202, product_name: 'dev-work Team' },
        ...overrides
      }
    }
  };
}

describe('verifyLemonSqueezySignature', () => {
  it('accepts a correctly signed body', () => {
    const body = JSON.stringify(makeEvent());
    expect(verifyLemonSqueezySignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = JSON.stringify(makeEvent());
    const signature = sign(body);
    const tampered = body.replace('buyer@acme.com', 'attacker@evil.com');
    expect(verifyLemonSqueezySignature(tampered, signature, SECRET)).toBe(false);
  });

  it('rejects a wrong secret, missing header, and non-hex signature', () => {
    const body = JSON.stringify(makeEvent());
    expect(verifyLemonSqueezySignature(body, sign(body, 'other'), SECRET)).toBe(false);
    expect(verifyLemonSqueezySignature(body, undefined, SECRET)).toBe(false);
    expect(verifyLemonSqueezySignature(body, 'not-hex!!', SECRET)).toBe(false);
  });
});

describe('parse / extract / resolve helpers', () => {
  it('parses a valid event and rejects malformed ones', () => {
    expect(parseWebhookEvent(JSON.stringify(makeEvent()))).not.toBeNull();
    expect(parseWebhookEvent('not json')).toBeNull();
    expect(parseWebhookEvent(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });

  it('extracts a buyer email', () => {
    expect(extractEmail(makeEvent())).toBe('buyer@acme.com');
    expect(extractEmail(makeEvent({ user_email: undefined }))).toBeNull();
  });

  it('maps variant and product ids to tiers with team precedence', () => {
    expect(resolveTier(makeEvent({ first_order_item: { variant_id: 202 } }), MAPPING)).toBe('team');
    expect(resolveTier(makeEvent({ first_order_item: { variant_id: 101 } }), MAPPING)).toBe('pro');
    expect(resolveTier(makeEvent({ first_order_item: { product_id: 9 } }), MAPPING)).toBe('team');
    expect(resolveTier(makeEvent({ first_order_item: { variant_id: 999 } }), MAPPING)).toBeNull();
  });

  it('computes an expiry year at least a full year out', () => {
    const now = new Date('2026-05-20T00:00:00Z');
    expect(computeExpiryYear(now, 1)).toBe(2027);
    expect(computeExpiryYear(now, 2)).toBe(2028);
  });
});

describe('issueSignedKeyForEvent', () => {
  it('mints a key that the app verifier accepts (format-compatible)', () => {
    const { publicKey, privateKey } = generateLicenseKeypair();
    const now = new Date('2026-05-20T00:00:00Z');
    const issued = issueSignedKeyForEvent(makeEvent(), { privateKeyPem: privateKey, mapping: MAPPING, now });
    expect(issued).not.toBeNull();
    const payload = verifyLicenseKey(issued!.key, publicKey);
    expect(payload).not.toBeNull();
    expect(payload!.tier).toBe('team');
    expect(payload!.email).toBe('buyer@acme.com');
    expect(payload!.expiryYear).toBe(2027);
    expect(issued!.payload.serial).toMatch(/^[0-9A-F]{12}$/);
  });

  it('omits email binding when bindEmail is false', () => {
    const { publicKey, privateKey } = generateLicenseKeypair();
    const issued = issueSignedKeyForEvent(makeEvent(), {
      privateKeyPem: privateKey,
      mapping: MAPPING,
      bindEmail: false
    });
    expect(verifyLicenseKey(issued!.key, publicKey)!.email).toBeUndefined();
  });

  it('returns null when the purchase maps to no tier or has no email', () => {
    const { privateKey } = generateLicenseKeypair();
    expect(
      issueSignedKeyForEvent(makeEvent({ first_order_item: { variant_id: 999 } }), {
        privateKeyPem: privateKey,
        mapping: MAPPING
      })
    ).toBeNull();
    expect(
      issueSignedKeyForEvent(makeEvent({ user_email: undefined }), {
        privateKeyPem: privateKey,
        mapping: MAPPING
      })
    ).toBeNull();
  });
});

describe('handleLemonSqueezyWebhook', () => {
  function baseEnv(overrides: Partial<WebhookEnv> = {}): WebhookEnv {
    const { privateKey } = generateLicenseKeypair();
    return { signingSecret: SECRET, privateKeyPem: privateKey, mapping: MAPPING, ...overrides };
  }

  it('rejects an invalid signature with 401', async () => {
    const body = JSON.stringify(makeEvent());
    const res = await handleLemonSqueezyWebhook(body, 'deadbeef', baseEnv());
    expect(res.status).toBe(401);
  });

  it('returns 400 for a valid signature over a non-event body', async () => {
    const body = 'not json';
    const res = await handleLemonSqueezyWebhook(body, sign(body), baseEnv());
    expect(res.status).toBe(400);
  });

  it('ignores events that are not in the accepted list', async () => {
    const body = JSON.stringify(makeEvent({}));
    const event = JSON.parse(body) as LemonSqueezyWebhookEvent;
    event.meta.event_name = 'subscription_updated';
    const raw = JSON.stringify(event);
    const res = await handleLemonSqueezyWebhook(raw, sign(raw), baseEnv());
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
  });

  it('returns 422 when the purchase maps to no tier', async () => {
    const raw = JSON.stringify(makeEvent({ first_order_item: { variant_id: 999 } }));
    const res = await handleLemonSqueezyWebhook(raw, sign(raw), baseEnv());
    expect(res.status).toBe(422);
  });

  it('mints and returns the key when no email sender is configured', async () => {
    const { publicKey, privateKey } = generateLicenseKeypair();
    const raw = JSON.stringify(makeEvent());
    const res = await handleLemonSqueezyWebhook(raw, sign(raw), baseEnv({ privateKeyPem: privateKey }));
    expect(res.status).toBe(200);
    expect(res.body.issued).toBe(true);
    expect(res.body.delivered).toBe(false);
    expect(verifyLicenseKey(res.body.key as string, publicKey)!.tier).toBe('team');
  });

  it('delivers via the email sender and does not leak the key in the body', async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const raw = JSON.stringify(makeEvent());
    const res = await handleLemonSqueezyWebhook(raw, sign(raw), baseEnv({ sendEmail }));
    expect(res.status).toBe(200);
    expect(res.body.delivered).toBe(true);
    expect(res.body.key).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect((sendEmail.mock.calls[0][0] as { email: string }).email).toBe('buyer@acme.com');
  });

  it('returns 502 when email delivery fails', async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error('smtp down'));
    const raw = JSON.stringify(makeEvent());
    const res = await handleLemonSqueezyWebhook(raw, sign(raw), baseEnv({ sendEmail }));
    expect(res.status).toBe(502);
  });
});

describe('createWebhookServer (HTTP integration)', () => {
  let server: ReturnType<typeof createWebhookServer> | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  async function start(env: WebhookEnv): Promise<string> {
    server = createWebhookServer(env);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  it('serves /health', async () => {
    const { privateKey } = generateLicenseKeypair();
    const base = await start({ signingSecret: SECRET, privateKeyPem: privateKey, mapping: MAPPING });
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('mints a valid key over a signed POST and rejects a bad signature', async () => {
    const { publicKey, privateKey } = generateLicenseKeypair();
    const base = await start({ signingSecret: SECRET, privateKeyPem: privateKey, mapping: MAPPING });
    const raw = JSON.stringify(makeEvent());

    const ok = await fetch(`${base}/webhooks/lemonsqueezy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': sign(raw) },
      body: raw
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { key: string };
    expect(verifyLicenseKey(body.key, publicKey)!.tier).toBe('team');

    const bad = await fetch(`${base}/webhooks/lemonsqueezy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': 'deadbeef' },
      body: raw
    });
    expect(bad.status).toBe(401);
  });
});
