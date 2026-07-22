/**
 * VectorStoreService Tests
 * Covers CRUD operations, validation, and error handling
 */

import { VectorStoreService } from '../VectorStoreService';
import { OrionError } from '../../../errors';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockRuleRepo = {
  findByTenant: jest.fn(),
  findByIdAndTenant: jest.fn(),
  createForTenant: jest.fn(),
  updateByIdAndTenant: jest.fn(),
  deleteByIdAndTenant: jest.fn(),
  toggleEnabled: jest.fn(),
};

const mockCollectionRepo = {
  findByTenant: jest.fn(),
  findByIdAndTenant: jest.fn(),
  createForTenant: jest.fn(),
  deleteByIdAndTenant: jest.fn(),
  updateVectorCount: jest.fn(),
};

let service: VectorStoreService;

const mockRule = {
  id: 'rule-1',
  tenantId: 'test-tenant',
  name: 'Auto-vectorize PDFs',
  sourceType: 'upload',
  fileTypes: ['pdf'],
  chunkSize: 512,
  chunkOverlap: 50,
  embeddingModel: 'text-embedding-3-small',
  targetCollection: 'docs',
  enabled: true,
  lastRun: null,
  processedCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCollection = {
  id: 'col-1',
  tenantId: 'test-tenant',
  name: 'docs',
  displayName: 'Documents',
  description: 'Document embeddings',
  dimensions: 1536,
  indexType: 'hnsw',
  distanceMetric: 'cosine',
  status: 'active',
  documentCount: 42,
  parameters: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  service = new VectorStoreService(
    mockRuleRepo as any,
    mockCollectionRepo as any,
  );
});

