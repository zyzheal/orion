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