/**
 * DataLineageRepository Tests
 * Covers LineageNodeRepository, LineageEdgeRepository, LineageRecordRepository
 */

import {
  LineageNodeRepository,
  LineageEdgeRepository,
  LineageRecordRepository,
} from '../DataLineageRepository';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();

// ==================== Test Data ====================

const snakeNodeRow = {
  id: 'node-1',
  tenant_id: 'test-tenant',
  name: 'Source DB',
  type: 'source',
  description: 'Main data source',
  pipeline_id: 'pipe-1',
  stage_id: 'stage-1',
  schema_data: { col1: 'string', col2: 'number' },
  node_metadata: { tags: ['production'] },
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
};

const snakeNodeRow2 = {
  id: 'node-2',
  tenant_id: 'test-tenant',
  name: 'Transform Layer',
  type: 'transform',
  description: null,
  pipeline_id: 'pipe-1',
  stage_id: null,
  schema_data: null,
  node_metadata: null,
  created_at: new Date('2026-01-03'),
  updated_at: new Date('2026-01-04'),
};

const snakeEdgeRow = {
  id: 'edge-1',
  tenant_id: 'test-tenant',
  from_node_id: 'node-1',
  to_node_id: 'node-2',
  relationship: 'produces',
  field_mapping: { col1: 'mapped_col1' },
  created_at: new Date('2026-01-01'),
};

const snakeEdgeRow2 = {
  id: 'edge-2',
  tenant_id: 'test-tenant',
  from_node_id: 'node-2',
  to_node_id: 'node-3',
  relationship: 'transforms',
  field_mapping: null,
  created_at: new Date('2026-01-02'),
};

const snakeRecordRow = {
  id: 'record-1',
  tenant_id: 'test-tenant',
  pipeline_id: 'pipe-1',
  execution_id: 'exec-1',
  node_ids: ['node-1', 'node-2'],
  edge_ids: ['edge-1'],
  recorded_at: new Date('2026-01-01'),
};

const snakeRecordRow2 = {
  id: 'record-2',
  tenant_id: 'test-tenant',
  pipeline_id: 'pipe-1',
  execution_id: 'exec-2',
  node_ids: ['node-1', 'node-2', 'node-3'],
  edge_ids: ['edge-1', 'edge-2'],
  recorded_at: new Date('2026-01-02'),
};

// ==================== LineageNodeRepository ====================

describe('LineageNodeRepository', () => {
  let repo: LineageNodeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new LineageNodeRepository({ query: mockQuery });
  });

  describe('findByTenant', () => {
    it('should query with tenant_id only when no filters', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-1');
      expect(result[0].name).toBe('Source DB');
      expect(result[0].type).toBe('source');
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('WHERE tenant_id = $1');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toEqual(['test-tenant']);
    });

    it('should add type filter', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow] });
      await repo.findByTenant('test-tenant', { type: 'source' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND type = $2');
      expect(params).toEqual(['test-tenant', 'source']);
    });

    it('should add pipelineId filter', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow] });
      await repo.findByTenant('test-tenant', { pipelineId: 'pipe-1' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND pipeline_id = $2');
      expect(params).toEqual(['test-tenant', 'pipe-1']);
    });

    it('should add search filter with ILIKE', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow] });
      await repo.findByTenant('test-tenant', { search: 'Source' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND name ILIKE $2');
      expect(params).toEqual(['test-tenant', '%Source%']);
    });

    it('should combine multiple filters', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.findByTenant('test-tenant', { type: 'source', pipelineId: 'pipe-1', search: 'DB' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND type = $2');
      expect(sql).toContain('AND pipeline_id = $3');
      expect(sql).toContain('AND name ILIKE $4');
      expect(params).toEqual(['test-tenant', 'source', 'pipe-1', '%DB%']);
    });

    it('should return empty array when no results', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('findByPipeline', () => {
    it('should query by pipeline_id and tenant_id', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow, snakeNodeRow2] });
      const result = await repo.findByPipeline('pipe-1', 'test-tenant');
      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_id = $1'),
        ['pipe-1', 'test-tenant'],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase with null handling', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow] });
      const result = await repo.findByTenant('test-tenant');
      const node = result[0];
      expect(node.tenantId).toBe('test-tenant');
      expect(node.pipelineId).toBe('pipe-1');
      expect(node.stageId).toBe('stage-1');
      expect(node.schema).toEqual({ col1: 'string', col2: 'number' });
      expect(node.metadata).toEqual({ tags: ['production'] });
    });

    it('should handle null optional fields', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeNodeRow2] });
      const result = await repo.findByTenant('test-tenant');
      const node = result[0];
      expect(node.description).toBeNull();
      expect(node.stageId).toBeNull();
      expect(node.schema).toBeNull();
      expect(node.metadata).toBeNull();
    });
  });
});

// ==================== LineageEdgeRepository ====================

