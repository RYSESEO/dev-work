import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';
import type { BillingConfig, CheckoutProvider, CheckoutSession, PaidTier } from '../../shared/domain.js';

const log = logger.child('billing');

const CONFIG_KEY = 'billing_config';

const DEFAULT_CONFIG: BillingConfig = {
  provider: 'lemonsqueezy',
  proCheckoutUrl: '',
  teamCheckoutUrl: '',
  manageUrl: ''
};

// Query parameter each provider uses to pre-fill the buyer's email on its
// hosted checkout page.
const EMAIL_PARAM: Record<CheckoutProvider, string> = {
  lemonsqueezy: 'checkout[email]',
  paddle: 'customer_email',
  gumroad: 'email',
  custom: 'email'
};

export interface BillingService {
  getConfig(): BillingConfig;
  setConfig(update: Partial<BillingConfig>): BillingConfig;
  createCheckoutSession(tier: PaidTier, email: string): CheckoutSession;
}

function withEmail(rawUrl: string, provider: CheckoutProvider, email: string): string {
  const url = new URL(rawUrl);
  const trimmed = email.trim();
  if (trimmed) {
    url.searchParams.set(EMAIL_PARAM[provider], trimmed);
  }
  return url.toString();
}

export function createBillingService(store: AppStore): BillingService {
  function getConfig(): BillingConfig {
    const stored = store.getById<BillingConfig & { id: string }>('settings', CONFIG_KEY);
    if (!stored) return { ...DEFAULT_CONFIG };
    return {
      provider: stored.provider,
      proCheckoutUrl: stored.proCheckoutUrl,
      teamCheckoutUrl: stored.teamCheckoutUrl,
      manageUrl: stored.manageUrl
    };
  }

  function setConfig(update: Partial<BillingConfig>): BillingConfig {
    const next: BillingConfig = { ...getConfig(), ...update };
    store.put('settings', CONFIG_KEY, { id: CONFIG_KEY, ...next });
    log.info('Billing config updated', { provider: next.provider });
    return next;
  }

  function createCheckoutSession(tier: PaidTier, email: string): CheckoutSession {
    const config = getConfig();
    const rawUrl = tier === 'team' ? config.teamCheckoutUrl : config.proCheckoutUrl;
    if (!rawUrl.trim()) {
      throw new Error(
        `No ${tier} checkout URL configured. Add it under Settings → Billing.`
      );
    }

    let url: string;
    try {
      url = withEmail(rawUrl, config.provider, email);
    } catch {
      throw new Error('Configured checkout URL is invalid.');
    }

    log.info('Checkout session created', { provider: config.provider, tier });
    return { provider: config.provider, tier, url };
  }

  return { getConfig, setConfig, createCheckoutSession };
}
