#!/usr/bin/env node

/**
 * License key issuer for dev-work.
 *
 * Signed keys use Ed25519: the app ships with the PUBLIC key embedded
 * (app/src/main/services/license.ts -> DEFAULT_LICENSE_PUBLIC_KEY) and verifies
 * keys offline. Only this issuer needs the PRIVATE key, which must be kept
 * secret and NEVER committed.
 *
 * Generate a keypair (run once, embed the public key, store the private key):
 *   node scripts/license-keygen.mjs genkey
 *
 * Sign a license key (private key via DEVWORK_LICENSE_PRIVATE_KEY env, or --key <file>):
 *   node scripts/license-keygen.mjs sign --tier pro --year 2027
 *   node scripts/license-keygen.mjs sign --tier team --year 2027 --email user@acme.com --key ./private.pem
 *
 * Verify a key against a public key (--pub <file>, or paste PEM via DEVWORK_LICENSE_PUBLIC_KEY):
 *   node scripts/license-keygen.mjs verify DEVWORK.<payload>.<sig> --pub ./public.pem
 */

import crypto from 'node:crypto';
import fs from 'node:fs';

const SIGNED_LICENSE_PREFIX = 'DEVWORK';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function readPrivateKey(args) {
  if (args.key) return fs.readFileSync(args.key, 'utf8');
  if (process.env.DEVWORK_LICENSE_PRIVATE_KEY) return process.env.DEVWORK_LICENSE_PRIVATE_KEY;
  console.error('No private key. Pass --key <file> or set DEVWORK_LICENSE_PRIVATE_KEY.');
  process.exit(1);
}

function readPublicKey(args) {
  if (args.pub) return fs.readFileSync(args.pub, 'utf8');
  if (process.env.DEVWORK_LICENSE_PUBLIC_KEY) return process.env.DEVWORK_LICENSE_PUBLIC_KEY;
  console.error('No public key. Pass --pub <file> or set DEVWORK_LICENSE_PUBLIC_KEY.');
  process.exit(1);
}

function signLicenseKey(payload, privateKeyPem) {
  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.sign(null, payloadBytes, crypto.createPrivateKey(privateKeyPem));
  return [SIGNED_LICENSE_PREFIX, payloadBytes.toString('base64url'), signature.toString('base64url')].join('.');
}

function verifyLicenseKey(key, publicKeyPem) {
  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== SIGNED_LICENSE_PREFIX) return null;
  const payloadBytes = Buffer.from(parts[1], 'base64url');
  const signature = Buffer.from(parts[2], 'base64url');
  const valid = crypto.verify(null, payloadBytes, crypto.createPublicKey(publicKeyPem), signature);
  if (!valid) return null;
  return JSON.parse(payloadBytes.toString('utf8'));
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];

switch (command) {
  case 'genkey': {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    console.log('# PUBLIC KEY — embed in app (DEFAULT_LICENSE_PUBLIC_KEY):');
    process.stdout.write(pub);
    console.log('\n# PRIVATE KEY — keep secret, never commit:');
    process.stdout.write(priv);
    break;
  }
  case 'sign': {
    const tier = args.tier;
    const year = args.year ? parseInt(args.year, 10) : NaN;
    if (tier !== 'pro' && tier !== 'team') {
      console.error('--tier must be "pro" or "team".');
      process.exit(1);
    }
    if (!Number.isInteger(year) || year < 2024) {
      console.error('--year must be a valid year (>= 2024).');
      process.exit(1);
    }
    const payload = {
      v: 1,
      tier,
      expiryYear: year,
      serial: crypto.randomBytes(6).toString('hex').toUpperCase()
    };
    if (args.email) payload.email = String(args.email).trim();
    const key = signLicenseKey(payload, readPrivateKey(args));
    console.log(key);
    break;
  }
  case 'verify': {
    const key = args._[1];
    if (!key) {
      console.error('Usage: verify <key> --pub <file>');
      process.exit(1);
    }
    const payload = verifyLicenseKey(key, readPublicKey(args));
    if (!payload) {
      console.error('INVALID: signature does not verify.');
      process.exit(1);
    }
    console.log('VALID');
    console.log(JSON.stringify(payload, null, 2));
    break;
  }
  default:
    console.error('Usage: license-keygen.mjs <genkey|sign|verify> [options]');
    console.error('Run with no command for full help in the file header.');
    process.exit(1);
}
