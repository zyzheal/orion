/**
 * SecretsService Tests - TDD
 *
 * 测试覆盖：
 * 1. AES-256-GCM 加密/解密
 * 2. Secret 引用语法解析
 * 3. 日志遮蔽
 * 4. Secret CRUD 操作
 * 5. 安全校验（名称格式、shell 注入防护）
 */

import {
  SecretsService,
  StreamSecretSanitizer,
} from '../SecretsService';
import { SecretRepository } from '../../../repositories/SecretRepository';
import * as crypto from 'crypto';

// ==================== Mock ====================

function createMockDb() {
  const queries: Array<{ text: string; params: unknown[] }> = [];
  return {
    queries,
    mock: {
      query: jest.fn(async (text: string, params?: unknown[]) => {
        queries.push({ text, params: params || [] });
        // Default: return empty result
        return { rows: [], rowCount: 0 };
      }),
    },
  };
}

function createService(mockDb: ReturnType<typeof createMockDb>, key?: string) {
  const repo = new SecretRepository(mockDb.mock as any);
  return new SecretsService(repo, { encryptionKey: key });
}

// ==================== Encryption/Decryption ====================

describe('SecretsService - Encryption/Decryption', () => {
  it('should encrypt and decrypt a secret value', () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

    const plaintext = 'my-super-secret-value-12345';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

    const plaintext = 'same-secret';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);

    expect(encrypted1).not.toEqual(encrypted2);
    // But both should decrypt to the same value
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });

  it('should reject decryption with wrong key', () => {
    const mockDb = createMockDb();
    const service1 = createService(mockDb, 'correct-key-32-bytes-long-1234567');
    const service2 = createService(mockDb, 'wrong-key-32-bytes-long-abcdefghij');

    const plaintext = 'top-secret';
    const encrypted = service1.encrypt(plaintext);

    expect(() => service2.decrypt(encrypted)).toThrow();
  });

  it('should reject invalid encrypted data (too short)', () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

    expect(() => service.decrypt(Buffer.from('short'))).toThrow('Invalid encrypted data');
  });

  it('should use hex key directly if 64 hex chars', () => {
    const mockDb = createMockDb();
    const hexKey = 'a'.repeat(64); // 32 bytes as hex
    const service = createService(mockDb, hexKey);

    const plaintext = 'hex-key-secret';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should derive key via SHA-256 for non-hex keys', () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'my-password-not-hex');

    const plaintext = 'derived-key-secret';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('should use fallback key when no encryption key provided', () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, undefined);

    const plaintext = 'fallback-secret';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });
});

// ==================== Secret Reference Parsing ====================

