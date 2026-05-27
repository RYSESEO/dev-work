import crypto from 'node:crypto';
import type { AppStore } from '../db/appStore.js';
import type { SafeUser, User } from '../../shared/domain.js';
import { logger } from '../logger.js';

const log = logger.child('auth');

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

export function stripPasswordHash(user: User): SafeUser {
  const { passwordHash: _hash, ...safe } = user;
  void _hash;
  return safe;
}

export interface AuthService {
  login(email: string, password: string): SafeUser;
  logout(): void;
  getCurrentUser(): SafeUser | null;
  setPassword(userId: string, password: string): void;
  requiresSetup(): boolean;
}

export function createAuthService(store: AppStore): AuthService {
  let currentUserId: string | null = null;

  return {
    login(email: string, password: string): SafeUser {
      const users = store.getAll<User>('users');
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error('Invalid email or password.');

      if (!user.passwordHash) {
        throw new Error('Account has no password set. Contact an admin.');
      }

      if (!verifyPassword(password, user.passwordHash)) {
        log.warn('Failed login attempt', { email });
        throw new Error('Invalid email or password.');
      }

      currentUserId = user.id;
      store.put('users', user.id, { ...user, lastActiveAt: new Date().toISOString() });
      log.info('User logged in', { userId: user.id, email });
      return stripPasswordHash(user);
    },

    logout(): void {
      log.info('User logged out', { userId: currentUserId });
      currentUserId = null;
    },

    getCurrentUser(): SafeUser | null {
      if (!currentUserId) return null;
      const user = store.getById<User>('users', currentUserId);
      if (!user) {
        currentUserId = null;
        return null;
      }
      return stripPasswordHash(user);
    },

    setPassword(userId: string, password: string): void {
      const user = store.getById<User>('users', userId);
      if (!user) throw new Error(`User not found: ${userId}`);
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      store.put('users', user.id, { ...user, passwordHash: hashPassword(password) });
      log.info('Password set', { userId });
    },

    requiresSetup(): boolean {
      const users = store.getAll<User>('users');
      return users.length === 0 || users.every((u) => !u.passwordHash);
    }
  };
}
