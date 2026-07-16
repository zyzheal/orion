/**
 * ApiMarketService Tests
 * Test-driven development: Write test first, watch it fail, then implement
 */

import { ApiMarketService, ApiMarketError } from '../ApiMarketService';
import { ApiMarketRepository } from '../ApiMarketRepository';

// Mock crypto module
jest.mock('crypto', () => {
  let callCount = 0;
  return {
    randomBytes: jest.fn().mockImplementation((length: number) => {
      callCount++;
      const buffer = Buffer.alloc(length);
      // Return different values based on call order
      if (callCount % 2 === 1) {
        buffer.fill('a'); // client_id
      } else {
        buffer.fill('b'); // client_secret
      }
      return buffer;
    }),
    createHash: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('mock-hash-1234567890abcdef1234567890abcdef'),
      }),
    }),
  };
});

describe('ApiMarketService', () => {
  let mockRepository: jest.Mocked<ApiMarketRepository>;
  let service: ApiMarketService;

  beforeEach(() => {
    mockRepository = {
      createProduct: jest.fn(),
      findProductById: jest.fn(),
      findProductBySlug: jest.fn(),
      listProducts: jest.fn(),
      updateProduct: jest.fn(),
      deleteProduct: jest.fn(),
      createApp: jest.fn(),
      findAppById: jest.fn(),
      listAppsByDeveloper: jest.fn(),
      createCredential: jest.fn(),
      findCredentialByClientId: jest.fn(),
      updateCredentialLastUsed: jest.fn(),
      listCredentialsByApp: jest.fn(),
      updateApp: jest.fn(),
      findSubscription: jest.fn(),
      createSubscription: jest.fn(),
      listSubscriptionsByApp: jest.fn(),
      findCredentialById: jest.fn(),
    } as unknown as jest.Mocked<ApiMarketRepository>;

    service = new ApiMarketService(mockRepository);
  });

  describe('createProduct', () => {
    it('should create product with auto-generated slug', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Test API',
        slug: 'test-api',
        description: 'Test description',
        owner_id: 'user-1',
        status: 'draft',
        version: '1.0.0',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.createProduct.mockResolvedValue(mockProduct);
      mockRepository.findProductBySlug.mockResolvedValue(null);

      const result = await service.createProduct({
        name: 'Test API',
        description: 'Test description',
        ownerId: 'user-1',
      });

      expect(result.slug).toBe('test-api');
      expect(mockRepository.createProduct).toHaveBeenCalled();
    });

    it('should reject duplicate slug with number suffix', async () => {
      mockRepository.findProductBySlug
        .mockResolvedValueOnce({ id: 'prod-1', slug: 'test-api' } as any)
        .mockResolvedValueOnce(null);

      const mockProduct = {
        id: 'prod-2',
        name: 'Test API',
        slug: 'test-api-2',
        description: 'Test description',
        owner_id: 'user-1',
        status: 'draft',
        version: '1.0.0',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.createProduct.mockResolvedValue(mockProduct);

      const result = await service.createProduct({
        name: 'Test API',
        ownerId: 'user-1',
      });

      expect(result.slug).toBe('test-api-2');
    });

    it('should throw when name is missing', async () => {
      await expect(service.createProduct({
        name: '',
        ownerId: 'user-1',
      })).rejects.toThrow(ApiMarketError);
    });
  });

  describe('publishProduct', () => {
    it('should publish product with status update', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Test API',
        slug: 'test-api',
        status: 'published',
        owner_id: 'user-1',
        version: '1.0.0',
      };
      mockRepository.findProductById.mockResolvedValue(mockProduct as any);
      mockRepository.updateProduct.mockResolvedValue({ ...mockProduct, status: 'published' } as any);

      const result = await service.publishProduct('prod-1');

      expect(result.status).toBe('published');
      expect(mockRepository.updateProduct).toHaveBeenCalledWith('prod-1', { status: 'published' });
    });

    it('should throw when product not found', async () => {
      mockRepository.findProductById.mockResolvedValue(null);

      await expect(service.publishProduct('non-existent'))
        .rejects.toThrow(ApiMarketError);
    });
  });

  describe('listProducts', () => {
    it('should return all products', async () => {
      const mockProducts = [
        { id: 'prod-1', name: 'API 1', slug: 'api-1', status: 'published' },
        { id: 'prod-2', name: 'API 2', slug: 'api-2', status: 'draft' },
      ];
      mockRepository.listProducts.mockResolvedValue(mockProducts as any);

      const result = await service.listProducts();

      expect(result).toHaveLength(2);
      expect(mockRepository.listProducts).toHaveBeenCalled();
    });
  });

  describe('createDeveloperApp', () => {
    it('should create developer app', async () => {
      const mockApp = {
        id: 'app-1',
        developer_id: 'user-1',
        name: 'My App',
        description: 'Test app',
        redirect_uris: ['https://example.com/callback'],
        status: 'active',
        created_at: new Date(),
      };
      mockRepository.createApp.mockResolvedValue(mockApp as any);

      const result = await service.createDeveloperApp({
        developerId: 'user-1',
        name: 'My App',
        description: 'Test app',
        redirectUris: ['https://example.com/callback'],
      });

      expect(result.name).toBe('My App');
      expect(mockRepository.createApp).toHaveBeenCalled();
    });
  });

  describe('generateApiKey', () => {
    it('should generate API key with SHA256 hash', async () => {
      const mockApp = {
        id: 'app-1',
        developer_id: 'user-1',
        name: 'My App',
        status: 'active',
      };
      mockRepository.findAppById.mockResolvedValue(mockApp as any);
      mockRepository.findCredentialByClientId.mockResolvedValue(null);
      mockRepository.createCredential.mockResolvedValue({
        id: 'cred-1',
        app_id: 'app-1',
        client_id: 'mock-key-hex',
        client_secret_hash: 'mock-hash-1234567890abcdef1234567890abcdef',
        scopes: ['read'],
        rate_limit_per_min: 100,
        created_at: new Date(),
      } as any);

      const result = await service.generateApiKey('app-1', ['read']);

      expect(result.clientId).toBeDefined();
      expect(result.clientSecret).toBeDefined();
      expect(result.clientSecret).not.toBe(result.clientId);
    });

    it('should throw when app not found', async () => {
      mockRepository.createCredential.mockRejectedValue(new Error('app not found'));

      await expect(service.generateApiKey('non-existent', []))
        .rejects.toThrow();
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key and update last_used', async () => {
      const mockCredential = {
        id: 'cred-1',
        app_id: 'app-1',
        client_id: 'valid-client-id',
        client_secret_hash: 'mock-hash-1234567890abcdef1234567890abcdef',
        scopes: ['read', 'write'],
        rate_limit_per_min: 100,
        expires_at: new Date(Date.now() + 86400000), // 24h from now
        last_used_at: null,
        created_at: new Date(),
      };
      mockRepository.findCredentialByClientId.mockResolvedValue(mockCredential as any);
      mockRepository.updateCredentialLastUsed.mockResolvedValue(true);

      const result = await service.validateApiKey('valid-client-id', 'valid-secret');

      expect(result).toBeDefined();
      expect(result?.scopes).toContain('read');
      expect(mockRepository.updateCredentialLastUsed).toHaveBeenCalled();
    });

    it('should return null for invalid key', async () => {
      mockRepository.findCredentialByClientId.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid', 'invalid');

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const mockCredential = {
        id: 'cred-1',
        client_id: 'expired-client-id',
        client_secret_hash: 'hash',
        expires_at: new Date(Date.now() - 86400000), // expired yesterday
      };
      mockRepository.findCredentialByClientId.mockResolvedValue(mockCredential as any);

      const result = await service.validateApiKey('expired-client-id', 'secret');

      expect(result).toBeNull();
    });
  });

  describe('getProduct', () => {
    it('should return product by id', async () => {
      const mockProduct = { id: 'prod-1', name: 'Test API' };
      mockRepository.findProductById.mockResolvedValue(mockProduct as any);

      const result = await service.getProduct('prod-1');
      expect(result).toEqual(mockProduct);
      expect(mockRepository.findProductById).toHaveBeenCalledWith('prod-1');
    });

    it('should return null when product not found', async () => {
      mockRepository.findProductById.mockResolvedValue(null);
      const result = await service.getProduct('missing');
      expect(result).toBeNull();
    });
  });

  describe('getProductBySlug', () => {
    it('should return product by slug', async () => {
      const mockProduct = { id: 'prod-1', slug: 'test-api' };
      mockRepository.findProductBySlug.mockResolvedValue(mockProduct as any);

      const result = await service.getProductBySlug('test-api');
      expect(result).toEqual(mockProduct);
    });

    it('should return null when slug not found', async () => {
      mockRepository.findProductBySlug.mockResolvedValue(null);
      const result = await service.getProductBySlug('missing');
      expect(result).toBeNull();
    });
  });

  describe('updateProduct', () => {
    it('should update product fields', async () => {
      const mockProduct = { id: 'prod-1', name: 'Updated' };
      mockRepository.updateProduct.mockResolvedValue(mockProduct as any);

      const result = await service.updateProduct('prod-1', { name: 'Updated' });
      expect(result).toEqual(mockProduct);
      expect(mockRepository.updateProduct).toHaveBeenCalledWith('prod-1', { name: 'Updated' });
    });

    it('should return null when product not found', async () => {
      mockRepository.updateProduct.mockResolvedValue(null);
      const result = await service.updateProduct('missing', { name: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('deleteProduct', () => {
    it('should return true when deleted', async () => {
      mockRepository.deleteProduct.mockResolvedValue(true);
      expect(await service.deleteProduct('prod-1')).toBe(true);
    });

    it('should return false when not found', async () => {
      mockRepository.deleteProduct.mockResolvedValue(false);
      expect(await service.deleteProduct('missing')).toBe(false);
    });
  });

  describe('publishProduct - update failure', () => {
    it('should throw when update returns null', async () => {
      mockRepository.findProductById.mockResolvedValue({ id: 'prod-1' } as any);
      mockRepository.updateProduct.mockResolvedValue(null);

      await expect(service.publishProduct('prod-1')).rejects.toThrow(ApiMarketError);
    });
  });

  describe('listAppsByDeveloper', () => {
    it('should return apps for developer', async () => {
      const mockApps = [{ id: 'app-1' }, { id: 'app-2' }];
      mockRepository.listAppsByDeveloper.mockResolvedValue(mockApps as any);

      const result = await service.listAppsByDeveloper('dev-1');
      expect(result).toHaveLength(2);
      expect(mockRepository.listAppsByDeveloper).toHaveBeenCalledWith('dev-1');
    });
  });

  describe('getApp', () => {
    it('should return app by id', async () => {
      const mockApp = { id: 'app-1', name: 'My App' };
      mockRepository.findAppById.mockResolvedValue(mockApp as any);

      const result = await service.getApp('app-1');
      expect(result).toEqual(mockApp);
    });

    it('should return null when app not found', async () => {
      mockRepository.findAppById.mockResolvedValue(null);
      const result = await service.getApp('missing');
      expect(result).toBeNull();
    });
  });

  describe('generateApiKey - retry logic', () => {
    it('should throw APP_NOT_FOUND when app does not exist', async () => {
      mockRepository.findAppById.mockResolvedValue(null);

      await expect(service.generateApiKey('missing-app', ['read']))
        .rejects.toThrow(ApiMarketError);
    });

    it('should retry on unique constraint violation and succeed', async () => {
      const mockApp = { id: 'app-1', status: 'active' };
      mockRepository.findAppById.mockResolvedValue(mockApp as any);

      // First call throws unique constraint error, second succeeds
      mockRepository.createCredential
        .mockRejectedValueOnce({ code: '23505', message: 'unique violation' })
        .mockResolvedValueOnce({ id: 'cred-1' } as any);

      const result = await service.generateApiKey('app-1', ['read']);
      expect(result.clientId).toBeDefined();
      expect(mockRepository.createCredential).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      const mockApp = { id: 'app-1', status: 'active' };
      mockRepository.findAppById.mockResolvedValue(mockApp as any);

      // All 3 attempts throw unique constraint error - last attempt throws original error
      const uniqueError = Object.assign(new Error('unique violation'), { code: '23505' });
      mockRepository.createCredential.mockRejectedValue(uniqueError);

      await expect(service.generateApiKey('app-1', ['read']))
        .rejects.toThrow('unique violation');
      expect(mockRepository.createCredential).toHaveBeenCalledTimes(3);
    });

    it('should throw non-unique errors immediately', async () => {
      const mockApp = { id: 'app-1', status: 'active' };
      mockRepository.findAppById.mockResolvedValue(mockApp as any);
      mockRepository.createCredential.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.generateApiKey('app-1', ['read']))
        .rejects.toThrow('DB connection failed');
    });
  });

  describe('validateApiKey - wrong secret', () => {
    it('should return null when secret does not match', async () => {
      const mockCredential = {
        id: 'cred-1',
        app_id: 'app-1',
        client_id: 'client-1',
        client_secret_hash: 'different-hash',
        scopes: ['read'],
        rate_limit_per_min: 100,
        expires_at: new Date(Date.now() + 86400000),
      };
      mockRepository.findCredentialByClientId.mockResolvedValue(mockCredential as any);

      const result = await service.validateApiKey('client-1', 'wrong-secret');
      expect(result).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('should create subscription', async () => {
      mockRepository.findSubscription.mockResolvedValue(null);
      mockRepository.createSubscription.mockResolvedValue({ id: 'sub-1' } as any);

      await service.subscribe('app-1', 'prod-1', 'basic', 5000);
      expect(mockRepository.createSubscription).toHaveBeenCalledWith('app-1', 'prod-1', 'basic', 5000);
    });

    it('should throw when already subscribed', async () => {
      mockRepository.findSubscription.mockResolvedValue({ id: 'sub-1' } as any);

      await expect(service.subscribe('app-1', 'prod-1', 'basic'))
        .rejects.toThrow(ApiMarketError);
    });
  });

  describe('checkSubscription', () => {
    it('should return true for active subscription', async () => {
      mockRepository.findSubscription.mockResolvedValue({ status: 'active' } as any);
      expect(await service.checkSubscription('app-1', 'prod-1')).toBe(true);
    });

    it('should return false for inactive subscription', async () => {
      mockRepository.findSubscription.mockResolvedValue({ status: 'cancelled' } as any);
      expect(await service.checkSubscription('app-1', 'prod-1')).toBe(false);
    });

    it('should return false when no subscription', async () => {
      mockRepository.findSubscription.mockResolvedValue(null);
      expect(await service.checkSubscription('app-1', 'prod-1')).toBe(false);
    });
  });

  describe('listSubscriptions', () => {
    it('should return subscriptions for app', async () => {
      const mockSubs = [{ id: 'sub-1' }, { id: 'sub-2' }];
      mockRepository.listSubscriptionsByApp.mockResolvedValue(mockSubs as any);

      const result = await service.listSubscriptions('app-1');
      expect(result).toHaveLength(2);
      expect(mockRepository.listSubscriptionsByApp).toHaveBeenCalledWith('app-1');
    });
  });

  describe('listApiKeys', () => {
    it('should return credentials for app', async () => {
      const mockCreds = [{ id: 'cred-1' }, { id: 'cred-2' }];
      mockRepository.listCredentialsByApp.mockResolvedValue(mockCreds as any);

      const result = await service.listApiKeys('app-1');
      expect(result).toHaveLength(2);
      expect(mockRepository.listCredentialsByApp).toHaveBeenCalledWith('app-1');
    });
  });

  describe('createDeveloperApp - validation', () => {
    it('should throw when app name is empty', async () => {
      await expect(service.createDeveloperApp({
        developerId: 'dev-1',
        name: '',
      })).rejects.toThrow(ApiMarketError);
    });

    it('should throw when app name is whitespace only', async () => {
      await expect(service.createDeveloperApp({
        developerId: 'dev-1',
        name: '   ',
      })).rejects.toThrow(ApiMarketError);
    });
  });
});

describe('ApiMarketRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: ApiMarketRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new ApiMarketRepository(mockDb as any);
  });

  describe('createProduct', () => {
    it('should insert product and return it', async () => {
      const mockRow = {
        id: 'prod-new',
        name: 'New API',
        slug: 'new-api',
        description: 'Description',
        owner_id: 'user-1',
        status: 'draft',
        version: '1.0.0',
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.createProduct({
        name: 'New API',
        slug: 'new-api',
        description: 'Description',
        ownerId: 'user-1',
        version: '1.0.0',
      });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO api_products');
    });
  });

  describe('findProductBySlug', () => {
    it('should return product when found', async () => {
      const mockRow = { id: 'prod-1', slug: 'test-api' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findProductBySlug('test-api');

      expect(result).toEqual(mockRow);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('slug'),
        ['test-api']
      );
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findProductBySlug('missing');

      expect(result).toBeNull();
    });
  });

  describe('listProducts', () => {
    it('should return all products', async () => {
      const mockRows = [
        { id: 'prod-1', name: 'API 1' },
        { id: 'prod-2', name: 'API 2' },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repository.listProducts();

      expect(result).toEqual(mockRows);
    });
  });
});