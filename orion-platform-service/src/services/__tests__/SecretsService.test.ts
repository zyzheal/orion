/**
 * SecretsService 单元测试
 */

import { SecretsService, StreamSecretSanitizer } from '../../services/pipeline/SecretsService';
import { SecretRepository } from '../../repositories/SecretRepository';

describe('SecretsService', () => {
  let service: SecretsService;
  let mockDb: any;
  let mockRepo: SecretRepository;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockRepo = new SecretRepository(mockDb);
    service = new SecretsService(mockRepo, 'test-master-key-32-chars-long!!');
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt a value', () => {
      const plaintext = 'my-secret-value';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'my-secret-value';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1.iv.toString('hex')).not.toBe(encrypted2.iv.toString('hex'));
    });

    it('should serialize and deserialize encrypted values', () => {
      const plaintext = 'test-value';
      const encrypted = service.encrypt(plaintext);
      const buffer = service.serializeToBuffer(encrypted);
      const deserialized = service.deserializeFromBuffer(buffer);
      const decrypted = service.decrypt(deserialized);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('createSecret / getSecret', () => {
    it('should create and retrieve a secret', async () => {
      const tenantId = 'tenant-1';
      const name = 'MY_SECRET';
      const value = 'secret-value-123';

      let storedEntity: any = null;
      mockRepo.upsert = jest.fn(async (data: any) => {
        storedEntity = data;
        return {
          id: 'secret-1',
          tenantId,
          name,
          encryptedValue: data.encryptedValue,
          scope: data.scope || 'project',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      mockRepo.findByTenantAndName = jest.fn(async () => {
        if (storedEntity) {
          return storedEntity;
        }
        return undefined;
      });

      await service.createSecret(tenantId, name, value);
      const retrieved = await service.getSecret(tenantId, name);
      expect(retrieved).toBe(value);
    });

    it('should return null for non-existent secret', async () => {
      mockRepo.findByTenantAndName = jest.fn(async () => undefined);
      const result = await service.getSecret('tenant-1', 'NONEXISTENT');
      expect(result).toBeNull();
    });
  });

  describe('listSecrets', () => {
    it('should list secret names without values', async () => {
      mockRepo.listByTenantAndScope = jest.fn(async () => [
        { id: '1', tenant_id: 't1', name: 'SECRET_A', scope: 'project', created_at: new Date(), updated_at: new Date() },
        { id: '2', tenant_id: 't1', name: 'SECRET_B', scope: 'project', created_at: new Date(), updated_at: new Date() },
      ]);

      const secrets = await service.listSecrets('tenant-1');
      expect(secrets).toHaveLength(2);
      expect(secrets[0].name).toBe('SECRET_A');
      expect(secrets[1].name).toBe('SECRET_B');
    });
  });

  describe('resolveAndReplaceSecrets', () => {
    const secrets: Record<string, string> = {
      API_KEY: 'real-api-key-123',
      DB_PASSWORD: 'super-secret-password',
    };

    beforeEach(() => {
      service.getSecret = jest.fn(async (_tenantId: string, name: string) => {
        return secrets[name] || null;
      });
    });

    it('should resolve ${secrets.XXX} in string values', async () => {
      const params = {
        apiKey: '${secrets.API_KEY}',
        password: '${secrets.DB_PASSWORD}',
      };

      const result = await service.resolveAndReplaceSecrets('tenant-1', params);

      expect(result.parameters.apiKey).toBe('real-api-key-123');
      expect(result.parameters.password).toBe('super-secret-password');
      expect(result.secretValues).toHaveLength(2);
      expect(result.unresolved).toHaveLength(0);
    });

    it('should resolve secrets in nested objects', async () => {
      const params = {
        huawei: {
          clientId: '${secrets.API_KEY}',
          clientSecret: '${secrets.DB_PASSWORD}',
        },
      };

      const result = await service.resolveAndReplaceSecrets('tenant-1', params);

      expect((result.parameters as any).huawei.clientId).toBe('real-api-key-123');
      expect((result.parameters as any).huawei.clientSecret).toBe('super-secret-password');
    });

    it('should resolve secrets in arrays', async () => {
      const params = {
        keys: ['${secrets.API_KEY}', '${secrets.DB_PASSWORD}'],
      };

      const result = await service.resolveAndReplaceSecrets('tenant-1', params);

      expect((result.parameters as any).keys[0]).toBe('real-api-key-123');
      expect((result.parameters as any).keys[1]).toBe('super-secret-password');
    });

    it('should track unresolved references', async () => {
      const params = {
        apiKey: '${secrets.API_KEY}',
        missing: '${secrets.NONEXISTENT}',
      };

      const result = await service.resolveAndReplaceSecrets('tenant-1', params);

      expect(result.parameters.apiKey).toBe('real-api-key-123');
      expect(result.parameters.missing).toBe('${secrets.NONEXISTENT}');
      expect(result.unresolved).toContain('${secrets.NONEXISTENT}');
    });

    it('should cache resolved secrets', async () => {
      const params = {
        key1: '${secrets.API_KEY}',
        key2: '${secrets.API_KEY}',
      };

      await service.resolveAndReplaceSecrets('tenant-1', params);

      expect(service.getSecret).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed strings with secret references and plain text', async () => {
      const params = {
        connectionString: 'postgresql://user:${secrets.DB_PASSWORD}@host:5432/db',
      };

      const result = await service.resolveAndReplaceSecrets('tenant-1', params);

      expect((result.parameters as any).connectionString).toBe(
        'postgresql://user:super-secret-password@host:5432/db'
      );
    });
  });

  describe('StreamSecretSanitizer', () => {
    it('should replace secret values with ***', () => {
      const sanitizer = new StreamSecretSanitizer(['secret-key-123', 'password-456']);

      const input = 'Connecting with key=secret-key-123 and pass=password-456';
      const sanitized = sanitizer.sanitize(input);

      expect(sanitized).toBe('Connecting with key=*** and pass=***');
    });

    it('should handle no secrets', () => {
      const sanitizer = new StreamSecretSanitizer([]);
      const input = 'Normal log message';
      expect(sanitizer.sanitize(input)).toBe(input);
    });

    it('should filter out short values (<4 chars)', () => {
      const sanitizer = new StreamSecretSanitizer(['ab', 'xyz-long']);
      const input = 'ab xyz-long';
      const sanitized = sanitizer.sanitize(input);
      // 'ab' is too short and filtered out, so only 'xyz-long' is masked
      expect(sanitized).toBe('ab ***');
    });
  });

  describe('deleteSecret', () => {
    it('should delete an existing secret', async () => {
      mockRepo.findByTenantAndName = jest.fn(async () => ({
        id: 'secret-1',
        tenant_id: 't1',
        name: 'MY_SECRET',
        scope: 'project',
      }));
      mockRepo.delete = jest.fn(async () => true);

      const result = await service.deleteSecret('t1', 'MY_SECRET');
      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('secret-1');
    });

    it('should return false for non-existent secret', async () => {
      mockRepo.findByTenantAndName = jest.fn(async () => undefined);

      const result = await service.deleteSecret('t1', 'NONEXISTENT');
      expect(result).toBe(false);
    });
  });
});
