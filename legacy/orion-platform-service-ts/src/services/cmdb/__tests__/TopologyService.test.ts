/**
 * TopologyService 测试
 *
 * 测试拓扑服务：获取拓扑图、服务依赖链、影响分析。
 * 使用递归 CTE (mock CmdbTopologyRepository) 消除 N+1 查询。
 */

import { TopologyService, TopologyFilters } from '../TopologyService';
import { CmdbTopologyRepository } from '../../api/repositories/CmdbTopologyRepository';
import { TopologyNode, TopologyEdge } from '../TopologyService';
import { CiType } from '../CmdbTypes';

// ==================== Mock Helpers ====================

function createMockCmdbService() {
  const cis: any[] = [];

  return {
    cis,
    listCIs: jest.fn().mockImplementation(async (opts: any) => {
      let filtered = [...cis];
      if (opts?.ciType) {
        filtered = filtered.filter(c => c.ciType === opts.ciType);
      }
      return { data: filtered.slice(0, opts?.limit || 100), total: filtered.length };
    }),
    getCIByCiId: jest.fn().mockImplementation(async (ciId: string, tenantId?: bigint) => {
      return cis.find(c => c.ciId === ciId) || null;
    }),
    getCIRelations: jest.fn().mockResolvedValue([]),
  };
}

function createMockTopologyRepository() {
  const mockLoadTopology = jest.fn();
  const mockLoadAllTopology = jest.fn();
  const mockFindAffectedCIsWithEdges = jest.fn();

  return {
    loadTopology: mockLoadTopology,
    loadAllTopology: mockLoadAllTopology,
    findAffectedCIsWithEdges: mockFindAffectedCIsWithEdges,
  };
}

