import crypto from 'node:crypto';
import type { LicenseTier } from '../../shared/domain.js';

/**
 * Cryptographically signed license keys.
 *
 * A signed key has the shape `DEVWORK.<payload>.<signature>` where both
 * segments are base64url-encoded. The payload is the UTF-8 JSON of a
 * {@link LicensePayload}; the signature is an Ed25519 signature over those
 * exact payload bytes. Verification only needs the embedded public key, so
 * keys cannot be forged or altered without the (offline) private key.
 *
 * This distinguishes cleanly from legacy checksum keys (`DEVWORK-...`) by the
 * `.` separator, so both formats can be accepted during the transition.
 */

export const SIGNED_LICENSE_PREFIX = 'DEVWORK';

export type SignedLicenseTier = Exclude<LicenseTier, 'free'>;

export interface LicensePayload {
  /** Payload schema version. */
  v: number;
  tier: SignedLicenseTier;
  /** Calendar year the license is valid through (expires Dec 31). */
  expiryYear: number;
  /** Random per-key serial, for revocation/audit. */
  serial: string;
  /** Optional email the key is issued to; activation must match if present. */
  email?: string;
}

export interface LicenseKeypair {
  /** SPKI PEM — safe to embed in the shipped app. */
  publicKey: string;
  /** PKCS#8 PEM — keep secret; only the issuer needs it. */
  privateKey: string;
}

export function generateLicenseKeypair(): LicenseKeypair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  };
}

export function isSignedLicenseKey(key: string): boolean {
  const parts = key.trim().split('.');
  return parts.length === 3 && parts[0] === SIGNED_LICENSE_PREFIX;
}

export function signLicenseKey(payload: LicensePayload, privateKeyPem: string): string {
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, payloadBytes, crypto.createPrivateKey(privateKeyPem));
  return [
    SIGNED_LICENSE_PREFIX,
    payloadBytes.toString('base64url'),
    signature.toString('base64url')
  ].join('.');
}

/**
 * Verifies the signature and returns the decoded payload, or `null` if the key
 * is malformed, tampered with, or signed by a different key.
 */
export function verifyLicenseKey(key: string, publicKeyPem: string): LicensePayload | null {
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== SIGNED_LICENSE_PREFIX) return null;

  let payloadBytes: Buffer;
  let signature: Buffer;
  try {
    payloadBytes = Buffer.from(parts[1], 'base64url');
    signature = Buffer.from(parts[2], 'base64url');
  } catch {
    return null;
  }

  let valid = false;
  try {
    valid = crypto.verify(null, payloadBytes, crypto.createPublicKey(publicKeyPem), signature);
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadBytes.toString('utf8')) as LicensePayload;
  } catch {
    return null;
  }

  if (payload.v !== 1) return null;
  if (payload.tier !== 'pro' && payload.tier !== 'team') return null;
  if (typeof payload.expiryYear !== 'number' || !Number.isInteger(payload.expiryYear)) return null;
  if (typeof payload.serial !== 'string' || payload.serial.length === 0) return null;

  return payload;
}