describe('SecretsService - Secret Reference Parsing', () => {
  describe('extractSecretRefs (static)', () => {
    it('should extract simple secret reference', () => {
      const refs = SecretsService.extractSecretRefs('use ${secrets.API_KEY} here');
      expect(refs).toHaveLength(1);
      expect(refs[0].name).toBe('API_KEY');
      expect(refs[0].ref).toBe('${secrets.API_KEY}');
      expect(refs[0].defaultValue).toBeUndefined();
    });

    it('should extract secret reference with default value', () => {
      const refs = SecretsService.extractSecretRefs('${secrets.DB_PASSWORD:default123}');
      expect(refs).toHaveLength(1);
      expect(refs[0].name).toBe('DB_PASSWORD');
      expect(refs[0].defaultValue).toBe('default123');
    });

    it('should extract multiple secret references', () => {
      const refs = SecretsService.extractSecretRefs(
        'key=${secrets.KEY1} pass=${secrets.PASS:fallback}',
      );
      expect(refs).toHaveLength(2);
      expect(refs[0].name).toBe('KEY1');
      expect(refs[1].name).toBe('PASS');
      expect(refs[1].defaultValue).toBe('fallback');
    });

    it('should return empty for no references', () => {
      const refs = SecretsService.extractSecretRefs('no secrets here');
      expect(refs).toHaveLength(0);
    });

    it('should not match invalid patterns', () => {
      // Must start with letter or underscore
      const refs1 = SecretsService.extractSecretRefs('${secrets.123_INVALID}');
      expect(refs1).toHaveLength(0);

      // Must not have spaces
      const refs2 = SecretsService.extractSecretRefs('${secrets.MY KEY}');
      expect(refs2).toHaveLength(0);
    });
  });

  describe('resolveSecretRefs', () => {
    it('should resolve secret references in env values', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockImplementation(async (text: string) => {
        if (text.includes('WHERE tenant_id')) {
          // Return a secret
          const encrypted = Buffer.from('encrypted-data');
          return {
            rows: [{
              id: 'sec-1',
              tenant_id: 'tenant-1',
              name: 'API_KEY',
              encrypted_value: encrypted,
              scope: 'project',
              created_at: new Date(),
              updated_at: new Date(),
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');
      // Override decrypt to return a known value for testing
      const originalDecrypt = service.decrypt.bind(service);
      jest.spyOn(service, 'decrypt').mockReturnValue('actual-api-key-value');

      const result = await service.resolveSecretRefs('tenant-1', {
        API_TOKEN: '${secrets.API_KEY}',
        NORMAL_VAR: 'no-secret-here',
      });

      expect(result.resolvedEnv.API_TOKEN).toBe('actual-api-key-value');
      expect(result.resolvedEnv.NORMAL_VAR).toBe('no-secret-here');
      expect(result.resolvedValues).toContain('actual-api-key-value');
      expect(result.unresolvedRefs).toHaveLength(0);
    });

    it('should use default value for unresolved secrets', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      const result = await service.resolveSecretRefs('tenant-1', {
        CONFIG: '${secrets.MISSING:default-value}',
      });

      expect(result.resolvedEnv.CONFIG).toBe('default-value');
      expect(result.unresolvedRefs).toHaveLength(0);
    });

    it('should track unresolved references without default', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      const result = await service.resolveSecretRefs('tenant-1', {
        CONFIG: '${secrets.MISSING}',
      });

      expect(result.resolvedEnv.CONFIG).toBe('${secrets.MISSING}');
      expect(result.unresolvedRefs).toContain('MISSING');
    });

    it('should handle embedded secret references in longer strings', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');
      jest.spyOn(service, 'getSecret').mockResolvedValue({
        id: '1', name: 'USER', value: 'admin', scope: 'project',
        createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.resolveSecretRefs('tenant-1', {
        CONNECTION: 'postgres://${secrets.USER}:pass@localhost/db',
      });

      expect(result.resolvedEnv.CONNECTION).toBe('postgres://admin:pass@localhost/db');
    });
  });

  describe('resolveTaskSecrets', () => {
    it('should resolve both env references and secrets array', async () => {
      const mockDb = createMockDb();
      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      jest.spyOn(service, 'getSecret').mockImplementation(async (_, name) => {
        const values: Record<string, string> = {
          API_KEY: 'key-123',
          DB_PASS: 'pass-456',
        };
        return values[name] ? {
          id: '1', name, value: values[name], scope: 'project',
          createdAt: new Date(), updatedAt: new Date(),
        } : null;
      });

      const result = await service.resolveTaskSecrets('tenant-1', {
        env: { TOKEN: '${secrets.API_KEY}' },
        secrets: ['DB_PASS'],
      });

      expect(result.env.TOKEN).toBe('key-123');
      expect(result.env.DB_PASS).toBe('pass-456');
      expect(result.secretValues).toContain('key-123');
      expect(result.secretValues).toContain('pass-456');
    });
  });
});

// ==================== Log Sanitization ====================

describe('StreamSecretSanitizer', () => {
  it('should replace secret values with ***', () => {
    const sanitizer = new StreamSecretSanitizer(['my-secret-key', 'password123']);

    const input = 'Connecting with my-secret-key to server';
    const output = sanitizer.sanitize(input);

    expect(output).toBe('Connecting with *** to server');
  });

  it('should handle multiple secrets in one line', () => {
    const sanitizer = new StreamSecretSanitizer(['key-abc', 'pass-xyz']);

    const input = 'auth: key-abc, pass: pass-xyz';
    const output = sanitizer.sanitize(input);

    expect(output).toBe('auth: ***, pass: ***');
  });

  it('should handle empty secret values list', () => {
    const sanitizer = new StreamSecretSanitizer([]);
    expect(sanitizer.sanitize('some log line')).toBe('some log line');
  });

  it('should handle empty string secret values', () => {
    const sanitizer = new StreamSecretSanitizer(['real-secret', '']);
    expect(sanitizer.sanitize('log with real-secret value')).toBe('log with *** value');
  });

  it('should prioritize longer secrets (avoid partial matches)', () => {
    // 'long-secret-key' contains 'key' - longer should match first
    const sanitizer = new StreamSecretSanitizer(['key', 'long-secret-key']);
    const input = 'using long-secret-key for auth';
    const output = sanitizer.sanitize(input);

    expect(output).toBe('using *** for auth');
  });

  it('should handle batch sanitization', () => {
    const sanitizer = new StreamSecretSanitizer(['token-123']);
    const lines = [
      'Starting with token-123',
      'No secrets here',
      'Another line with token-123',
    ];

    const result = sanitizer.sanitizeBatch(lines);
    expect(result).toEqual([
      'Starting with ***',
      'No secrets here',
      'Another line with ***',
    ]);
  });

  it('should handle special regex characters in secret values', () => {
    const sanitizer = new StreamSecretSanitizer(['key+with*special(chars)']);
    const input = 'found key+with*special(chars) in log';
    const output = sanitizer.sanitize(input);

    // Using split/join, not regex replace, so special chars should be handled literally
    expect(output).toBe('found *** in log');
  });
});

describe('SecretsService.sanitizeLine (static)', () => {
  it('should sanitize a single line', () => {
    const result = SecretsService.sanitizeLine('log with secret-value here', ['secret-value']);
    expect(result).toBe('log with *** here');
  });

  it('should return original if no secrets', () => {
    const result = SecretsService.sanitizeLine('clean log', []);
    expect(result).toBe('clean log');
  });
});

// ==================== CRUD Operations ====================

describe('SecretsService - CRUD', () => {
  describe('createSecret', () => {
    it('should create a secret with encrypted value', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({
        rows: [{
          id: 'sec-1',
          tenant_id: 'tenant-1',
          name: 'MY_SECRET',
          encrypted_value: Buffer.from('encrypted'),
          scope: 'project',
          created_at: new Date(),
          updated_at: new Date(),
          created_by: 'user-1',
        }],
        rowCount: 1,
      });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      const result = await service.createSecret('tenant-1', 'MY_SECRET', 'secret-value', 'project', 'user-1');

      expect(result.name).toBe('MY_SECRET');
      expect(result.scope).toBe('project');
      // Verify the encrypted value was passed to the repository
      expect(mockDb.mock.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([
          expect.any(String),
          'tenant-1',
          'MY_SECRET',
          expect.any(Buffer),
          'project',
          'user-1',
        ]),
      );
    });

    it('should reject invalid secret names', async () => {
      const mockDb = createMockDb();
      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      await expect(service.createSecret('tenant-1', 'invalid-name', 'value')).rejects.toThrow(
        'Invalid secret name',
      );
      await expect(service.createSecret('tenant-1', '123start', 'value')).rejects.toThrow(
        'Invalid secret name',
      );
      await expect(service.createSecret('tenant-1', '', 'value')).rejects.toThrow(
        'Secret name must be a non-empty string',
      );
    });

    it('should accept valid secret names', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({
        rows: [{ id: '1', tenant_id: 't1', name: 'VALID_NAME', encrypted_value: Buffer.from('x'), scope: 'project', created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
      });
      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      // These should not throw
      await service.createSecret('t1', 'VALID_NAME', 'value');
      await service.createSecret('t1', '_underscore_start', 'value');
      await service.createSecret('t1', 'camelCase123', 'value');
    });
  });

  describe('getSecret', () => {
    it('should return null for non-existent secret', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      const result = await service.getSecret('tenant-1', 'NONEXISTENT');
      expect(result).toBeNull();
    });

    it('should decrypt and return secret value', async () => {
      const mockDb = createMockDb();
      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');
      const encrypted = service.encrypt('my-actual-value');

      mockDb.mock.query.mockResolvedValue({
        rows: [{
          id: 'sec-1',
          tenant_id: 'tenant-1',
          name: 'MY_SECRET',
          encrypted_value: encrypted,
          scope: 'project',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await service.getSecret('tenant-1', 'MY_SECRET');

      expect(result).not.toBeNull();
      expect(result!.value).toBe('my-actual-value');
      expect(result!.name).toBe('MY_SECRET');
    });

    it('should throw on decryption failure', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({
        rows: [{
          id: 'sec-1',
          tenant_id: 'tenant-1',
          name: 'CORRUPT',
          encrypted_value: Buffer.from('not-valid-encrypted-data'),
          scope: 'project',
          created_at: new Date(),
          updated_at: new Date(),
        }],
        rowCount: 1,
      });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      await expect(service.getSecret('tenant-1', 'CORRUPT')).rejects.toThrow(
        'Failed to decrypt secret',
      );
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret by id', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      const result = await service.deleteSecret('sec-1');
      expect(result).toBe(true);
    });
  });

  describe('listSecrets', () => {
    it('should list secrets without values', async () => {
      const mockDb = createMockDb();
      mockDb.mock.query.mockResolvedValue({
        rows: [
          { id: '1', tenant_id: 't1', name: 'SECRET_A', scope: 'project', created_at: new Date(), updated_at: new Date(), created_by: 'user1' },
          { id: '2', tenant_id: 't1', name: 'SECRET_B', scope: 'environment', created_at: new Date(), updated_at: new Date(), created_by: 'user2' },
        ],
        rowCount: 2,
      });

      const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

      const result = await service.listSecrets('t1');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('SECRET_A');
      expect(result[0].scope).toBe('project');
      // No value field in list response
      expect((result[0] as any).value).toBeUndefined();
    });
  });
});

// ==================== Security Tests ====================

describe('SecretsService - Security', () => {
  it('should validate secret name length', async () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');
    mockDb.mock.query.mockResolvedValue({ rows: [], rowCount: 0 });

    const longName = 'A'.repeat(256);
    await expect(service.createSecret('t1', longName, 'value')).rejects.toThrow(
      '255 characters or less',
    );
  });

  it('should prevent path traversal in secret names', async () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

    await expect(service.createSecret('t1', '../etc/passwd', 'value')).rejects.toThrow(
      'Invalid secret name',
    );
  });

  it('should prevent SQL injection in secret names', async () => {
    const mockDb = createMockDb();
    const service = createService(mockDb, 'test-key-32-bytes-long-1234567890');

    // SQL injection attempts would fail the name validation regex
    await expect(service.createSecret('t1', "name'; DROP TABLE secrets;--", 'value')).rejects.toThrow(
      'Invalid secret name',
    );
  });
});

// ==================== Production Key Requirement ====================

describe('SecretsService - Production Encryption Key', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('throws in production without encryption key', () => {
    process.env.NODE_ENV = 'production';
    const mockDb = createMockDb();

    expect(() => {
      createService(mockDb, undefined);
    }).toThrow('ORION_SECRET_ENCRYPTION_KEY is required in production');
  });

  it('allows fallback key in development mode', () => {
    process.env.NODE_ENV = 'development';
    const mockDb = createMockDb();

    // Should not throw
    const service = createService(mockDb, undefined);
    const plaintext = 'dev-secret';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