function createTestCI(ciId: string, name: string, ciType: string = 'service') {
  return {
    id: `id-${ciId}`,
    ciId,
    ciType,
    name,
    status: 'active',
    environment: 'production',
    tenantId: BigInt(1),
    tags: [],
    attributes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockNode(ciId: string, name: string, type: string = 'service'): TopologyNode {
  return {
    id: `id-${ciId}`,
    ciId,
    type,
    name,
    status: 'active',
    environment: 'production',
    metadata: { tags: [], attributes: {} },
  };
}

function createMockEdge(id: string, source: string, target: string, relationType: string = 'depends_on'): TopologyEdge {
  return {
    id,
    source,
    target,
    type: relationType,
    description: '',
    metadata: {},
  };
}

// ==================== Tests ====================

describe('TopologyService', () => {
  let service: TopologyService;
  let mockCmdb: ReturnType<typeof createMockCmdbService>;
  let mockTopologyRepo: ReturnType<typeof createMockTopologyRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCmdb = createMockCmdbService();
    mockTopologyRepo = createMockTopologyRepository();
    service = new TopologyService(mockCmdb as any, mockTopologyRepo as any);
  });

  // ---- getTopology ----

  describe('getTopology', () => {
    it('should return full topology without root using loadAllTopology', async () => {
      mockTopologyRepo.loadAllTopology.mockResolvedValue({
        nodes: [createMockNode('CI-001', 'service-a'), createMockNode('CI-002', 'service-b')],
        edges: [createMockEdge('rel-1', 'CI-001', 'CI-002')],
      });

      const filters: TopologyFilters = {
        tenantId: BigInt(1),
      };

      const result = await service.getTopology(filters);

      expect(mockTopologyRepo.loadAllTopology).toHaveBeenCalledWith(BigInt(1), undefined);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should filter by ciType in full topology', async () => {
      mockTopologyRepo.loadAllTopology.mockResolvedValue({
        nodes: [createMockNode('CI-001', 'service-a', 'service')],
        edges: [],
      });

      const filters: TopologyFilters = {
        tenantId: BigInt(1),
        ciType: 'service' as CiType,
      };

      const result = await service.getTopology(filters);

      expect(mockTopologyRepo.loadAllTopology).toHaveBeenCalledWith(BigInt(1), 'service');
      expect(result.nodes).toHaveLength(1);
    });

    it('should use recursive CTE when rootCiId and depth are specified', async () => {
      mockTopologyRepo.loadTopology.mockResolvedValue({
        nodes: [createMockNode('CI-001', 'root'), createMockNode('CI-002', 'child')],
        edges: [createMockEdge('rel-1', 'CI-001', 'CI-002')],
      });

      const filters: TopologyFilters = {
        tenantId: BigInt(1),
        rootCiId: 'CI-001',
        depth: 3,
      };

      const result = await service.getTopology(filters);

      expect(mockTopologyRepo.loadTopology).toHaveBeenCalledWith(BigInt(1), 'CI-001', 3);
      expect(mockTopologyRepo.loadAllTopology).not.toHaveBeenCalled();
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it('should return empty topology when no data', async () => {
      mockTopologyRepo.loadAllTopology.mockResolvedValue({
        nodes: [],
        edges: [],
      });

      const result = await service.getTopology({ tenantId: BigInt(1) });

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  // ---- getServiceDependencies ----

  describe('getServiceDependencies', () => {
    it('should return dependencies using recursive CTE (no N+1)', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'service-a'));
      mockTopologyRepo.loadTopology.mockResolvedValue({
        nodes: [createMockNode('CI-001', 'service-a'), createMockNode('CI-002', 'service-b')],
        edges: [createMockEdge('rel-1', 'CI-001', 'CI-002')],
      });

      const result = await service.getServiceDependencies(BigInt(1), 'CI-001', 10);

      expect(mockCmdb.getCIByCiId).toHaveBeenCalledWith('CI-001', BigInt(1));
      expect(mockTopologyRepo.loadTopology).toHaveBeenCalledWith(BigInt(1), 'CI-001', 10);
      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for non-existent CI', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(null);

      const result = await service.getServiceDependencies(BigInt(1), 'non-existent');

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(mockTopologyRepo.loadTopology).not.toHaveBeenCalled();
    });

    it('should use default depth of 10 when not specified', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'service-a'));
      mockTopologyRepo.loadTopology.mockResolvedValue({
        nodes: [createMockNode('CI-001', 'service-a')],
        edges: [],
      });

      await service.getServiceDependencies(BigInt(1), 'CI-001');

      expect(mockTopologyRepo.loadTopology).toHaveBeenCalledWith(BigInt(1), 'CI-001', 10);
    });
  });

  // ---- getImpactAnalysis ----

  describe('getImpactAnalysis', () => {
    it('should return impact analysis with affected nodes and edges', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'database'));
      mockTopologyRepo.findAffectedCIsWithEdges.mockResolvedValue({
        cis: [createTestCI('CI-002', 'service-a'), createTestCI('CI-003', 'service-b')],
        edges: [
          createMockEdge('rel-1', 'CI-002', 'CI-001'),
          createMockEdge('rel-2', 'CI-003', 'CI-001'),
        ],
      });

      const result = await service.getImpactAnalysis(BigInt(1), 'CI-001');

      expect(mockCmdb.getCIByCiId).toHaveBeenCalledWith('CI-001', BigInt(1));
      expect(mockTopologyRepo.findAffectedCIsWithEdges).toHaveBeenCalledWith(BigInt(1), 'CI-001', 10);
      expect(result.affectedNodes.length).toBeGreaterThanOrEqual(2);
      expect(result.affectedEdges.length).toBeGreaterThanOrEqual(2);
      expect(['critical', 'high', 'medium', 'low']).toContain(result.impactLevel);
    });

    it('should return low impact for non-existent CI', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(null);

      const result = await service.getImpactAnalysis(BigInt(1), 'non-existent');

      expect(result.affectedNodes).toHaveLength(0);
      expect(result.affectedEdges).toHaveLength(0);
      expect(result.impactLevel).toBe('low');
      expect(mockTopologyRepo.findAffectedCIsWithEdges).not.toHaveBeenCalled();
    });

    it('should calculate critical impact for 10+ affected CIs', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'critical-db'));

      const affectedCis = [];
      const edges = [];
      for (let i = 0; i < 10; i++) {
        affectedCis.push(createTestCI(`CI-${100 + i}`, `service-${i}`));
        edges.push(createMockEdge(`rel-${i}`, `CI-${100 + i}`, 'CI-001'));
      }

      mockTopologyRepo.findAffectedCIsWithEdges.mockResolvedValue({
        cis: affectedCis,
        edges,
      });

      const result = await service.getImpactAnalysis(BigInt(1), 'CI-001');

      expect(result.affectedNodes.length).toBeGreaterThanOrEqual(10);
      expect(result.impactLevel).toBe('critical');
    });

    it('should calculate high impact for 5-9 affected CIs', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'db'));

      const affectedCis = [];
      const edges = [];
      for (let i = 0; i < 5; i++) {
        affectedCis.push(createTestCI(`CI-${100 + i}`, `service-${i}`));
        edges.push(createMockEdge(`rel-${i}`, `CI-${100 + i}`, 'CI-001'));
      }

      mockTopologyRepo.findAffectedCIsWithEdges.mockResolvedValue({
        cis: affectedCis,
        edges,
      });

      const result = await service.getImpactAnalysis(BigInt(1), 'CI-001');

      expect(result.impactLevel).toBe('high');
    });

    it('should calculate medium impact for 2-4 affected CIs', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'db'));

      mockTopologyRepo.findAffectedCIsWithEdges.mockResolvedValue({
        cis: [createTestCI('CI-002', 'svc-1'), createTestCI('CI-003', 'svc-2')],
        edges: [createMockEdge('rel-1', 'CI-002', 'CI-001'), createMockEdge('rel-2', 'CI-003', 'CI-001')],
      });

      const result = await service.getImpactAnalysis(BigInt(1), 'CI-001');

      expect(result.impactLevel).toBe('medium');
    });

    it('should calculate low impact for 0-1 affected CIs', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(createTestCI('CI-001', 'db'));

      mockTopologyRepo.findAffectedCIsWithEdges.mockResolvedValue({
        cis: [],
        edges: [],
      });

      const result = await service.getImpactAnalysis(BigInt(1), 'CI-001');

      expect(result.impactLevel).toBe('low');
    });
  });
});
