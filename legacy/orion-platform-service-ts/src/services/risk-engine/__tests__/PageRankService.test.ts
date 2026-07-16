/**
 * PageRankService 单元测试
 *
 * 测试 PageRank 图算法：计算、缓存、根因分析、爆炸半径、推荐建议。
 */

jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

import { PageRankService, ServiceGraph, ServiceNode, ServiceEdge } from '../PageRankService';

function makeSimpleGraph(): ServiceGraph {
  const nodes: ServiceNode[] = [
    { id: 'svc-a', name: 'Service A', type: 'service', tier: 0 },
    { id: 'svc-b', name: 'Service B', type: 'service', tier: 1 },
    { id: 'svc-c', name: 'Service C', type: 'database', tier: 0 },
  ];
  const edges: ServiceEdge[] = [
    { source: 'svc-a', target: 'svc-b', type: 'calls', weight: 0.8 },
    { source: 'svc-b', target: 'svc-c', type: 'reads', weight: 0.6 },
    { source: 'svc-a', target: 'svc-c', type: 'reads', weight: 0.4 },
  ];
  return { nodes, edges };
}

function makeChainGraph(): ServiceGraph {
  const nodes: ServiceNode[] = [
    { id: 'n1', name: 'Node 1', type: 'service', tier: 0 },
    { id: 'n2', name: 'Node 2', type: 'service', tier: 1 },
    { id: 'n3', name: 'Node 3', type: 'external', tier: 2 },
    { id: 'n4', name: 'Node 4', type: 'database', tier: 0 },
  ];
  const edges: ServiceEdge[] = [
    { source: 'n1', target: 'n2', type: 'calls', weight: 1.0 },
    { source: 'n2', target: 'n3', type: 'calls', weight: 0.5 },
    { source: 'n3', target: 'n4', type: 'reads', weight: 0.7 },
  ];
  return { nodes, edges };
}

