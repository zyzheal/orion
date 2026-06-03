/**
 * TopologyService 测试
 *
 * 测试拓扑服务：获取拓扑图、服务依赖链、影响分析。
 * Mock CmdbService 模拟 CMDB 数据访问。
 */

import { TopologyService, TopologyFilters } from '../TopologyService';
import { CiType } from '../CmdbTypes';

// ==================== Mock CmdbService ====================

function createMockCmdbService() {
  const cis: any[] = [];
  const relations: Map<string, any[]> = new Map();

  return {
    cis,
    relations,
    listCIs: jest.fn().mockImplementation(async (opts: any) => {
      let filtered = [...cis];
      if (opts?.ciType) {
        filtered = filtered.filter(c => c.ciType === opts.ciType);
      }
      return { data: filtered.slice(0, opts?.limit || 100), total: filtered.length };
    }),
    getCIByCiId: jest.fn().mockImplementation(async (ciId: string) => {
      return cis.find(c => c.ciId === ciId) || null;
    }),
    getCIRelations: jest.fn().mockImplementation(async (ciId: string) => {
      return relations.get(ciId) || [];
    }),
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

// ==================== Tests ====================

describe('TopologyService', () => {
  let service: TopologyService;
  let mockCmdb: ReturnType<typeof createMockCmdbService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCmdb = createMockCmdbService();
    service = new TopologyService(mockCmdb as any);
  });

  // ---- getTopology ----

  describe('getTopology', () => {
    it('should return topology with nodes and edges', async () => {
      const ci1 = createTestCI('CI-001', 'service-a');
      const ci2 = createTestCI('CI-002', 'service-b');
      mockCmdb.cis.push(ci1, ci2);
      mockCmdb.relations.set('CI-001', [{
        id: 'rel-1',
        fromCiId: 'CI-001',
        toCiId: 'CI-002',
        relationType: 'depends_on',
        description: 'A depends on B',
      }]);

      const filters: TopologyFilters = {
        tenantId: BigInt(1),
      };

      const result = await service.getTopology(filters);

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('CI-001');
      expect(result.edges[0].target).toBe('CI-002');
    });

    it('should filter by ciType', async () => {
      mockCmdb.cis.push(
        createTestCI('CI-001', 'service-a', 'service'),
        createTestCI('CI-002', 'db-1', 'database')
      );

      const filters: TopologyFilters = {
        tenantId: BigInt(1),
        ciType: 'service' as CiType,
      };

      const result = await service.getTopology(filters);

      expect(mockCmdb.listCIs).toHaveBeenCalledWith(
        expect.objectContaining({ ciType: 'service' })
      );
    });

    it('should return empty topology when no CIs exist', async () => {
      const result = await service.getTopology({ tenantId: BigInt(1) });

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should deduplicate edges', async () => {
      const ci1 = createTestCI('CI-001', 'service-a');
      const ci2 = createTestCI('CI-002', 'service-b');
      mockCmdb.cis.push(ci1, ci2);

      // Both CIs reference the same relation
      const relation = {
        id: 'rel-1',
        fromCiId: 'CI-001',
        toCiId: 'CI-002',
        relationType: 'depends_on',
      };
      mockCmdb.relations.set('CI-001', [relation]);
      mockCmdb.relations.set('CI-002', [relation]);

      const result = await service.getTopology({ tenantId: BigInt(1) });

      expect(result.edges).toHaveLength(1);
    });

    it('should filter by depth when rootCiId is specified', async () => {
      const ci1 = createTestCI('CI-001', 'root');
      const ci2 = createTestCI('CI-002', 'child-1');
      const ci3 = createTestCI('CI-003', 'child-2');
      mockCmdb.cis.push(ci1, ci2, ci3);

      mockCmdb.relations.set('CI-001', [{
        id: 'rel-1',
        fromCiId: 'CI-001',
        toCiId: 'CI-002',
        relationType: 'depends_on',
      }]);
      mockCmdb.relations.set('CI-002', [{
        id: 'rel-2',
        fromCiId: 'CI-002',
        toCiId: 'CI-003',
        relationType: 'depends_on',
      }]);

      const result = await service.getTopology({
        tenantId: BigInt(1),
        rootCiId: 'CI-001',
        depth: 1,
      });

      // Depth 1 should include CI-001 and CI-002, but not CI-003
      expect(result.nodes.length).toBeLessThanOrEqual(2);
    });
  });

  // ---- getServiceDependencies ----

  describe('getServiceDependencies', () => {
    it('should return dependencies recursively', async () => {
      const ci1 = createTestCI('CI-001', 'service-a');
      const ci2 = createTestCI('CI-002', 'service-b');
      mockCmdb.cis.push(ci1, ci2);

      mockCmdb.getCIByCiId
        .mockResolvedValueOnce(ci1)
        .mockResolvedValueOnce(ci2)
        .mockResolvedValueOnce(ci2);

      mockCmdb.getCIRelations
        .mockResolvedValueOnce([{
          id: 'rel-1',
          fromCiId: 'CI-001',
          toCiId: 'CI-002',
          relationType: 'depends_on',
        }])
        .mockResolvedValueOnce([]);

      const result = await service.getServiceDependencies('CI-001');

      expect(result.nodes.length).toBeGreaterThanOrEqual(1);
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for non-existent CI', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(null);

      const result = await service.getServiceDependencies('non-existent');

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('should handle circular dependencies', async () => {
      const ci1 = createTestCI('CI-001', 'service-a');
      const ci2 = createTestCI('CI-002', 'service-b');

      mockCmdb.getCIByCiId
        .mockResolvedValueOnce(ci1)
        .mockResolvedValueOnce(ci2)
        .mockResolvedValueOnce(ci1);

      mockCmdb.getCIRelations
        .mockResolvedValueOnce([{
          id: 'rel-1',
          fromCiId: 'CI-001',
          toCiId: 'CI-002',
          relationType: 'depends_on',
        }])
        .mockResolvedValueOnce([{
          id: 'rel-2',
          fromCiId: 'CI-002',
          toCiId: 'CI-001',
          relationType: 'depends_on',
        }]);

      const result = await service.getServiceDependencies('CI-001');

      // Should not infinite loop
      expect(result).toBeDefined();
    });
  });

  // ---- getImpactAnalysis ----

  describe('getImpactAnalysis', () => {
    it('should return impact analysis with affected nodes', async () => {
      const ci1 = createTestCI('CI-001', 'database');
      const ci2 = createTestCI('CI-002', 'service-a');
      const ci3 = createTestCI('CI-003', 'service-b');

      mockCmdb.getCIByCiId
        .mockResolvedValueOnce(ci1)
        .mockResolvedValueOnce(ci2)
        .mockResolvedValueOnce(ci3);

      // CI-002 depends on CI-001 (CI-001 is the target)
      mockCmdb.getCIRelations
        .mockResolvedValueOnce([{
          id: 'rel-1',
          fromCiId: 'CI-002',
          toCiId: 'CI-001',
          relationType: 'depends_on',
        }])
        .mockResolvedValueOnce([{
          id: 'rel-2',
          fromCiId: 'CI-003',
          toCiId: 'CI-002',
          relationType: 'depends_on',
        }])
        .mockResolvedValueOnce([]);

      const result = await service.getImpactAnalysis('CI-001');

      expect(result.affectedNodes.length).toBeGreaterThanOrEqual(1);
      expect(result.affectedEdges.length).toBeGreaterThanOrEqual(1);
      expect(['critical', 'high', 'medium', 'low']).toContain(result.impactLevel);
    });

    it('should return low impact for non-existent CI', async () => {
      mockCmdb.getCIByCiId.mockResolvedValue(null);

      const result = await service.getImpactAnalysis('non-existent');

      expect(result.affectedNodes).toHaveLength(0);
      expect(result.affectedEdges).toHaveLength(0);
      expect(result.impactLevel).toBe('low');
    });

    it('should calculate impact level based on affected count', async () => {
      const ci = createTestCI('CI-001', 'critical-db');
      mockCmdb.getCIByCiId.mockResolvedValue(ci);

      // Create 10 dependent services
      const relations = [];
      for (let i = 0; i < 10; i++) {
        const depCi = createTestCI(`CI-${100 + i}`, `service-${i}`);
        mockCmdb.getCIByCiId.mockResolvedValueOnce(depCi);
        relations.push({
          id: `rel-${i}`,
          fromCiId: `CI-${100 + i}`,
          toCiId: 'CI-001',
          relationType: 'depends_on',
        });
      }

      mockCmdb.getCIRelations
        .mockResolvedValueOnce(relations);

      // Each dependent service has no further dependencies
      for (let i = 0; i < 10; i++) {
        mockCmdb.getCIRelations.mockResolvedValueOnce([]);
      }

      const result = await service.getImpactAnalysis('CI-001');

      expect(result.affectedNodes.length).toBeGreaterThanOrEqual(10);
      expect(result.impactLevel).toBe('critical');
    });
  });
});
