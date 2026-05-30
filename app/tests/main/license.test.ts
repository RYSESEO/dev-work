import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createLicenseService, generateLicenseKey } from '../../src/main/services/license.js';
import {
  generateLicenseKeypair,
  isSignedLicenseKey,
  signLicenseKey,
  verifyLicenseKey,
  type LicensePayload
} from '../../src/main/services/licenseSigning.js';

const nextYear = new Date().getFullYear() + 1;

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  return { v: 1, tier: 'pro', expiryYear: nextYear, serial: 'ABCDEF', ...overrides };
}

describe('license signing', () => {
  it('signs and verifies a key roundtrip', () => {
    const { publicKey, privateKey } = generateLicenseKeypair();
    const payload = makePayload();
    const key = signLicenseKey(payload, privateKey);

    expect(isSignedLicenseKey(key)).toBe(true);
    expect(key.startsWith('DEVWORK.')).toBe(true);
    expect(verifyLicenseKey(key, publicKey)).toEqual(payload);
  });

  it('rejects a key signed by a different private key', () => {
    const a = generateLicenseKeypair();
    const b = generateLicenseKeypair();
    const key = signLicenseKey(makePayload(), a.privateKey);
    expect(verifyLicenseKey(key, b.publicKey)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const { publicKey, privateKey } = generateLicenseKeypair();
    const key = signLicenseKey(makePayload({ tier: 'pro' }), privateKey);
    const [prefix, , sig] = key.split('.');
    const forgedPayload = Buffer.from(JSON.stringify(makePayload({ tier: 'team' })), 'utf8').toString('base64url');
    const tampered = [prefix, forgedPayload, sig].join('.');
    expect(verifyLicenseKey(tampered, publicKey)).toBeNull();
  });

  it('rejects malformed keys', () => {
    const { publicKey } = generateLicenseKeypair();
    expect(verifyLicenseKey('DEVWORK-PRO-2027-ABCD-1234', publicKey)).toBeNull();
    expect(verifyLicenseKey('not-a-key', publicKey)).toBeNull();
    expect(verifyLicenseKey('DEVWORK..', publicKey)).toBeNull();
  });

  it('isSignedLicenseKey distinguishes signed from legacy keys', () => {
    expect(isSignedLicenseKey('DEVWORK.aaa.bbb')).toBe(true);
    expect(isSignedLicenseKey(generateLicenseKey('pro', nextYear))).toBe(false);
  });
});

describe('license service — signed keys', () => {
  it('activates a valid signed key', async () => {
    const store = await createAppStore(':memory:');
    const { publicKey, privateKey } = generateLicenseKeypair();
    const svc = createLicenseService(store, { publicKey });

    const key = signLicenseKey(makePayload({ tier: 'team' }), privateKey);
    const license = svc.activate(key, 'buyer@acme.com');

    expect(license.tier).toBe('team');
    expect(license.key).toBe(key);
    expect(svc.getTier()).toBe('team');
    expect(svc.checkFeature('cloud_sync')).toBe(true);
  });

  it('rejects a forged/tampered signed key', async () => {
    const store = await createAppStore(':memory:');
    const issuer = generateLicenseKeypair();
    const attacker = generateLicenseKeypair();
    const svc = createLicenseService(store, { publicKey: issuer.publicKey });

    const forged = signLicenseKey(makePayload({ tier: 'team' }), attacker.privateKey);
    expect(() => svc.activate(forged, 'x@y.com')).toThrow(/Invalid or tampered/);
    expect(svc.getTier()).toBe('free');
  });

  it('enforces email binding when present', async () => {
    const store = await createAppStore(':memory:');
    const { publicKey, privateKey } = generateLicenseKeypair();
    const svc = createLicenseService(store, { publicKey });

    const key = signLicenseKey(makePayload({ email: 'owner@acme.com' }), privateKey);
    expect(() => svc.activate(key, 'someone@else.com')).toThrow(/different email/);

    const license = svc.activate(key, 'OWNER@acme.com');
    expect(license.email).toBe('owner@acme.com');
  });

  it('rejects an expired signed key', async () => {
    const store = await createAppStore(':memory:');
    const { publicKey, privateKey } = generateLicenseKeypair();
    const svc = createLicenseService(store, { publicKey });

    const key = signLicenseKey(makePayload({ expiryYear: 2024 }), privateKey);
    expect(() => svc.activate(key, 'x@y.com')).toThrow(/expired/);
  });
});

describe('license service — legacy keys (backward compatible)', () => {
  it('still activates legacy checksum keys', async () => {
    const store = await createAppStore(':memory:');
    const svc = createLicenseService(store);

    const key = generateLicenseKey('pro', nextYear);
    const license = svc.activate(key, 'legacy@acme.com');

    expect(license.tier).toBe('pro');
    expect(license.key).toBe(key.toUpperCase());
    expect(svc.getTier()).toBe('pro');
  });

  it('rejects an invalid legacy key', async () => {
    const store = await createAppStore(':memory:');
    const svc = createLicenseService(store);
    expect(() => svc.activate('DEVWORK-PRO-2027-ABCD-BADCSUM1', 'x@y.com')).toThrow(/Invalid license key/);
  });
});
