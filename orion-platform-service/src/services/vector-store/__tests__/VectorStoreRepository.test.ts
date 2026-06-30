/**
 * VectorStoreRepository Tests
 * Covers VectorizeRuleRepository and VectorCollectionRepository CRUD operations
 */

import { VectorizeRuleRepository, VectorCollectionRepository } from '../VectorStoreRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();

const ruleRow = {
  id: 'rule-1',
  tenant_id: 'test-tenant',
  name: 'Auto-vectorize PDFs',
  source_type: 'upload',
  file_types: ['pdf', 'docx'],
  chunk_size: 512,
  chunk_overlap: 50,
  embedding_model: 'text-embedding-3-small',
  target_collection: 'docs',
  enabled: true,
  last_run: null,
  processed_count: 0,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
};

const collectionRow = {
  id: 'col-1',
  tenant_id: 'test-tenant',
  name: 'docs',
  display_name: 'Documents',
  description: 'Document embeddings',
  dimensions: 1536,
  index_type: 'hnsw',
  distance_metric: 'cosine',
  status: 'active',
  document_count: 42,
  parameters: { ef_construction: 200 },
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
};

describe('VectorizeRuleRepository', () => {
  let repo: VectorizeRuleRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new VectorizeRuleRepository({ query: mockQuery });
  });

  describe('findByTenant', () => {
    it('should query by tenant_id with default ordering', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['test-tenant'],
      );
      expect(mockQuery.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
    });

    it('should add enabled filter', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow] });
      await repo.findByTenant('test-tenant', { enabled: true });
      expect(mockQuery.mock.calls[0][0]).toContain('enabled = $2');
      expect(mockQuery.mock.calls[0][1]).toEqual(['test-tenant', true]);
    });

    it('should add sourceType filter', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow] });
      await repo.findByTenant('test-tenant', { sourceType: 'git' });
      expect(mockQuery.mock.calls[0][0]).toContain('source_type = $2');
      expect(mockQuery.mock.calls[0][1]).toEqual(['test-tenant', 'git']);
    });

    it('should combine enabled and sourceType filters', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.findByTenant('test-tenant', { enabled: false, sourceType: 'api' });
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('enabled = $2');
      expect(sql).toContain('source_type = $3');
      expect(mockQuery.mock.calls[0][1]).toEqual(['test-tenant', false, 'api']);
    });

    it('should return empty array when no results', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('toggleEnabled', () => {
    it('should update enabled status and return entity', async () => {
      mockQuery.mockResolvedValue({ rows: [{ ...ruleRow, enabled: false }], rowCount: 1 });
      const result = await repo.toggleEnabled('rule-1', false, 'test-tenant');
      expect(result?.enabled).toBe(false);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE vectorize_rules SET enabled'),
        [false, 'rule-1', 'test-tenant'],
      );
    });

    it('should return null when rule not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.toggleEnabled('missing', true, 'test-tenant');
      expect(result).toBeNull();
    });
  });

  describe('findByIdAndTenant', () => {
    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow], rowCount: 1 });
      const result = await repo.findByIdAndTenant('rule-1', 'test-tenant');
      expect(result?.name).toBe('Auto-vectorize PDFs');
      expect(result?.tenantId).toBe('test-tenant');
      expect(result?.sourceType).toBe('upload');
      expect(result?.fileTypes).toEqual(['pdf', 'docx']);
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findByIdAndTenant('missing', 'test-tenant');
      expect(result).toBeUndefined();
    });
  });

  describe('deleteByIdAndTenant', () => {
    it('should return true when rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      const result = await repo.deleteByIdAndTenant('rule-1', 'test-tenant');
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM vectorize_rules WHERE id = $1 AND tenant_id = $2'),
        ['rule-1', 'test-tenant'],
      );
    });

    it('should return false when no rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      const result = await repo.deleteByIdAndTenant('missing', 'test-tenant');
      expect(result).toBe(false);
    });
  });

  describe('createForTenant', () => {
    it('should insert with correct columns and return entity', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow], rowCount: 1 });
      const result = await repo.createForTenant({
        name: 'Auto-vectorize PDFs',
        sourceType: 'upload',
        fileTypes: ['pdf', 'docx'],
        chunkSize: 512,
        chunkOverlap: 50,
        embeddingModel: 'text-embedding-3-small',
        targetCollection: 'docs',
        enabled: true,
      });
      expect(result.name).toBe('Auto-vectorize PDFs');
      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant'); // tenant_id
      expect(params[3]).toBe(JSON.stringify(['pdf', 'docx'])); // file_types serialized
    });
  });

  describe('updateByIdAndTenant', () => {
    it('should build dynamic SET clauses', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow], rowCount: 1 });
      await repo.updateByIdAndTenant('rule-1', 'test-tenant', { name: 'Updated', enabled: false });
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('enabled = $2');
      expect(sql).toContain('updated_at = NOW()');
      expect(sql).toContain('WHERE id = $3 AND tenant_id = $4');
    });

    it('should return null when no fields provided', async () => {
      const result = await repo.updateByIdAndTenant('rule-1', 'test-tenant', {});
      expect(result).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return null when row not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.updateByIdAndTenant('missing', 'test-tenant', { name: 'x' });
      expect(result).toBeNull();
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', async () => {
      mockQuery.mockResolvedValue({ rows: [ruleRow], rowCount: 1 });
      const result = await repo.findByIdAndTenant('rule-1', 'test-tenant');
      expect(result?.sourceType).toBe('upload');
      expect(result?.fileTypes).toEqual(['pdf', 'docx']);
      expect(result?.chunkSize).toBe(512);
      expect(result?.chunkOverlap).toBe(50);
      expect(result?.embeddingModel).toBe('text-embedding-3-small');
      expect(result?.targetCollection).toBe('docs');
      expect(result?.lastRun).toBeNull();
      expect(result?.processedCount).toBe(0);
      expect(result?.createdAt).toEqual(new Date('2026-01-01'));
    });
  });
});

