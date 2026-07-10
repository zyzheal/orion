/**
 * LoginAttemptService - Unit Tests
 *
 * Tests for account lockout and login failure tracking:
 * - In-memory lock state tracking
 * - Account lockout after threshold failures
 * - Successful login resets counter
 * - Manual account unlock
 * - Lock expiry and automatic cleanup
 * - Pre-check before authentication (requireNotLocked)
 */

import { LoginAttemptService, LoginAttemptConfig } from '../LoginAttemptService';
import { UserRepository, User } from '../../user/UserRepository';

// Mock pino to suppress log output

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-001',
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'pbkdf2$abc$100000$hash',
    name: 'Test User',
    avatar_url: null,
    role: 'user',
    status: 'active',
    last_login_at: null,
    last_login_ip: null,
    settings: {},
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    created_by: null,
    mfa_secret: null,
    mfa_enabled: false,
    mfa_backup_codes: null,
    password_reset_token: null,
    password_reset_expires: null,
    failed_login_attempts: 0,
    locked_until: null,
    ...overrides,
  };
}

function createMockUserRepository(initialUsers: User[] = []): jest.Mocked<UserRepository> {
  const users = new Map<string, User>();
  for (const u of initialUsers) {
    users.set(u.id, { ...u });
  }

  return {
    findById: jest.fn(async (id: string) => users.get(id) ?? null),
    update: jest.fn(async (id: string, input: Partial<User>) => {
      const user = users.get(id);
      if (!user) return null;
      const updated = { ...user, ...input };
      users.set(id, updated);
      return updated;
    }),
    resetLoginAttempts: jest.fn(async (id: string) => {
      const user = users.get(id);
      if (user) {
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }
    }),
    incrementFailedAttempts: jest.fn(async (id: string, maxAttempts: number, lockDurationMs: number) => {
      const user = users.get(id);
      if (!user) {
        return { attempts: 0, lockedUntil: null };
      }
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil: Date | null = null;
      if (newAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockDurationMs);
      }
      user.failed_login_attempts = newAttempts;
      user.locked_until = lockedUntil;
      return { attempts: newAttempts, lockedUntil };
    }),
    findByPasswordResetToken: jest.fn(),
    updatePassword: jest.fn(),
    findByUsername: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    hardDelete: jest.fn(),
    updateLastLogin: jest.fn(),
    existsByUsername: jest.fn(),
    existsByEmail: jest.fn(),
    findByTenant: jest.fn(),
    addToTenant: jest.fn(),
    removeFromTenant: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginAttemptService', () => {
  let mockRepository: jest.Mocked<UserRepository>;
  let service: LoginAttemptService;
  let users: Map<string, User>;

  const defaultConfig: LoginAttemptConfig = {
    maxAttempts: 5,
    lockDurationMs: 15 * 60 * 1000, // 15 minutes
    cleanupIntervalMs: 10 * 60 * 1000,
  };

  beforeEach(() => {
    users = new Map();
    mockRepository = createMockUserRepository();
  });

  afterEach(() => {
    service.stop();
  });

  // ==================== Lifecycle ====================

  describe('start/stop', () => {
    it('should start without errors', () => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      expect(() => service.start()).not.toThrow();
    });

    it('should stop without errors', () => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
      expect(() => service.stop()).not.toThrow();
    });
  });

  // ==================== recordFailure ====================

  describe('recordFailure', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should return attempts=1 and locked=false on first failure', async () => {
      const user = createMockUser();
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.incrementFailedAttempts = jest.fn(async (id: string) => {
        const u = users.get(id);
        if (!u) return { attempts: 0, lockedUntil: null };
        u.failed_login_attempts = 1;
        return { attempts: 1, lockedUntil: null };
      });

      const result = await service.recordFailure(user.id);

      expect(result.attempts).toBe(1);
      expect(result.locked).toBe(false);
      expect(result.lockedUntil).toBeNull();
    });

    it('should increment attempts up to maxAttempts - 1 without locking', async () => {
      const user = createMockUser({ failed_login_attempts: 0 });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      for (let i = 1; i < defaultConfig.maxAttempts; i++) {
        mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
          const u = users.get(id);
          if (!u) return null;
          const updated = { ...u, ...input };
          users.set(id, updated);
          return updated;
        });

        const result = await service.recordFailure(user.id);
        expect(result.locked).toBe(false);
        expect(result.attempts).toBe(i);
      }
    });

    it('should lock account on the final failure attempt', async () => {
      const user = createMockUser({ failed_login_attempts: defaultConfig.maxAttempts - 1 });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const result = await service.recordFailure(user.id);

      expect(result.locked).toBe(true);
      expect(result.attempts).toBe(defaultConfig.maxAttempts);
      expect(result.lockedUntil).not.toBeNull();
      expect(result.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ==================== recordSuccess ====================

  describe('recordSuccess', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should reset counter and clear lock state', async () => {
      const user = createMockUser({ failed_login_attempts: 3, locked_until: new Date(Date.now() + 60000) });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.resetLoginAttempts = jest.fn(async (id: string) => {
        const u = users.get(id);
        if (u) {
          u.failed_login_attempts = 0;
          u.locked_until = null;
        }
      });

      await service.recordSuccess(user.id);

      // After recordSuccess, the lock should be cleared
      expect(mockRepository.resetLoginAttempts).toHaveBeenCalledWith(user.id);

      // isLocked should return false
      const isLocked = await service.isLocked(user.id);
      expect(isLocked).toBe(false);
    });
  });

  // ==================== isLocked ====================

  describe('isLocked', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should return false for user with no lock', async () => {
      const user = createMockUser({ locked_until: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const locked = await service.isLocked(user.id);
      expect(locked).toBe(false);
    });

    it('should return true for user with active lock', async () => {
      const user = createMockUser({ locked_until: new Date(Date.now() + 60000) });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const locked = await service.isLocked(user.id);
      expect(locked).toBe(true);
    });

    it('should return false and reset for expired lock', async () => {
      const user = createMockUser({ locked_until: new Date(Date.now() - 60000) }); // expired
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.resetLoginAttempts = jest.fn(async (id: string) => {
        const u = users.get(id);
        if (u) {
          u.failed_login_attempts = 0;
          u.locked_until = null;
        }
      });

      const locked = await service.isLocked(user.id);
      expect(locked).toBe(false);

      // Verify DB was cleaned up
      expect(mockRepository.resetLoginAttempts).toHaveBeenCalledWith(user.id);
    });

    it('should return false for non-existent user', async () => {
      mockRepository.findById = jest.fn(async () => null);
      const locked = await service.isLocked('nonexistent');
      expect(locked).toBe(false);
    });
  });

  // ==================== getRemainingLockTime ====================

  describe('getRemainingLockTime', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should return remaining milliseconds for locked user', async () => {
      const remainingMs = 5 * 60 * 1000; // 5 minutes
      const user = createMockUser({ locked_until: new Date(Date.now() + remainingMs) });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const remaining = await service.getRemainingLockTime(user.id);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(remainingMs);
    });

    it('should return 0 for unlocked user', async () => {
      const user = createMockUser({ locked_until: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const remaining = await service.getRemainingLockTime(user.id);
      expect(remaining).toBe(0);
    });

    it('should return 0 for non-existent user', async () => {
      mockRepository.findById = jest.fn(async () => null);
      const remaining = await service.getRemainingLockTime('nonexistent');
      expect(remaining).toBe(0);
    });
  });

  // ==================== unlockAccount ====================

  describe('unlockAccount', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should clear lock state and reset DB', async () => {
      const user = createMockUser({ failed_login_attempts: 5, locked_until: new Date(Date.now() + 60000) });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.resetLoginAttempts = jest.fn(async (id: string) => {
        const u = users.get(id);
        if (u) {
          u.failed_login_attempts = 0;
          u.locked_until = null;
        }
      });

      await service.unlockAccount(user.id);

      expect(mockRepository.resetLoginAttempts).toHaveBeenCalledWith(user.id);
      expect(await service.isLocked(user.id)).toBe(false);
    });
  });

  // ==================== getFailureCount ====================

  describe('getFailureCount', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should return 0 for user with no failures', async () => {
      const user = createMockUser({ failed_login_attempts: 0 });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const count = await service.getFailureCount(user.id);
      expect(count).toBe(0);
    });

    it('should return failure count from DB', async () => {
      const user = createMockUser({ failed_login_attempts: 3 });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const count = await service.getFailureCount(user.id);
      expect(count).toBe(3);
    });

    it('should return 0 for non-existent user', async () => {
      mockRepository.findById = jest.fn(async () => null);
      const count = await service.getFailureCount('nonexistent');
      expect(count).toBe(0);
    });
  });

  // ==================== requireNotLocked ====================

  describe('requireNotLocked', () => {
    beforeEach(() => {
      service = new LoginAttemptService(mockRepository, defaultConfig);
      service.start();
    });

    it('should not throw for unlocked user', async () => {
      const user = createMockUser({ locked_until: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.requireNotLocked(user.id)).resolves.not.toThrow();
    });

    it('should throw UNAUTHORIZED for locked user with remaining time', async () => {
      const user = createMockUser({ locked_until: new Date(Date.now() + 10 * 60 * 1000) }); // 10 min
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.requireNotLocked(user.id)).rejects.toThrow('已被锁定');
      await expect(service.requireNotLocked(user.id)).rejects.toThrow('分钟后重试');
    });

    it('should not throw for user with expired lock', async () => {
      const user = createMockUser({ locked_until: new Date(Date.now() - 60000) }); // expired
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.requireNotLocked(user.id)).resolves.not.toThrow();
      // Should have reset the DB
      expect(mockRepository.resetLoginAttempts).toHaveBeenCalledWith(user.id);
    });
  });

  // ==================== Custom Config ====================

  describe('custom configuration', () => {
    it('should accept custom maxAttempts and lockDurationMs', async () => {
      const customConfig: LoginAttemptConfig = {
        maxAttempts: 3,
        lockDurationMs: 5 * 60 * 1000,
        cleanupIntervalMs: 5 * 60 * 1000,
      };
      service = new LoginAttemptService(mockRepository, customConfig);
      service.start();
      expect(() => service.stop()).not.toThrow();
    });
  });
});
