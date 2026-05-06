/**
 * K8sSecretKeyStorage Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { K8sSecretKeyStorage } from '../K8sSecretKeyStorage';
import type { JwtKey } from '../JwtKeyRotationService';

// Mock Kubernetes client
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: jest.fn(),
    makeApiClient: jest.fn().mockReturnValue({
      readNamespacedSecret: jest.fn(),
      createNamespacedSecret: jest.fn(),
      replaceNamespacedSecret: jest.fn(),
    }),
  })),
  CoreV1Api: jest.fn(),
}));

describe('K8sSecretKeyStorage', () => {
  let storage: K8sSecretKeyStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new K8sSecretKeyStorage({
      namespace: 'orion',
      secretName: 'orion-jwt-keys',
    });
  });

  describe('isAvailable', () => {
    it('should return true when K8s client initialized', () => {
      expect(storage.isAvailable()).toBe(true);
    });
  });

  describe('loadKeys', () => {
    it('should return empty array when secret not found', async () => {
      // Mock 404 response
      const mockApi = storage['k8sApi'] as any;
      mockApi.readNamespacedSecret.mockRejectedValue({ statusCode: 404 });

      const keys = await storage.loadKeys();
      expect(keys).toEqual([]);
    });

    it('should parse keys from secret data', async () => {
      const mockKey: JwtKey = {
        keyId: 'jwt_key_123',
        keyHash: 'abc123',
        keyStrength: '256-bit',
        status: 'active',
        createdAt: new Date('2026-05-01'),
        activatedAt: new Date('2026-05-01'),
        expiresAt: new Date('2026-07-30'),
      };

      // Encode key data: keyHash,keyStrength,status,createdAt,activatedAt,expiresAt
      const keyData = Buffer.from([
        mockKey.keyHash,
        mockKey.keyStrength,
        mockKey.status,
        mockKey.createdAt.toISOString(),
        mockKey.activatedAt.toISOString(),
        mockKey.expiresAt.toISOString(),
      ].join(',')).toString('base64');

      const mockApi = storage['k8sApi'] as any;
      mockApi.readNamespacedSecret.mockResolvedValue({
        body: {
          data: {
            [mockKey.keyId]: keyData,
          },
        },
        // Also set data at top level since loadKeys reads response.data
        data: {
          [mockKey.keyId]: keyData,
        },
      });

      const keys = await storage.loadKeys();
      expect(keys.length).toBe(1);
      expect(keys[0].keyId).toBe(mockKey.keyId);
      expect(keys[0].keyHash).toBe(mockKey.keyHash);
      expect(keys[0].status).toBe('active');
    });
  });

  describe('storeKey', () => {
    it('should create new secret if not exists', async () => {
      const mockKey: JwtKey = {
        keyId: 'jwt_key_new',
        keyHash: 'newhash',
        keyStrength: '256-bit',
        status: 'pending',
        createdAt: new Date(),
      };

      const mockApi = storage['k8sApi'] as any;
      mockApi.readNamespacedSecret.mockRejectedValue({ statusCode: 404 });
      mockApi.createNamespacedSecret.mockResolvedValue({});

      await storage.storeKey(mockKey);

      expect(mockApi.createNamespacedSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: 'orion',
          body: expect.objectContaining({
            metadata: expect.objectContaining({
              name: 'orion-jwt-keys',
            }),
          }),
        })
      );
    });

    it('should update existing secret', async () => {
      const mockKey: JwtKey = {
        keyId: 'jwt_key_update',
        keyHash: 'updatehash',
        keyStrength: '256-bit',
        status: 'active',
        createdAt: new Date(),
      };

      const mockApi = storage['k8sApi'] as any;
      mockApi.readNamespacedSecret.mockResolvedValue({
        body: {
          data: { existing_key: 'existingdata' },
        },
        data: { existing_key: 'existingdata' },
      });
      mockApi.replaceNamespacedSecret.mockResolvedValue({});

      await storage.storeKey(mockKey);

      expect(mockApi.replaceNamespacedSecret).toHaveBeenCalled();
    });
  });

  describe('updateKey', () => {
    it('should update key status', async () => {
      const mockKey: JwtKey = {
        keyId: 'jwt_key_update',
        keyHash: 'updatehash',
        keyStrength: '256-bit',
        status: 'expiring',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const mockApi = storage['k8sApi'] as any;
      mockApi.readNamespacedSecret.mockResolvedValue({
        body: {
          data: { [mockKey.keyId]: 'olddata' },
        },
        data: { [mockKey.keyId]: 'olddata' },
      });
      mockApi.replaceNamespacedSecret.mockResolvedValue({});

      await storage.updateKey(mockKey);

      expect(mockApi.replaceNamespacedSecret).toHaveBeenCalled();
    });
  });

  describe('deleteKey', () => {
    it('should remove key from secret', async () => {
      const mockApi = storage['k8sApi'] as any;
      mockApi.readNamespacedSecret.mockResolvedValue({
        body: {
          data: {
            jwt_key_old: 'olddata',
            jwt_key_current: 'currentdata',
          },
        },
        data: {
          jwt_key_old: 'olddata',
          jwt_key_current: 'currentdata',
        },
      });
      mockApi.replaceNamespacedSecret.mockResolvedValue({});

      await storage.deleteKey('jwt_key_old');

      // The API uses a single object parameter { name, namespace, body }
      expect(mockApi.replaceNamespacedSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'orion-jwt-keys',
          namespace: 'orion',
          body: expect.objectContaining({
            data: expect.not.objectContaining({
              jwt_key_old: expect.anything(),
            }),
          }),
        })
      );
    });
  });

  describe('getSecretEnvVars', () => {
    it('should return environment variable references', () => {
      const envVars = storage.getSecretEnvVars();

      expect(envVars.length).toBe(2);
      expect(envVars[0].name).toBe('JWT_CURRENT_KEY_ID');
      expect(envVars[0].valueFrom.secretKeyRef.name).toBe('orion-jwt-keys');
      expect(envVars[1].name).toBe('JWT_CURRENT_KEY_HASH');
    });
  });

  describe('encodeKeyData', () => {
    it('should encode key to base64', () => {
      const key: JwtKey = {
        keyId: 'test_key',
        keyHash: 'testhash',
        keyStrength: '256-bit',
        status: 'active',
        createdAt: new Date('2026-05-04T00:00:00Z'),
      };

      const encoded = storage['encodeKeyData'](key);
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

      expect(decoded).toContain('testhash');
      expect(decoded).toContain('active');
      expect(decoded).toContain('2026-05-04');
    });
  });
});