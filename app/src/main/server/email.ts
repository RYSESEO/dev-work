import type { IssuedLicense } from './licenseWebhook.js';

/** Delivers an issued license key to the buyer. */
export type LicenseEmailSender = (issued: IssuedLicense) => Promise<void>;

export interface ResendOptions {
  apiKey: string;
  /** Verified sender, e.g. "dev-work <keys@yourdomain.com>". */
  from: string;
  subject?: string;
  /** Optional product name used in the email body. */
  productName?: string;
}

function defaultBody(issued: IssuedLicense, productName: string): string {
  return [
    `Thanks for purchasing ${productName} (${issued.tier} tier)!`,
    '',
    'Your license key:',
    '',
    issued.key,
    '',
    'To activate: open the app, go to Settings → License, paste the key',
    `(use the email ${issued.email}) and click Activate.`,
    '',
    'Keep this key safe — it is bound to your email address.'
  ].join('\n');
}

/**
 * Builds an email sender backed by Resend (https://resend.com).
 *
 * Resend exposes a simple HTTPS API, so no SDK is required. The API key lives
 * only in the deployment's secret store.
 */
export function makeResendSender(opts: ResendOptions): LicenseEmailSender {
  const productName = opts.productName ?? 'dev-work';
  return async (issued: IssuedLicense): Promise<void> => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: opts.from,
        to: issued.email,
        subject: opts.subject ?? 'Your dev-work license key',
        text: defaultBody(issued, productName)
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend email failed (${res.status}): ${detail}`);
    }
  };
}
