import crypto from 'node:crypto';
import type { AppStore } from '../db/appStore.js';
import { logger } from '../logger.js';

const log = logger.child('license');

export type LicenseTier = 'free' | 'pro' | 'team';

export interface LicenseInfo {
  id: string;
  key: string;
  tier: LicenseTier;
  email: string;
  maxAgents: number;
  maxRunners: number;
  maxUsers: number;
  features: LicenseFeature[];
  validUntil: string;
  activatedAt: string;
}

export type LicenseFeature =
  | 'unlimited_agents'
  | 'unlimited_runners'
  | 'marketplace_install'
  | 'plugin_system'
  | 'data_export'
  | 'audit_log'
  | 'workflow_engine'
  | 'priority_support'
  | 'custom_branding'
  | 'team_management';

const TIER_LIMITS: Record<LicenseTier, { maxAgents: number; maxRunners: number; maxUsers: number; features: LicenseFeature[] }> = {
  free: {
    maxAgents: 3,
    maxRunners: 1,
    maxUsers: 1,
    features: []
  },
  pro: {
    maxAgents: 50,
    maxRunners: 10,
    maxUsers: 1,
    features: [
      'unlimited_agents',
      'unlimited_runners',
      'marketplace_install',
      'plugin_system',
      'data_export',
      'audit_log',
      'workflow_engine'
    ]
  },
  team: {
    maxAgents: 999,
    maxRunners: 999,
    maxUsers: 999,
    features: [
      'unlimited_agents',
      'unlimited_runners',
      'marketplace_install',
      'plugin_system',
      'data_export',
      'audit_log',
      'workflow_engine',
      'priority_support',
      'custom_branding',
      'team_management'
    ]
  }
};

const LICENSE_PREFIX = 'DEVWORK';
const KEY_SEPARATOR = '-';

export interface LicenseService {
  activate(key: string, email: string): LicenseInfo;
  deactivate(): void;
  getLicense(): LicenseInfo | null;
  getTier(): LicenseTier;
  checkFeature(feature: LicenseFeature): boolean;
  checkAgentLimit(currentCount: number): boolean;
  checkRunnerLimit(currentCount: number): boolean;
  checkUserLimit(currentCount: number): boolean;
  getLimits(): { maxAgents: number; maxRunners: number; maxUsers: number; tier: LicenseTier; features: LicenseFeature[] };
}

function parseLicenseKey(key: string): { tier: LicenseTier; expiryYear: number; checksum: string } | null {
  const parts = key.split(KEY_SEPARATOR);
  if (parts.length !== 5 || parts[0] !== LICENSE_PREFIX) return null;

  const tierCode = parts[1];
  const tier: LicenseTier | null =
    tierCode === 'PRO' ? 'pro' :
    tierCode === 'TEAM' ? 'team' : null;
  if (!tier) return null;

  const expiryYear = parseInt(parts[2], 10);
  if (isNaN(expiryYear) || expiryYear < 2024) return null;

  const serial = parts[3];
  const checksum = parts[4];

  const expected = crypto
    .createHash('sha256')
    .update(`${LICENSE_PREFIX}${KEY_SEPARATOR}${tierCode}${KEY_SEPARATOR}${expiryYear}${KEY_SEPARATOR}${serial}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  if (checksum !== expected) return null;

  return { tier, expiryYear, checksum };
}

export function generateLicenseKey(tier: 'pro' | 'team', expiryYear: number): string {
  const tierCode = tier.toUpperCase();
  const serial = crypto.randomBytes(4).toString('hex').toUpperCase();
  const base = `${LICENSE_PREFIX}${KEY_SEPARATOR}${tierCode}${KEY_SEPARATOR}${expiryYear}${KEY_SEPARATOR}${serial}`;
  const checksum = crypto.createHash('sha256').update(base).digest('hex').slice(0, 8).toUpperCase();
  return `${base}${KEY_SEPARATOR}${checksum}`;
}

export function createLicenseService(store: AppStore): LicenseService {
  function getStored(): LicenseInfo | null {
    return store.getById<LicenseInfo & { id: string }>('sandboxConfig', 'license') as LicenseInfo | null;
  }

  return {
    activate(key: string, email: string): LicenseInfo {
      const parsed = parseLicenseKey(key.trim().toUpperCase());
      if (!parsed) throw new Error('Invalid license key format.');

      const now = new Date();
      const expiryDate = new Date(parsed.expiryYear, 11, 31, 23, 59, 59);
      if (now > expiryDate) throw new Error('License key has expired.');

      const limits = TIER_LIMITS[parsed.tier];
      const license: LicenseInfo = {
        id: 'license',
        key: key.trim().toUpperCase(),
        tier: parsed.tier,
        email: email.trim(),
        maxAgents: limits.maxAgents,
        maxRunners: limits.maxRunners,
        maxUsers: limits.maxUsers,
        features: limits.features,
        validUntil: expiryDate.toISOString(),
        activatedAt: now.toISOString()
      };

      store.put('sandboxConfig', 'license', license as LicenseInfo & { id: string });
      log.info('License activated', { tier: parsed.tier, email, validUntil: license.validUntil });
      return license;
    },

    deactivate(): void {
      store.remove('sandboxConfig', 'license');
      log.info('License deactivated');
    },

    getLicense(): LicenseInfo | null {
      const license = getStored();
      if (!license) return null;
      if (new Date() > new Date(license.validUntil)) {
        log.warn('License expired', { validUntil: license.validUntil });
        return null;
      }
      return license;
    },

    getTier(): LicenseTier {
      const license = this.getLicense();
      return license?.tier ?? 'free';
    },

    checkFeature(feature: LicenseFeature): boolean {
      const license = this.getLicense();
      if (!license) return false;
      return license.features.includes(feature);
    },

    checkAgentLimit(currentCount: number): boolean {
      const limits = this.getLimits();
      return currentCount < limits.maxAgents;
    },

    checkRunnerLimit(currentCount: number): boolean {
      const limits = this.getLimits();
      return currentCount < limits.maxRunners;
    },

    checkUserLimit(currentCount: number): boolean {
      const limits = this.getLimits();
      return currentCount < limits.maxUsers;
    },

    getLimits() {
      const license = this.getLicense();
      const tier = license?.tier ?? 'free';
      return { ...TIER_LIMITS[tier], tier };
    }
  };
}
