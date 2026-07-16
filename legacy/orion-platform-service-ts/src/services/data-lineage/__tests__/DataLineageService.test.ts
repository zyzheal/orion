/**
 * DataLineageService Tests
 * Covers recordLineage, getLineage, getLineageHistory, addNode, addEdge,
 * getUpstream, getDownstream, getImpactAnalysis, getLineageGraph
 */

import { DataLineageService } from '../DataLineageService';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

// ==================== Mock Repositories ====================

const mockNodeRepo = {
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByPipeline: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockEdgeRepo = {
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByPipeline: jest.fn(),
  findUpstream: jest.fn(),
  findDownstream: jest.fn(),
  create: jest.fn(),
};

const mockRecordRepo = {
  findByPipeline: jest.fn(),
  findLatestByPipeline: jest.fn(),
  findByTenant: jest.fn(),
  create: jest.fn(),
};

// Mock the Repository constructors
jest.mock('../DataLineageRepository', () => ({
  LineageNodeRepository: jest.fn().mockImplementation(() => mockNodeRepo),
  LineageEdgeRepository: jest.fn().mockImplementation(() => mockEdgeRepo),
  LineageRecordRepository: jest.fn().mockImplementation(() => mockRecordRepo),
}));

let service: DataLineageService;

// ==================== Test Data ====================

const mockNodeEntity1 = {
  id: 'node-1',
  tenantId: 'test-tenant',
  name: 'Source DB',
  type: 'source' as const,
  description: 'Main source',
  pipelineId: 'pipe-1',
  stageId: 'stage-1',
  schema: { col1: 'string' },
  metadata: { tags: ['prod'] },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

const mockNodeEntity2 = {
  id: 'node-2',
  tenantId: 'test-tenant',
  name: 'Transform',
  type: 'transform' as const,
  description: null,
  pipelineId: 'pipe-1',
  stageId: null,
  schema: null,
  metadata: null,
  createdAt: new Date('2026-01-03'),
  updatedAt: new Date('2026-01-04'),
};

const mockEdgeEntity = {
  id: 'edge-1',
  tenantId: 'test-tenant',
  fromNodeId: 'node-1',
  toNodeId: 'node-2',
  relationship: 'produces' as const,
  fieldMapping: { col1: 'mapped_col1' },
  createdAt: new Date('2026-01-01'),
};

const mockRecordEntity = {
  id: 'record-1',
  tenantId: 'test-tenant',
  pipelineId: 'pipe-1',
  executionId: 'exec-1',
  nodeIds: ['node-1', 'node-2'],
  edgeIds: ['edge-1'],
  recordedAt: new Date('2026-01-01'),
};

const mockLineageNode = {
  id: 'node-1',
  name: 'Source DB',
  type: 'source' as const,
  description: 'Main source',
  pipelineId: 'pipe-1',
  stageId: 'stage-1',
  schema: { col1: 'string' },
  metadata: { tags: ['prod'] },
};

const mockLineageEdge = {
  id: 'edge-1',
  from: 'node-1',
  to: 'node-2',
  relationship: 'produces' as const,
  fieldMapping: { col1: 'mapped_col1' },
};

beforeEach(() => {
  jest.clearAllMocks();
  service = new DataLineageService({ query: jest.fn() });
});

// ==================== recordLineage ====================

describe('DataLineageService', () => {
  describe('recordLineage', () => {
    it('should create new nodes and edges when they do not exist', async () => {
      mockNodeRepo.findById.mockResolvedValue(undefined);
      mockNodeRepo.create.mockResolvedValue(mockNodeEntity1);
      mockEdgeRepo.findById.mockResolvedValue(undefined);
      mockEdgeRepo.create.mockResolvedValue(mockEdgeEntity);
      mockRecordRepo.create.mockResolvedValue(mockRecordEntity);
      mockNodeRepo.findByTenant.mockResolvedValue([mockNodeEntity1, mockNodeEntity2]);
      mockEdgeRepo.findByTenant.mockResolvedValue([mockEdgeEntity]);

      const result = await service.recordLineage(
        'test-tenant',
        'pipe-1',
        'exec-1',
        [mockLineageNode],
        [mockLineageEdge],
      );

      expect(result.id).toBe('record-1');
      expect(result.pipelineId).toBe('pipe-1');
      expect(result.executionId).toBe('exec-1');
      expect(mockNodeRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'node-1',
        tenantId: 'test-tenant',
        name: 'Source DB',
      }));
      expect(mockEdgeRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'edge-1',
        tenantId: 'test-tenant',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
      }));
      expect(mockRecordRepo.create).toHaveBeenCalled();
    });

    it('should update existing nodes instead of creating', async () => {
      mockNodeRepo.findById.mockResolvedValue(mockNodeEntity1);
      mockNodeRepo.update.mockResolvedValue(mockNodeEntity1);
      mockEdgeRepo.findById.mockResolvedValue(mockEdgeEntity); // edge exists, skip
      mockRecordRepo.create.mockResolvedValue(mockRecordEntity);
      mockNodeRepo.findByTenant.mockResolvedValue([mockNodeEntity1]);
      mockEdgeRepo.findByTenant.mockResolvedValue([mockEdgeEntity]);

      const result = await service.recordLineage(
        'test-tenant',
        'pipe-1',
        'exec-1',
        [mockLineageNode],
        [mockLineageEdge],
      );

      expect(mockNodeRepo.update).toHaveBeenCalledWith('node-1', expect.objectContaining({
        name: 'Source DB',
        type: 'source',
      }));
      expect(mockEdgeRepo.create).not.toHaveBeenCalled(); // edge exists, skipped
      expect(result.id).toBe('record-1');
    });

    it('should handle empty nodes and edges', async () => {
      mockRecordRepo.create.mockResolvedValue(mockRecordEntity);
      mockNodeRepo.findByTenant.mockResolvedValue([]);
      mockEdgeRepo.findByTenant.mockResolvedValue([]);

      const result = await service.recordLineage('test-tenant', 'pipe-1', 'exec-1', [], []);

      expect(result.graph.nodes).toEqual([]);
      expect(result.graph.edges).toEqual([]);
      expect(mockNodeRepo.create).not.toHaveBeenCalled();
      expect(mockEdgeRepo.create).not.toHaveBeenCalled();
    });
  });

  // ==================== getLineage ====================

  describe('getLineage', () => {
    it('should return lineage graph when record exists', async () => {
      mockRecordRepo.findLatestByPipeline.mockResolvedValue(mockRecordEntity);
      mockNodeRepo.findByTenant.mockResolvedValue([mockNodeEntity1, mockNodeEntity2]);
      mockEdgeRepo.findByTenant.mockResolvedValue([mockEdgeEntity]);

      const result = await service.getLineage('pipe-1', 'test-tenant');

      expect(result).not.toBeNull();
      expect(result!.nodes).toHaveLength(2);
      expect(result!.edges).toHaveLength(1);
      expect(result!.pipelineId).toBe('pipe-1');
    });

    it('should return null when no record exists', async () => {
      mockRecordRepo.findLatestByPipeline.mockResolvedValue(null);

      const result = await service.getLineage('pipe-1', 'test-tenant');

      expect(result).toBeNull();
    });
  });

  // ==================== getLineageHistory ====================

  describe('getLineageHistory', () => {
    it('should return lineage records with graphs', async () => {
      mockRecordRepo.findByPipeline.mockResolvedValue([mockRecordEntity]);
      mockNodeRepo.findByTenant.mockResolvedValue([mockNodeEntity1]);
      mockEdgeRepo.findByTenant.mockResolvedValue([mockEdgeEntity]);

      const result = await service.getLineageHistory('pipe-1', 20, 'test-tenant');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('record-1');
      expect(result[0].graph).toBeDefined();
      expect(result[0].graph.nodes).toBeDefined();
    });

    it('should return empty array when no history', async () => {
      mockRecordRepo.findByPipeline.mockResolvedValue([]);

      const result = await service.getLineageHistory('pipe-1', 20, 'test-tenant');

      expect(result).toEqual([]);
    });
  });

  // ==================== addNode ====================

  describe('addNode', () => {
    it('should create node when it does not exist', async () => {
      mockNodeRepo.findById.mockResolvedValue(undefined);
      mockNodeRepo.create.mockResolvedValue(mockNodeEntity1);

      await service.addNode(mockLineageNode, 'test-tenant');

      expect(mockNodeRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'node-1',
        tenantId: 'test-tenant',
        name: 'Source DB',
        type: 'source',
      }));
    });

    it('should update node when it already exists', async () => {
      mockNodeRepo.findById.mockResolvedValue(mockNodeEntity1);
      mockNodeRepo.update.mockResolvedValue(mockNodeEntity1);

      await service.addNode(mockLineageNode, 'test-tenant');

      expect(mockNodeRepo.update).toHaveBeenCalledWith('node-1', expect.objectContaining({
        name: 'Source DB',
        type: 'source',
      }));
      expect(mockNodeRepo.create).not.toHaveBeenCalled();
    });
  });

  // ==================== addEdge ====================

  describe('addEdge', () => {
    it('should create edge', async () => {
      mockEdgeRepo.create.mockResolvedValue(mockEdgeEntity);

      await service.addEdge(mockLineageEdge, 'test-tenant');

      expect(mockEdgeRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        id: 'edge-1',
        tenantId: 'test-tenant',
        fromNodeId: 'node-1',
        toNodeId: 'node-2',
        relationship: 'produces',
        fieldMapping: { col1: 'mapped_col1' },
      }));
    });
  });

  // ==================== getUpstream ====================

  describe('getUpstream', () => {
    it('should return upstream nodes', async () => {
      mockEdgeRepo.findUpstream.mockResolvedValue([mockEdgeEntity]);
      mockNodeRepo.findById.mockResolvedValue(mockNodeEntity1);

      const result = await service.getUpstream('node-2', 'test-tenant');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-1');
      expect(result[0].name).toBe('Source DB');
      expect(mockEdgeRepo.findUpstream).toHaveBeenCalledWith('node-2', 'test-tenant');
    });

    it('should return empty when no upstream edges', async () => {
      mockEdgeRepo.findUpstream.mockResolvedValue([]);

      const result = await service.getUpstream('node-orphan', 'test-tenant');

      expect(result).toEqual([]);
    });

    it('should skip nodes that no longer exist', async () => {
      mockEdgeRepo.findUpstream.mockResolvedValue([mockEdgeEntity]);
      mockNodeRepo.findById.mockResolvedValue(undefined);

      const result = await service.getUpstream('node-2', 'test-tenant');

      expect(result).toEqual([]);
    });
  });

  // ==================== getDownstream ====================

  describe('getDownstream', () => {
    it('should return downstream nodes', async () => {
      mockEdgeRepo.findDownstream.mockResolvedValue([mockEdgeEntity]);
      mockNodeRepo.findById.mockResolvedValue(mockNodeEntity2);

      const result = await service.getDownstream('node-1', 'test-tenant');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-2');
      expect(mockEdgeRepo.findDownstream).toHaveBeenCalledWith('node-1', 'test-tenant');
    });

    it('should return empty when no downstream edges', async () => {
      mockEdgeRepo.findDownstream.mockResolvedValue([]);

      const result = await service.getDownstream('node-orphan', 'test-tenant');

      expect(result).toEqual([]);
    });
  });

  // ==================== getImpactAnalysis ====================

  describe('getImpactAnalysis', () => {
    it('should return impact analysis with upstream/downstream counts', async () => {
      mockNodeRepo.findById.mockResolvedValue(mockNodeEntity1);
      // getUpstream calls
      mockEdgeRepo.findUpstream.mockResolvedValue([]);
      // getDownstream calls
      mockEdgeRepo.findDownstream.mockResolvedValue([mockEdgeEntity]);
      mockNodeRepo.findById.mockResolvedValueOnce(mockNodeEntity1) // first call for nodeEntity
        .mockResolvedValueOnce(mockNodeEntity2); // second call for downstream node

      const result = await service.getImpactAnalysis('node-1', 'test-tenant');

      expect(result.node).toBeDefined();
      expect(result.node!.id).toBe('node-1');
      expect(result.upstreamCount).toBe(0);
      expect(result.downstreamCount).toBe(1);
      expect(result.affectedPipelines).toContain('pipe-1');
    });

    it('should return undefined node when not found', async () => {
      mockNodeRepo.findById.mockResolvedValue(undefined);
      mockEdgeRepo.findUpstream.mockResolvedValue([]);
      mockEdgeRepo.findDownstream.mockResolvedValue([]);

      const result = await service.getImpactAnalysis('node-missing', 'test-tenant');

      expect(result.node).toBeUndefined();
      expect(result.upstreamCount).toBe(0);
      expect(result.downstreamCount).toBe(0);
      expect(result.affectedPipelines).toEqual([]);
    });

    it('should collect affected pipelines from upstream and downstream nodes', async () => {
      const nodeInOtherPipeline = {
        ...mockNodeEntity2,
        id: 'node-3',
        pipelineId: 'pipe-2',
      };
      mockNodeRepo.findById.mockResolvedValueOnce(mockNodeEntity1)
        .mockResolvedValueOnce(mockNodeEntity2)
        .mockResolvedValueOnce(nodeInOtherPipeline);
      mockEdgeRepo.findUpstream.mockResolvedValue([mockEdgeEntity]);
      mockEdgeRepo.findDownstream.mockResolvedValue([{ ...mockEdgeEntity, id: 'edge-2', fromNodeId: 'node-1', toNodeId: 'node-3' }]);

      const result = await service.getImpactAnalysis('node-1', 'test-tenant');

      expect(result.affectedPipelines).toContain('pipe-1');
      expect(result.affectedPipelines).toContain('pipe-2');
      expect(result.upstreamCount).toBe(1);
      expect(result.downstreamCount).toBe(1);
    });
  });

  // ==================== getLineageGraph ====================

  describe('getLineageGraph', () => {
    it('should return graph with stats', async () => {
      const node3 = { ...mockNodeEntity2, id: 'node-3', type: 'sink' as const, name: 'Sink' };
      mockNodeRepo.findByTenant.mockResolvedValue([mockNodeEntity1, mockNodeEntity2, node3]);
      mockEdgeRepo.findByTenant.mockResolvedValue([mockEdgeEntity]);

      const result = await service.getLineageGraph('test-tenant');

      expect(result.graph.nodes).toHaveLength(3);
      expect(result.graph.edges).toHaveLength(1);
      expect(result.stats.totalNodes).toBe(3);
      expect(result.stats.totalEdges).toBe(1);
      expect(result.stats.sourceCount).toBe(1);
      expect(result.stats.transformCount).toBe(1);
      expect(result.stats.sinkCount).toBe(1);
      expect(result.stats.datasetCount).toBe(0);
      expect(result.stats.modelCount).toBe(0);
    });

    it('should return empty stats when no data', async () => {
      mockNodeRepo.findByTenant.mockResolvedValue([]);
      mockEdgeRepo.findByTenant.mockResolvedValue([]);

      const result = await service.getLineageGraph('test-tenant');

      expect(result.stats.totalNodes).toBe(0);
      expect(result.stats.totalEdges).toBe(0);
    });
  });
});
