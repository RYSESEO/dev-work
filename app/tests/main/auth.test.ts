import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, createAuthService } from '../../src/main/services/auth.js';
import { createAppStore } from '../../src/main/db/appStore.js';
import { createId, type User } from '../../src/shared/domain.js';

describe('auth', () => {
  describe('password hashing', () => {
    it('hashes and verifies a password correctly', () => {
      const hash = hashPassword('my-secret-password');
      expect(verifyPassword('my-secret-password', hash)).toBe(true);
    });

    it('rejects wrong password', () => {
      const hash = hashPassword('my-secret-password');
      expect(verifyPassword('wrong-password', hash)).toBe(false);
    });

    it('produces different hashes for same password', () => {
      const hash1 = hashPassword('password');
      const hash2 = hashPassword('password');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('auth service', () => {
    it('requires setup when no users exist', async () => {
      const store = await createAppStore(':memory:');
      const auth = createAuthService(store);
      expect(auth.requiresSetup()).toBe(true);
    });

    it('does not require setup when users exist', async () => {
      const store = await createAppStore(':memory:');
      const now = new Date().toISOString();
      const user: User = {
        id: createId('user'),
        name: 'Admin',
        email: 'admin@test.com',
        role: 'admin',
        avatar: null,
        passwordHash: hashPassword('password123'),
        createdAt: now,
        lastActiveAt: now
      };
      store.put('users', user.id, user);
      const auth = createAuthService(store);
      expect(auth.requiresSetup()).toBe(false);
    });

    it('logs in with correct credentials', async () => {
      const store = await createAppStore(':memory:');
      const password = 'securePass!';
      const now = new Date().toISOString();
      const user: User = {
        id: createId('user'),
        name: 'Admin',
        email: 'admin@test.com',
        role: 'admin',
        avatar: null,
        passwordHash: hashPassword(password),
        createdAt: now,
        lastActiveAt: now
      };
      store.put('users', user.id, user);
      const auth = createAuthService(store);

      const safeUser = auth.login('admin@test.com', password);
      expect(safeUser.email).toBe('admin@test.com');
      expect(safeUser.role).toBe('admin');
      expect(auth.getCurrentUser()).toBeTruthy();
    });

    it('rejects invalid credentials', async () => {
      const store = await createAppStore(':memory:');
      const now = new Date().toISOString();
      const user: User = {
        id: createId('user'),
        name: 'Admin',
        email: 'admin@test.com',
        role: 'admin',
        avatar: null,
        passwordHash: hashPassword('correct'),
        createdAt: now,
        lastActiveAt: now
      };
      store.put('users', user.id, user);
      const auth = createAuthService(store);

      expect(() => auth.login('admin@test.com', 'wrong')).toThrow();
    });

    it('logs out and clears current user', async () => {
      const store = await createAppStore(':memory:');
      const now = new Date().toISOString();
      const user: User = {
        id: createId('user'),
        name: 'Admin',
        email: 'admin@test.com',
        role: 'admin',
        avatar: null,
        passwordHash: hashPassword('pass'),
        createdAt: now,
        lastActiveAt: now
      };
      store.put('users', user.id, user);
      const auth = createAuthService(store);

      auth.login('admin@test.com', 'pass');
      expect(auth.getCurrentUser()).toBeTruthy();
      auth.logout();
      expect(auth.getCurrentUser()).toBeNull();
    });
  });
});
