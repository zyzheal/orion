/**
 * MfaService - Unit Tests
 *
 * Tests for TOTP-based MFA service covering:
 * - TOTP secret generation and QR code URI
 * - Backup code generation and one-time consumption
 * - MFA enable/disable flow
 * - MFA verification (TOTP + backup codes)
 * - Password reset flow
 */

import crypto from 'crypto';
import { MfaService } from '../MfaService';
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

  const repo = {
    findById: jest.fn(async (id: string) => users.get(id) ?? null),
    findByUsername: jest.fn(async (username: string) => {
      for (const u of users.values()) {
        if (u.username === username) return u;
      }
      return null;
    }),
    findByEmail: jest.fn(async (email: string) => {
      for (const u of users.values()) {
        if (u.email === email) return u;
      }
      return null;
    }),
    findByPasswordResetToken: jest.fn(async (token: string) => {
      for (const u of users.values()) {
        if (u.password_reset_token === token) return u;
      }
      return null;
    }),
    update: jest.fn(async (id: string, input: Partial<User>) => {
      const user = users.get(id);
      if (!user) return null;
      const updated = { ...user, ...input };
      users.set(id, updated);
      return updated;
    }),
    updatePassword: jest.fn(async (id: string, hash: string) => {
      const user = users.get(id);
      if (user) {
        user.password_hash = hash;
        user.password_reset_token = null;
        user.password_reset_expires = null;
      }
    }),
    resetLoginAttempts: jest.fn(async (id: string) => {
      const user = users.get(id);
      if (user) {
        user.failed_login_attempts = 0;
        user.locked_until = null;
      }
    }),
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

  return repo;
}

/**
 * Compute a TOTP value using the same algorithm as MfaService (RFC 6238)
 */
function computeTestTotp(secretBase32: string, counter: bigint): string {
  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  // Base32 decode
  const cleaned = secretBase32.replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`Invalid Base32: ${char}`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const secret = Buffer.from(bytes);

  // HMAC-SHA1
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac('sha1', secret).update(counterBuffer).digest();

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, '0');
}

/**
 * Generate a valid 6-digit TOTP for the current time step.
 */
