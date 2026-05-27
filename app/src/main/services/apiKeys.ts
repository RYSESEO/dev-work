import { createHash, randomBytes } from 'node:crypto';
import type { AppStore } from '../db/appStore.js';
import { createId, nowIso, type ApiKey, type ApiScope } from '../../shared/domain.js';

export interface ApiKeyService {
  create(name: string, scopes: ApiScope[]): { key: ApiKey; rawKey: string };
  validate(rawKey: string): ApiKey | null;
  revoke(id: string): void;
  list(): Array<Omit<ApiKey, 'keyHash'>>;
  recordUsage(id: string): void;
}

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createApiKeyService(store: AppStore): ApiKeyService {
  return {
    create(name: string, scopes: ApiScope[]): { key: ApiKey; rawKey: string } {
      const rawKey = `dw_${randomBytes(24).toString('hex')}`;
      const key: ApiKey = {
        id: createId('apikey'),
        name,
        keyHash: hashKey(rawKey),
        prefix: rawKey.slice(0, 10),
        scopes,
        createdAt: nowIso(),
        lastUsedAt: null,
        expiresAt: null,
        revoked: false
      };
      store.put('apiKeys', key.id, key);
      return { key, rawKey };
    },

    validate(rawKey: string): ApiKey | null {
      const hash = hashKey(rawKey);
      const keys = store.getAll<ApiKey>('apiKeys');
      const match = keys.find((k) => k.keyHash === hash && !k.revoked);
      if (!match) return null;
      if (match.expiresAt && new Date(match.expiresAt) < new Date()) return null;
      return match;
    },

    revoke(id: string): void {
      const key = store.getById<ApiKey>('apiKeys', id);
      if (!key) throw new Error(`API key not found: ${id}`);
      store.put('apiKeys', id, { ...key, revoked: true });
    },

    list(): Array<Omit<ApiKey, 'keyHash'>> {
      return store.getAll<ApiKey>('apiKeys').map(({ keyHash: _, ...rest }) => {
        void _;
        return rest;
      });
    },

    recordUsage(id: string): void {
      const key = store.getById<ApiKey>('apiKeys', id);
      if (key) {
        store.put('apiKeys', id, { ...key, lastUsedAt: nowIso() });
      }
    }
  };
}