describe('VectorCollectionRepository', () => {
  let repo: VectorCollectionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new VectorCollectionRepository({ query: mockQuery });
  });

  describe('findByTenant', () => {
    it('should query by tenant_id', async () => {
      mockQuery.mockResolvedValue({ rows: [collectionRow] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['test-tenant'],
      );
    });

    it('should add status filter', async () => {
      mockQuery.mockResolvedValue({ rows: [collectionRow] });
      await repo.findByTenant('test-tenant', { status: 'active' });
      expect(mockQuery.mock.calls[0][0]).toContain('status = $2');
      expect(mockQuery.mock.calls[0][1]).toEqual(['test-tenant', 'active']);
    });

    it('should return empty array when no results', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('findByIdAndTenant', () => {
    it('should return entity when found', async () => {
      mockQuery.mockResolvedValue({ rows: [collectionRow], rowCount: 1 });
      const result = await repo.findByIdAndTenant('col-1', 'test-tenant');
      expect(result?.name).toBe('docs');
      expect(result?.displayName).toBe('Documents');
      expect(result?.dimensions).toBe(1536);
      expect(result?.documentCount).toBe(42);
      expect(result?.parameters).toEqual({ ef_construction: 200 });
    });

    it('should return undefined when not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findByIdAndTenant('missing', 'test-tenant');
      expect(result).toBeUndefined();
    });
  });

  describe('updateVectorCount', () => {
    it('should update document_count', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      await repo.updateVectorCount('col-1', 100, 'test-tenant');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE vector_collections SET document_count'),
        [100, 'col-1', 'test-tenant'],
      );
    });
  });

  describe('createForTenant', () => {
    it('should insert with correct columns', async () => {
      mockQuery.mockResolvedValue({ rows: [collectionRow], rowCount: 1 });
      const result = await repo.createForTenant({
        name: 'docs',
        displayName: 'Documents',
        description: 'Document embeddings',
        dimensions: 1536,
        indexType: 'hnsw',
        distanceMetric: 'cosine',
        status: 'active',
        parameters: { ef_construction: 200 },
      });
      expect(result.name).toBe('docs');
      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant');
      expect(params[8]).toBe(JSON.stringify({ ef_construction: 200 })); // parameters serialized
    });
  });

  describe('deleteByIdAndTenant', () => {
    it('should return true when rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      const result = await repo.deleteByIdAndTenant('col-1', 'test-tenant');
      expect(result).toBe(true);
    });

    it('should return false when no rows deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      const result = await repo.deleteByIdAndTenant('missing', 'test-tenant');
      expect(result).toBe(false);
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', async () => {
      mockQuery.mockResolvedValue({ rows: [collectionRow], rowCount: 1 });
      const result = await repo.findByIdAndTenant('col-1', 'test-tenant');
      expect(result?.displayName).toBe('Documents');
      expect(result?.indexType).toBe('hnsw');
      expect(result?.distanceMetric).toBe('cosine');
      expect(result?.documentCount).toBe(42);
    });
  });
});
