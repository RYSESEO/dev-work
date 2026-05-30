import fs from 'node:fs';
import { makeResendSender } from './email.js';
import type { WebhookEnv } from './licenseWebhookHandler.js';
import type { TierMapping } from './licenseWebhook.js';

export class WebhookConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookConfigError';
  }
}

function readPrivateKey(env: NodeJS.ProcessEnv): string {
  const inline = env.DEVWORK_LICENSE_PRIVATE_KEY;
  const file = env.DEVWORK_LICENSE_PRIVATE_KEY_FILE;
  if (inline && inline.trim().length > 0) {
    // Allow "\n" escapes so the key can be stored as a single-line secret.
    return inline.includes('\\n') ? inline.replace(/\\n/g, '\n') : inline;
  }
  if (file && file.trim().length > 0) {
    return fs.readFileSync(file, 'utf8');
  }
  throw new WebhookConfigError(
    'Missing private key: set DEVWORK_LICENSE_PRIVATE_KEY (PEM) or DEVWORK_LICENSE_PRIVATE_KEY_FILE (path).'
  );
}

function parseMapping(raw: string | undefined): TierMapping {
  if (!raw || raw.trim().length === 0) {
    throw new WebhookConfigError('Missing LICENSE_TIER_MAPPING: JSON like {"proVariantIds":[1],"teamVariantIds":[2]}.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new WebhookConfigError('LICENSE_TIER_MAPPING is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new WebhookConfigError('LICENSE_TIER_MAPPING must be a JSON object.');
  }
  const m = parsed as TierMapping;
  const hasAny =
    (m.proVariantIds?.length ?? 0) +
      (m.teamVariantIds?.length ?? 0) +
      (m.proProductIds?.length ?? 0) +
      (m.teamProductIds?.length ?? 0) >
    0;
  if (!hasAny) {
    throw new WebhookConfigError('LICENSE_TIER_MAPPING must list at least one product or variant id for a tier.');
  }
  return m;
}

/**
 * Builds {@link WebhookEnv} from process environment variables.
 *
 * Required:
 *  - LEMON_SQUEEZY_WEBHOOK_SECRET
 *  - DEVWORK_LICENSE_PRIVATE_KEY (or DEVWORK_LICENSE_PRIVATE_KEY_FILE)
 *  - LICENSE_TIER_MAPPING (JSON)
 *
 * Optional:
 *  - LICENSE_DURATION_YEARS (default 1)
 *  - LICENSE_BIND_EMAIL ("false" to disable email binding)
 *  - RESEND_API_KEY + LICENSE_EMAIL_FROM (enable email delivery)
 *  - LICENSE_EMAIL_SUBJECT, LICENSE_PRODUCT_NAME
 *  - LICENSE_ACCEPTED_EVENTS (comma-separated; default "order_created")
 */
export function loadWebhookEnv(env: NodeJS.ProcessEnv = process.env): WebhookEnv {
  const signingSecret = env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!signingSecret || signingSecret.trim().length === 0) {
    throw new WebhookConfigError('Missing LEMON_SQUEEZY_WEBHOOK_SECRET.');
  }

  const privateKeyPem = readPrivateKey(env);
  const mapping = parseMapping(env.LICENSE_TIER_MAPPING);

  const durationYears = env.LICENSE_DURATION_YEARS ? Number.parseInt(env.LICENSE_DURATION_YEARS, 10) : 1;
  if (!Number.isInteger(durationYears) || durationYears < 1) {
    throw new WebhookConfigError('LICENSE_DURATION_YEARS must be a positive integer.');
  }

  const bindEmail = env.LICENSE_BIND_EMAIL !== 'false';

  const acceptedEvents = env.LICENSE_ACCEPTED_EVENTS
    ? env.LICENSE_ACCEPTED_EVENTS.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const result: WebhookEnv = {
    signingSecret,
    privateKeyPem,
    mapping,
    durationYears,
    bindEmail,
    acceptedEvents
  };

  if (env.RESEND_API_KEY && env.LICENSE_EMAIL_FROM) {
    result.sendEmail = makeResendSender({
      apiKey: env.RESEND_API_KEY,
      from: env.LICENSE_EMAIL_FROM,
      subject: env.LICENSE_EMAIL_SUBJECT,
      productName: env.LICENSE_PRODUCT_NAME
    });
  }

  return result;
}
