import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createBillingService } from '../../src/main/services/billing.js';

describe('billing', () => {
  it('returns sensible defaults when unconfigured', async () => {
    const store = await createAppStore(':memory:');
    const billing = createBillingService(store);

    const config = billing.getConfig();
    expect(config.provider).toBe('lemonsqueezy');
    expect(config.proCheckoutUrl).toBe('');
    expect(config.teamCheckoutUrl).toBe('');
    expect(config.manageUrl).toBe('');
  });

  it('persists config across instances', async () => {
    const store = await createAppStore(':memory:');
    const billing1 = createBillingService(store);

    billing1.setConfig({
      provider: 'paddle',
      proCheckoutUrl: 'https://store.example.com/pro',
      teamCheckoutUrl: 'https://store.example.com/team'
    });

    const billing2 = createBillingService(store);
    const config = billing2.getConfig();
    expect(config.provider).toBe('paddle');
    expect(config.proCheckoutUrl).toBe('https://store.example.com/pro');
    expect(config.teamCheckoutUrl).toBe('https://store.example.com/team');
  });

  it('creates a checkout session with the email pre-filled (lemonsqueezy)', async () => {
    const store = await createAppStore(':memory:');
    const billing = createBillingService(store);
    billing.setConfig({
      provider: 'lemonsqueezy',
      proCheckoutUrl: 'https://store.lemonsqueezy.com/buy/abc'
    });

    const session = billing.createCheckoutSession('pro', 'dev@example.com');
    expect(session.tier).toBe('pro');
    expect(session.provider).toBe('lemonsqueezy');
    const url = new URL(session.url);
    expect(url.searchParams.get('checkout[email]')).toBe('dev@example.com');
    expect(url.pathname).toBe('/buy/abc');
  });

  it('uses the provider-specific email parameter (paddle)', async () => {
    const store = await createAppStore(':memory:');
    const billing = createBillingService(store);
    billing.setConfig({
      provider: 'paddle',
      teamCheckoutUrl: 'https://pay.example.com/checkout'
    });

    const session = billing.createCheckoutSession('team', 'team@example.com');
    const url = new URL(session.url);
    expect(url.searchParams.get('customer_email')).toBe('team@example.com');
  });

  it('omits the email parameter when no email is provided', async () => {
    const store = await createAppStore(':memory:');
    const billing = createBillingService(store);
    billing.setConfig({ proCheckoutUrl: 'https://store.lemonsqueezy.com/buy/abc' });

    const session = billing.createCheckoutSession('pro', '   ');
    const url = new URL(session.url);
    expect(url.searchParams.has('checkout[email]')).toBe(false);
  });

  it('throws when the requested tier has no checkout URL', async () => {
    const store = await createAppStore(':memory:');
    const billing = createBillingService(store);

    expect(() => billing.createCheckoutSession('pro', 'dev@example.com')).toThrow(/no pro checkout url/i);
  });

  it('throws when the configured checkout URL is invalid', async () => {
    const store = await createAppStore(':memory:');
    const billing = createBillingService(store);
    billing.setConfig({ teamCheckoutUrl: 'not-a-valid-url' });

    expect(() => billing.createCheckoutSession('team', 'dev@example.com')).toThrow(/invalid/i);
  });
});