describe('LineageEdgeRepository', () => {
  let repo: LineageEdgeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new LineageEdgeRepository({ query: mockQuery });
  });

  describe('findByTenant', () => {
    it('should query with tenant_id only when no filters', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toHaveLength(1);
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('WHERE tenant_id = $1');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toEqual(['test-tenant']);
    });

    it('should add fromNodeId filter', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      await repo.findByTenant('test-tenant', { fromNodeId: 'node-1' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND from_node_id = $2');
      expect(params).toEqual(['test-tenant', 'node-1']);
    });

    it('should add toNodeId filter', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      await repo.findByTenant('test-tenant', { toNodeId: 'node-2' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND to_node_id = $2');
      expect(params).toEqual(['test-tenant', 'node-2']);
    });

    it('should combine fromNodeId and toNodeId filters', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.findByTenant('test-tenant', { fromNodeId: 'node-1', toNodeId: 'node-2' });
      const sql = mockQuery.mock.calls[0][0];
      const params = mockQuery.mock.calls[0][1];
      expect(sql).toContain('AND from_node_id = $2');
      expect(sql).toContain('AND to_node_id = $3');
      expect(params).toEqual(['test-tenant', 'node-1', 'node-2']);
    });
  });

  describe('findUpstream', () => {
    it('should find edges where nodeId is the target (to_node_id)', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      const result = await repo.findUpstream('node-2', 'test-tenant');
      expect(result).toHaveLength(1);
      expect(result[0].fromNodeId).toBe('node-1');
      expect(result[0].toNodeId).toBe('node-2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('to_node_id = $1'),
        ['node-2', 'test-tenant'],
      );
    });

    it('should return empty when no upstream edges', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await repo.findUpstream('node-orphan', 'test-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('findDownstream', () => {
    it('should find edges where nodeId is the source (from_node_id)', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      const result = await repo.findDownstream('node-1', 'test-tenant');
      expect(result).toHaveLength(1);
      expect(result[0].fromNodeId).toBe('node-1');
      expect(result[0].toNodeId).toBe('node-2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('from_node_id = $1'),
        ['node-1', 'test-tenant'],
      );
    });

    it('should return empty when no downstream edges', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await repo.findDownstream('node-orphan', 'test-tenant');
      expect(result).toEqual([]);
    });
  });

  describe('findByPipeline', () => {
    it('should join with nodes table and filter by pipeline_id', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      const result = await repo.findByPipeline('pipe-1', 'test-tenant');
      expect(result).toHaveLength(1);
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('JOIN data_lineage_nodes');
      expect(sql).toContain('pipeline_id = $1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        ['pipe-1', 'test-tenant'],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow] });
      const result = await repo.findByTenant('test-tenant');
      const edge = result[0];
      expect(edge.tenantId).toBe('test-tenant');
      expect(edge.fromNodeId).toBe('node-1');
      expect(edge.toNodeId).toBe('node-2');
      expect(edge.relationship).toBe('produces');
      expect(edge.fieldMapping).toEqual({ col1: 'mapped_col1' });
    });

    it('should handle null fieldMapping', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeEdgeRow2] });
      const result = await repo.findByTenant('test-tenant');
      const edge = result[0];
      expect(edge.fieldMapping).toBeNull();
    });
  });
});

// ==================== LineageRecordRepository ====================

describe('LineageRecordRepository', () => {
  let repo: LineageRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new LineageRecordRepository({ query: mockQuery });
  });

  describe('findByPipeline', () => {
    it('should query by pipeline_id and tenant_id with default limit', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRecordRow] });
      const result = await repo.findByPipeline('pipe-1', 'test-tenant');
      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_id = $1'),
        ['pipe-1', 'test-tenant', 20],
      );
    });

    it('should use custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.findByPipeline('pipe-1', 'test-tenant', 5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        ['pipe-1', 'test-tenant', 5],
      );
    });

    it('should order by recorded_at DESC', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.findByPipeline('pipe-1', 'test-tenant');
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('ORDER BY recorded_at DESC');
      expect(sql).toContain('LIMIT $3');
    });
  });

  describe('findLatestByPipeline', () => {
    it('should return the latest record', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRecordRow2] });
      const result = await repo.findLatestByPipeline('pipe-1', 'test-tenant');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('record-2');
      expect(result!.executionId).toBe('exec-2');
      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('LIMIT 1');
    });

    it('should return null when no records found', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await repo.findLatestByPipeline('pipe-1', 'test-tenant');
      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('should query by tenant_id with default limit', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRecordRow, snakeRecordRow2] });
      const result = await repo.findByTenant('test-tenant');
      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['test-tenant', 50],
      );
    });

    it('should use custom limit', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await repo.findByTenant('test-tenant', 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        ['test-tenant', 10],
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should map snake_case to camelCase including arrays', async () => {
      mockQuery.mockResolvedValue({ rows: [snakeRecordRow] });
      const result = await repo.findByPipeline('pipe-1', 'test-tenant');
      const record = result[0];
      expect(record.tenantId).toBe('test-tenant');
      expect(record.pipelineId).toBe('pipe-1');
      expect(record.executionId).toBe('exec-1');
      expect(record.nodeIds).toEqual(['node-1', 'node-2']);
      expect(record.edgeIds).toEqual(['edge-1']);
      expect(record.recordedAt).toEqual(new Date('2026-01-01'));
    });

    it('should handle null node_ids and edge_ids', async () => {
      const rowWithNulls = {
        ...snakeRecordRow,
        node_ids: null,
        edge_ids: null,
      };
      mockQuery.mockResolvedValue({ rows: [rowWithNulls] });
      const result = await repo.findByPipeline('pipe-1', 'test-tenant');
      expect(result[0].nodeIds).toEqual([]);
      expect(result[0].edgeIds).toEqual([]);
    });
  });
});