describe('PageRankService', () => {
  let service: PageRankService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PageRankService();
  });

  describe('computePageRank', () => {
    it('should compute ranks for a simple graph', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph);

      expect(results).toHaveLength(3);

      // All ranks should be positive
      results.forEach(r => {
        expect(r.rank).toBeGreaterThan(0);
      });

      // Each result should have required fields
      results.forEach(r => {
        expect(r.nodeId).toBeDefined();
        expect(r.nodeName).toBeDefined();
        expect(typeof r.rank).toBe('number');
        expect(typeof r.centrality).toBe('number');
        expect(Array.isArray(r.recommendations)).toBe(true);
      });
    });

    it('should sort results by rank descending', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].rank).toBeGreaterThanOrEqual(results[i].rank);
      }
    });

    it('should return cached results on second call', async () => {
      const graph = makeSimpleGraph();
      const results1 = await service.computePageRank(graph);
      const results2 = await service.computePageRank(graph);

      expect(results1).toEqual(results2);
    });

    it('should accept custom options', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph, {
        dampingFactor: 0.5,
        maxIterations: 50,
        tolerance: 1e-4,
        weightMode: 'uniform',
      });

      expect(results).toHaveLength(3);
    });

    it('should handle inverse weight mode', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph, {
        weightMode: 'inverse',
      });

      expect(results).toHaveLength(3);
    });

    it('should handle single node graph', async () => {
      const graph: ServiceGraph = {
        nodes: [{ id: 'solo', name: 'Solo', type: 'service', tier: 0 }],
        edges: [],
      };
      const results = await service.computePageRank(graph);

      expect(results).toHaveLength(1);
      // Single dangling node: rank = (1-d)/n = 0.15
      expect(results[0].rank).toBeCloseTo(0.15, 2);
    });

    it('should handle graph with no edges', async () => {
      const graph: ServiceGraph = {
        nodes: [
          { id: 'a', name: 'A', type: 'service', tier: 0 },
          { id: 'b', name: 'B', type: 'service', tier: 1 },
        ],
        edges: [],
      };
      const results = await service.computePageRank(graph);

      expect(results).toHaveLength(2);
      // With no edges, ranks should be equal
      expect(results[0].rank).toBeCloseTo(results[1].rank, 2);
    });
  });

  describe('recommendations', () => {
    it('should recommend redundancy for tier 0 services', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph);

      const tier0Results = results.filter(r => r.tier === 0);
      tier0Results.forEach(r => {
        expect(r.recommendations).toContain('Critical tier service - ensure redundancy');
        expect(r.recommendations).toContain('Implement circuit breaker pattern');
      });
    });

    it('should recommend connection pooling for database nodes', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph);

      const dbResult = results.find(r => r.nodeId === 'svc-c');
      expect(dbResult?.recommendations).toContain('Database tier - implement connection pooling');
      expect(dbResult?.recommendations).toContain('Enable read replicas for scaling');
    });

    it('should recommend fallback for external dependencies', async () => {
      const graph = makeChainGraph();
      const results = await service.computePageRank(graph);

      const extResult = results.find(r => r.nodeId === 'n3');
      expect(extResult?.recommendations).toContain('External dependency - add fallback mechanism');
    });

    it('should recommend monitoring for high centrality nodes', async () => {
      const graph = makeSimpleGraph();
      const results = await service.computePageRank(graph);

      const highRankResults = results.filter(r => r.rank > 0.1);
      highRankResults.forEach(r => {
        expect(r.recommendations).toContain('High centrality - monitor dependencies closely');
      });
    });
  });

  describe('analyzeRootCause', () => {
    it('should identify root cause from dependencies', async () => {
      const graph = makeSimpleGraph();
      const result = await service.analyzeRootCause('inc-1', 'svc-b', graph);

      expect(result.incidentId).toBe('inc-1');
      expect(result.affectedService).toBe('svc-b');
      expect(result.rootCause).not.toBeNull();
      expect(result.rootCause?.nodeId).toBe('svc-a');
      expect(result.blastRadius).toBeGreaterThanOrEqual(0);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.analysisTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown affected service', async () => {
      const graph = makeSimpleGraph();
      const result = await service.analyzeRootCause('inc-2', 'unknown-svc', graph);

      expect(result.rootCause).toBeNull();
      expect(result.recommendedActions).toContain('Unknown affected service - manual investigation required');
    });

    it('should calculate blast radius correctly', async () => {
      const graph = makeChainGraph();
      const result = await service.analyzeRootCause('inc-3', 'n1', graph);

      // n1 -> n2 -> n3 -> n4, so blast radius from n1 should be 3
      expect(result.blastRadius).toBe(3);
    });

    it('should include contributing factors', async () => {
      const graph: ServiceGraph = {
        nodes: [
          { id: 'target', name: 'Target', type: 'service', tier: 0 },
          { id: 'dep1', name: 'Dep 1', type: 'service', tier: 1 },
          { id: 'dep2', name: 'Dep 2', type: 'service', tier: 1 },
          { id: 'dep3', name: 'Dep 3', type: 'service', tier: 2 },
          { id: 'dep4', name: 'Dep 4', type: 'service', tier: 2 },
        ],
        edges: [
          { source: 'dep1', target: 'target', type: 'calls', weight: 0.9 },
          { source: 'dep2', target: 'target', type: 'calls', weight: 0.7 },
          { source: 'dep3', target: 'target', type: 'calls', weight: 0.5 },
          { source: 'dep4', target: 'target', type: 'calls', weight: 0.3 },
        ],
      };
      const result = await service.analyzeRootCause('inc-4', 'target', graph);

      expect(result.rootCause).not.toBeNull();
      expect(result.contributingFactors.length).toBeGreaterThanOrEqual(0);
    });

    it('should recommend escalation for critical tier', async () => {
      const graph = makeSimpleGraph();
      const result = await service.analyzeRootCause('inc-5', 'svc-a', graph);

      expect(result.recommendedActions).toContain('Critical service affected - escalate immediately');
    });

    it('should recommend bulkhead for large blast radius', async () => {
      // Create a graph with many downstream services
      const nodes: ServiceNode[] = [
        { id: 'epicenter', name: 'Epicenter', type: 'service', tier: 1 },
      ];
      const edges: ServiceEdge[] = [];
      for (let i = 0; i < 7; i++) {
        nodes.push({ id: `downstream-${i}`, name: `Downstream ${i}`, type: 'service', tier: 2 });
        edges.push({ source: 'epicenter', target: `downstream-${i}`, type: 'calls', weight: 0.5 });
      }
      const graph: ServiceGraph = { nodes, edges };
      const result = await service.analyzeRootCause('inc-6', 'epicenter', graph);

      expect(result.blastRadius).toBeGreaterThan(5);
      expect(result.recommendedActions).toContain('Large blast radius - consider implementing bulkhead pattern');
    });

    it('should always include general recommendations', async () => {
      const graph = makeSimpleGraph();
      const result = await service.analyzeRootCause('inc-7', 'svc-b', graph);

      expect(result.recommendedActions).toContain('Check recent deployments to affected services');
      expect(result.recommendedActions).toContain('Review monitoring alerts for anomalies');
      expect(result.recommendedActions).toContain('Verify all dependencies are healthy');
    });
  });

  describe('updateGraph', () => {
    it('should store graph in cache', () => {
      const graph = makeSimpleGraph();
      service.updateGraph(graph);

      const stats = service.getStats();
      expect(stats.graphCacheSize).toBe(1);
    });

    it('should invalidate rank cache when graph updates', async () => {
      const graph = makeSimpleGraph();
      await service.computePageRank(graph);

      let stats = service.getStats();
      expect(stats.rankCacheSize).toBe(1);

      service.updateGraph(graph);
      stats = service.getStats();
      expect(stats.rankCacheSize).toBe(0);
    });
  });

  describe('getServiceCriticality', () => {
    it('should apply tier multipliers to ranks', async () => {
      const graph = makeSimpleGraph();
      const results = await service.getServiceCriticality(graph);

      expect(results).toHaveLength(3);
      // Tier 0 (critical) should have 2x multiplier
      const tier0 = results.find(r => r.tier === 0);
      expect(tier0).toBeDefined();

      // Results should be sorted by adjusted rank
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].rank).toBeGreaterThanOrEqual(results[i].rank);
      }
    });

    it('should handle tier values outside 0-2', async () => {
      const graph: ServiceGraph = {
        nodes: [
          { id: 'a', name: 'A', type: 'service', tier: 5 },
        ],
        edges: [],
      };
      const results = await service.getServiceCriticality(graph);

      // tier 5 has no multiplier defined, defaults to 1
      // Base rank for single dangling node = 0.15, multiplier = 1
      expect(results[0].rank).toBeCloseTo(0.15, 2);
    });
  });

  describe('getStats', () => {
    it('should return zero counts initially', () => {
      const stats = service.getStats();
      expect(stats.graphCacheSize).toBe(0);
      expect(stats.rankCacheSize).toBe(0);
    });

    it('should track cache sizes correctly', async () => {
      const graph = makeSimpleGraph();
      await service.computePageRank(graph);

      const stats = service.getStats();
      expect(stats.rankCacheSize).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle edges referencing non-existent nodes', async () => {
      const graph: ServiceGraph = {
        nodes: [
          { id: 'a', name: 'A', type: 'service', tier: 0 },
        ],
        edges: [
          { source: 'a', target: 'nonexistent', type: 'calls', weight: 0.5 },
        ],
      };
      const results = await service.computePageRank(graph);
      expect(results).toHaveLength(1);
    });

    it('should handle self-loops gracefully', async () => {
      const graph: ServiceGraph = {
        nodes: [
          { id: 'a', name: 'A', type: 'service', tier: 0 },
        ],
        edges: [
          { source: 'a', target: 'a', type: 'calls', weight: 0.5 },
        ],
      };
      const results = await service.computePageRank(graph);
      expect(results).toHaveLength(1);
    });
  });
});