describe('VectorStoreService', () => {
  // ==================== Rules ====================
  describe('listRules', () => {
    it('should delegate to ruleRepo.findByTenant', async () => {
      mockRuleRepo.findByTenant.mockResolvedValue([mockRule]);
      const result = await service.listRules();
      expect(result).toHaveLength(1);
      expect(mockRuleRepo.findByTenant).toHaveBeenCalledWith('test-tenant', undefined);
    });

    it('should pass filters to repository', async () => {
      mockRuleRepo.findByTenant.mockResolvedValue([]);
      await service.listRules({ enabled: true, sourceType: 'git' });
      expect(mockRuleRepo.findByTenant).toHaveBeenCalledWith('test-tenant', { enabled: true, sourceType: 'git' });
    });
  });

  describe('getRule', () => {
    it('should return rule when found', async () => {
      mockRuleRepo.findByIdAndTenant.mockResolvedValue(mockRule);
      const result = await service.getRule('rule-1');
      expect(result.id).toBe('rule-1');
      expect(mockRuleRepo.findByIdAndTenant).toHaveBeenCalledWith('rule-1', 'test-tenant');
    });

    it('should throw NOT_FOUND when rule missing', async () => {
      mockRuleRepo.findByIdAndTenant.mockResolvedValue(undefined);
      await expect(service.getRule('missing')).rejects.toThrow(OrionError);
      await expect(service.getRule('missing')).rejects.toThrow('not found');
    });
  });

  describe('createRule', () => {
    it('should create with defaults when optional fields omitted', async () => {
      mockRuleRepo.createForTenant.mockResolvedValue(mockRule);
      const result = await service.createRule({
        name: 'Auto-vectorize PDFs',
        targetCollection: 'docs',
      });
      expect(mockRuleRepo.createForTenant).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Auto-vectorize PDFs',
        sourceType: 'upload',
        fileTypes: [],
        chunkSize: 512,
        chunkOverlap: 50,
        embeddingModel: 'text-embedding-3-small',
        targetCollection: 'docs',
        enabled: true,
      }));
    });

    it('should throw VALIDATION_ERROR when name is empty', async () => {
      await expect(service.createRule({ name: '', targetCollection: 'docs' })).rejects.toThrow('Rule name is required');
    });

    it('should throw VALIDATION_ERROR when targetCollection is empty', async () => {
      await expect(service.createRule({ name: 'test', targetCollection: '' })).rejects.toThrow('Target collection is required');
    });

    it('should pass all provided fields', async () => {
      mockRuleRepo.createForTenant.mockResolvedValue(mockRule);
      await service.createRule({
        name: 'Git rules',
        sourceType: 'git',
        fileTypes: ['md', 'txt'],
        chunkSize: 1024,
        chunkOverlap: 100,
        embeddingModel: 'custom-model',
        targetCollection: 'git-docs',
        enabled: false,
      });
      expect(mockRuleRepo.createForTenant).toHaveBeenCalledWith(expect.objectContaining({
        sourceType: 'git',
        fileTypes: ['md', 'txt'],
        chunkSize: 1024,
        chunkOverlap: 100,
        embeddingModel: 'custom-model',
        enabled: false,
      }));
    });
  });

  describe('updateRule', () => {
    it('should update and return rule', async () => {
      mockRuleRepo.updateByIdAndTenant.mockResolvedValue({ ...mockRule, name: 'Updated' });
      const result = await service.updateRule('rule-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(mockRuleRepo.updateByIdAndTenant).toHaveBeenCalledWith('rule-1', 'test-tenant', { name: 'Updated' });
    });

    it('should throw NOT_FOUND when rule not found', async () => {
      mockRuleRepo.updateByIdAndTenant.mockResolvedValue(null);
      await expect(service.updateRule('missing', { name: 'x' })).rejects.toThrow('not found');
    });
  });

  describe('deleteRule', () => {
    it('should delete successfully', async () => {
      mockRuleRepo.deleteByIdAndTenant.mockResolvedValue(true);
      await expect(service.deleteRule('rule-1')).resolves.toBeUndefined();
      expect(mockRuleRepo.deleteByIdAndTenant).toHaveBeenCalledWith('rule-1', 'test-tenant');
    });

    it('should throw NOT_FOUND when delete returns false', async () => {
      mockRuleRepo.deleteByIdAndTenant.mockResolvedValue(false);
      await expect(service.deleteRule('missing')).rejects.toThrow('not found');
    });
  });

  describe('toggleRule', () => {
    it('should toggle and return rule', async () => {
      mockRuleRepo.toggleEnabled.mockResolvedValue({ ...mockRule, enabled: false });
      const result = await service.toggleRule('rule-1', false);
      expect(result.enabled).toBe(false);
      expect(mockRuleRepo.toggleEnabled).toHaveBeenCalledWith('rule-1', false, 'test-tenant');
    });

    it('should throw NOT_FOUND when rule not found', async () => {
      mockRuleRepo.toggleEnabled.mockResolvedValue(null);
      await expect(service.toggleRule('missing', true)).rejects.toThrow('not found');
    });
  });

  // ==================== Collections ====================
  describe('listCollections', () => {
    it('should delegate to collectionRepo.findByTenant', async () => {
      mockCollectionRepo.findByTenant.mockResolvedValue([mockCollection]);
      const result = await service.listCollections();
      expect(result).toHaveLength(1);
      expect(mockCollectionRepo.findByTenant).toHaveBeenCalledWith('test-tenant', undefined);
    });

    it('should pass status filter', async () => {
      mockCollectionRepo.findByTenant.mockResolvedValue([]);
      await service.listCollections({ status: 'active' });
      expect(mockCollectionRepo.findByTenant).toHaveBeenCalledWith('test-tenant', { status: 'active' });
    });
  });

  describe('getCollection', () => {
    it('should return collection when found', async () => {
      mockCollectionRepo.findByIdAndTenant.mockResolvedValue(mockCollection);
      const result = await service.getCollection('col-1');
      expect(result.id).toBe('col-1');
      expect(mockCollectionRepo.findByIdAndTenant).toHaveBeenCalledWith('col-1', 'test-tenant');
    });

    it('should throw NOT_FOUND when collection missing', async () => {
      mockCollectionRepo.findByIdAndTenant.mockResolvedValue(undefined);
      await expect(service.getCollection('missing')).rejects.toThrow('not found');
    });
  });

  describe('createCollection', () => {
    it('should create with defaults when optional fields omitted', async () => {
      mockCollectionRepo.createForTenant.mockResolvedValue(mockCollection);
      const result = await service.createCollection({ name: 'docs' });
      expect(mockCollectionRepo.createForTenant).toHaveBeenCalledWith(expect.objectContaining({
        name: 'docs',
        displayName: null,
        description: null,
        dimensions: 1536,
        indexType: 'hnsw',
        distanceMetric: 'cosine',
        status: 'active',
        parameters: {},
      }));
    });

    it('should throw VALIDATION_ERROR when name is empty', async () => {
      await expect(service.createCollection({ name: '' })).rejects.toThrow('Collection name is required');
    });

    it('should pass all provided fields', async () => {
      mockCollectionRepo.createForTenant.mockResolvedValue(mockCollection);
      await service.createCollection({
        name: 'custom',
        displayName: 'Custom Collection',
        description: 'Custom desc',
        dimensions: 768,
        indexType: 'ivf',
        distanceMetric: 'l2',
        status: 'building',
        parameters: { nlist: 100 },
      });
      expect(mockCollectionRepo.createForTenant).toHaveBeenCalledWith(expect.objectContaining({
        displayName: 'Custom Collection',
        dimensions: 768,
        indexType: 'ivf',
        distanceMetric: 'l2',
        status: 'building',
        parameters: { nlist: 100 },
      }));
    });
  });

  describe('deleteCollection', () => {
    it('should delete successfully', async () => {
      mockCollectionRepo.deleteByIdAndTenant.mockResolvedValue(true);
      await expect(service.deleteCollection('col-1')).resolves.toBeUndefined();
      expect(mockCollectionRepo.deleteByIdAndTenant).toHaveBeenCalledWith('col-1', 'test-tenant');
    });

    it('should throw NOT_FOUND when delete returns false', async () => {
      mockCollectionRepo.deleteByIdAndTenant.mockResolvedValue(false);
      await expect(service.deleteCollection('missing')).rejects.toThrow('not found');
    });
  });
});