function getCurrentTotp(secretBase32: string): string {
  const counter = BigInt(Math.floor(Date.now() / 1000 / 30));
  return computeTestTotp(secretBase32, counter);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MfaService', () => {
  let mockRepository: jest.Mocked<UserRepository>;
  let service: MfaService;
  let users: Map<string, User>;

  beforeEach(() => {
    users = new Map();
    mockRepository = createMockUserRepository();
    service = new MfaService(mockRepository as any);
  });

  // ==================== enableMfa ====================

  describe('enableMfa', () => {
    it('should return a secret, QR code URI, and 10 backup codes', async () => {
      const user = createMockUser();
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      const result = await service.enableMfa(user.id, 'orion-platform');

      // Secret is Base32, at least 20 chars (20 bytes encoded)
      expect(result.secret).toBeDefined();
      expect(result.secret.replace(/=+/g, '').length).toBeGreaterThanOrEqual(20);

      // QR URI format
      expect(result.qrCodeUri).toMatch(/^otpauth:\/\/totp\//);
      expect(result.qrCodeUri).toContain('orion-platform');
      expect(result.qrCodeUri).toContain(result.secret);

      // Backup codes
      expect(result.backupCodes).toHaveLength(10);
      for (const code of result.backupCodes) {
        // Format: dash-separated groups of 5+ chars using service alphabet (A-Z, 2-9, 0)
        expect(code).toMatch(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
      }
    });

    it('should persist mfa_secret, mfa_enabled=false, and hashed backup codes', async () => {
      const user = createMockUser();
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      await service.enableMfa(user.id, 'orion');

      expect(mockRepository.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          mfa_secret: expect.any(String),
          mfa_enabled: false,
          mfa_backup_codes: expect.any(String),
        }),
      );

      // Verify backup codes are JSON array of hashes
      const updateCall = (mockRepository.update as jest.Mock).mock.calls[0];
      const storedCodes: string[] = JSON.parse(updateCall[1].mfa_backup_codes);
      expect(storedCodes).toHaveLength(10);
      // All entries should be 64-char SHA-256 hex strings
      for (const hash of storedCodes) {
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it('should throw NOT_FOUND for non-existent user', async () => {
      await expect(service.enableMfa('nonexistent')).rejects.toThrow('User not found');
    });

    it('should throw ALREADY_EXISTS if MFA already enabled', async () => {
      const user = createMockUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.enableMfa(user.id)).rejects.toThrow('already enabled');
    });
  });

  // ==================== verifyMfa ====================

  describe('verifyMfa', () => {
    it('should return success=true for a valid TOTP code', async () => {
      const secret = getCurrentTotp('JBSWY3DPEHPK3PXP'); // well-known test secret
      const user = createMockUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      const result = await service.verifyMfa(user.id, secret);
      expect(result.success).toBe(true);
      expect(result.usedBackupCode).toBe(false);
    });

    it('should return success=false for an invalid code', async () => {
      const user = createMockUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const result = await service.verifyMfa(user.id, '000000');
      expect(result.success).toBe(false);
    });

    it('should throw NOT_FOUND for non-existent user', async () => {
      await expect(service.verifyMfa('nonexistent', '123456')).rejects.toThrow('User not found');
    });

    it('should throw OPERATION_FAILED if MFA secret not set', async () => {
      const user = createMockUser({ mfa_secret: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.verifyMfa(user.id, '123456')).rejects.toThrow('MFA is not set up');
    });
  });

  // ==================== Backup Codes ====================

  describe('backup codes', () => {
    it('should consume backup code on first use and mark success', async () => {
      // Generate a backup code hash to seed the user
      const testCode = 'ABCDE-FGHIJ-KLMNO';
      const codeHash = crypto.createHash('sha256').update(testCode.replace(/-/g, '')).digest('hex');

      const user = createMockUser({
        mfa_enabled: true,
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        mfa_backup_codes: JSON.stringify([codeHash]),
      });
      users.set(user.id, user);

      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      const result = await service.verifyMfa(user.id, testCode);
      expect(result.success).toBe(true);
      expect(result.usedBackupCode).toBe(true);
      expect(result.remainingBackupCodes).toBe(0);

      // Verify the backup code was removed from storage
      const updatedUser = users.get(user.id);
      const remainingCodes: string[] = JSON.parse(updatedUser!.mfa_backup_codes!);
      expect(remainingCodes).toHaveLength(0);
    });

    it('should not reuse a consumed backup code', async () => {
      const testCode = 'PQRST-UVWXY-ZABCD';
      const codeHash = crypto.createHash('sha256').update(testCode.replace(/-/g, '')).digest('hex');

      const user = createMockUser({
        mfa_enabled: true,
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        mfa_backup_codes: JSON.stringify([codeHash]),
      });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      // First use - should succeed
      const result1 = await service.verifyMfa(user.id, testCode);
      expect(result1.success).toBe(true);

      // Second use - should fail
      const result2 = await service.verifyMfa(user.id, testCode);
      expect(result2.success).toBe(false);
    });
  });

  // ==================== disableMfa ====================

  describe('disableMfa', () => {
    it('should disable MFA when valid backup code is provided', async () => {
      const testCode = 'ZZZZZ-YYYYY-XXXXX';
      const codeHash = crypto.createHash('sha256').update(testCode.replace(/-/g, '')).digest('hex');

      const user = createMockUser({
        mfa_enabled: true,
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        mfa_backup_codes: JSON.stringify([codeHash]),
      });
      users.set(user.id, user);

      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      await service.disableMfa(user.id, testCode);

      const updatedUser = users.get(user.id);
      expect(updatedUser!.mfa_enabled).toBe(false);
      expect(updatedUser!.mfa_secret).toBeNull();
      expect(updatedUser!.mfa_backup_codes).toBeNull();
    });

    it('should throw error when disabling with invalid code', async () => {
      const user = createMockUser({ mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP' });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.disableMfa(user.id, '000000')).rejects.toThrow('Invalid MFA code');
    });

    it('should throw error when MFA is not set up', async () => {
      const user = createMockUser({ mfa_secret: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.disableMfa(user.id, '123456')).rejects.toThrow('MFA is not enabled');
    });
  });

  // ==================== regenerateBackupCodes ====================

  describe('regenerateBackupCodes', () => {
    it('should generate new backup codes and invalidate old ones', async () => {
      const oldCode = crypto.createHash('sha256').update('OLDCODEOLD').digest('hex');
      const user = createMockUser({
        mfa_enabled: true,
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        mfa_backup_codes: JSON.stringify([oldCode]),
      });
      users.set(user.id, user);

      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      const newCodes = await service.regenerateBackupCodes(user.id);

      expect(newCodes).toHaveLength(10);
      // Old code should no longer work
      const result = await service.verifyMfa(user.id, 'OLDCODEOLD');
      expect(result.success).toBe(false);
    });

    it('should throw error if MFA not enabled', async () => {
      const user = createMockUser({ mfa_secret: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      await expect(service.regenerateBackupCodes(user.id)).rejects.toThrow('MFA is not enabled');
    });
  });

  // ==================== getRemainingBackupCodeCount ====================

  describe('getRemainingBackupCodeCount', () => {
    it('should return correct count', async () => {
      const codes = Array.from({ length: 5 }, () =>
        crypto.createHash('sha256').update(crypto.randomBytes(8).toString('hex')).digest('hex'),
      );
      const user = createMockUser({ mfa_backup_codes: JSON.stringify(codes) });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const count = await service.getRemainingBackupCodeCount(user.id);
      expect(count).toBe(5);
    });

    it('should return 0 for user with no backup codes', async () => {
      const user = createMockUser({ mfa_backup_codes: null });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const count = await service.getRemainingBackupCodeCount(user.id);
      expect(count).toBe(0);
    });

    it('should return 0 for non-existent user', async () => {
      mockRepository.findById = jest.fn(async () => null);
      const count = await service.getRemainingBackupCodeCount('nonexistent');
      expect(count).toBe(0);
    });
  });

  // ==================== Password Reset ====================

  describe('generatePasswordResetToken', () => {
    it('should generate a 64-char hex token and set expiry', async () => {
      const user = createMockUser({ email: 'test@example.com' });
      users.set(user.id, user);

      mockRepository.findByEmail = jest.fn(async (email: string) => {
        for (const u of users.values()) {
          if (u.email === email) return u;
        }
        return null;
      });
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);
      mockRepository.update = jest.fn(async (id: string, input: Partial<User>) => {
        const u = users.get(id);
        if (!u) return null;
        const updated = { ...u, ...input };
        users.set(id, updated);
        return updated;
      });

      const result = await service.generatePasswordResetToken('test@example.com');

      expect(result).not.toBeNull();
      expect(result!.resetToken).toHaveLength(64);
      expect(result!.resetToken).toMatch(/^[a-f0-9]+$/);
      expect(result!.expiresAt > new Date()).toBe(true);
    });

    it('should return null for non-existent email (no user enumeration)', async () => {
      mockRepository.findByEmail = jest.fn(async () => null);

      const result = await service.generatePasswordResetToken('nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('verifyPasswordResetToken', () => {
    it('should return user for valid non-expired token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const user = createMockUser({
        password_reset_token: token,
        password_reset_expires: new Date(Date.now() + 600_000),
      });
      users.set(user.id, user);
      mockRepository.findByPasswordResetToken = jest.fn(async (t: string) => {
        for (const u of users.values()) {
          if (u.password_reset_token === t) return u;
        }
        return null;
      });

      const result = await service.verifyPasswordResetToken(token);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
    });

    it('should return null for expired token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const user = createMockUser({
        password_reset_token: token,
        password_reset_expires: new Date(Date.now() - 600_000), // expired
      });
      users.set(user.id, user);
      mockRepository.findByPasswordResetToken = jest.fn(async (t: string) => {
        for (const u of users.values()) {
          if (u.password_reset_token === t) return u;
        }
        return null;
      });

      const result = await service.verifyPasswordResetToken(token);
      expect(result).toBeNull();
    });

    it('should return null for invalid token', async () => {
      mockRepository.findByPasswordResetToken = jest.fn(async () => null);
      const result = await service.verifyPasswordResetToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should update password and clear reset token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const user = createMockUser({
        password_reset_token: token,
        password_reset_expires: new Date(Date.now() + 600_000),
      });
      users.set(user.id, user);

      mockRepository.findByPasswordResetToken = jest.fn(async (t: string) => {
        for (const u of users.values()) {
          if (u.password_reset_token === t) return u;
        }
        return null;
      });
      mockRepository.updatePassword = jest.fn(async () => {});
      mockRepository.resetLoginAttempts = jest.fn(async () => {});

      await service.resetPassword(token, 'new-pbkdf2-hash');

      expect(mockRepository.updatePassword).toHaveBeenCalledWith(user.id, 'new-pbkdf2-hash');
      expect(mockRepository.resetLoginAttempts).toHaveBeenCalledWith(user.id);
    });

    it('should throw UNAUTHORIZED for invalid token', async () => {
      mockRepository.findByPasswordResetToken = jest.fn(async () => null);
      await expect(service.resetPassword('invalid-token', 'hash')).rejects.toThrow('Invalid or expired');
    });
  });

  // ==================== getMfaStatus ====================

  describe('getMfaStatus', () => {
    it('should return MFA status for user with MFA enabled', async () => {
      const codes = Array.from({ length: 3 }, () =>
        crypto.createHash('sha256').update(crypto.randomBytes(8).toString('hex')).digest('hex'),
      );
      const user = createMockUser({
        mfa_enabled: true,
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        mfa_backup_codes: JSON.stringify(codes),
      });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const status = await service.getMfaStatus(user.id);
      expect(status.enabled).toBe(true);
      expect(status.hasBackupCodes).toBe(true);
      expect(status.remainingBackupCodes).toBe(3);
    });

    it('should return enabled=false for user without MFA', async () => {
      const user = createMockUser({ mfa_secret: null, mfa_enabled: false });
      users.set(user.id, user);
      mockRepository.findById = jest.fn(async (id: string) => users.get(id) ?? null);

      const status = await service.getMfaStatus(user.id);
      expect(status.enabled).toBe(false);
      expect(status.hasBackupCodes).toBe(false);
      expect(status.remainingBackupCodes).toBe(0);
    });

    it('should throw NOT_FOUND for non-existent user', async () => {
      mockRepository.findById = jest.fn(async () => null);
      await expect(service.getMfaStatus('nonexistent')).rejects.toThrow('User not found');
    });
  });
});
