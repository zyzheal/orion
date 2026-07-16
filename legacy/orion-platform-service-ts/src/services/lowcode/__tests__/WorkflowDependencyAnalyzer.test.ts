/**
 * WorkflowDependencyAnalyzer - 工作流依赖分析器测试
 *
 * 覆盖：constructor, buildDependencyGraph, analyze, checkDefinition,
 *        getVisualizationData, 循环依赖检测, 无依赖图, 深度限制
 */

import { WorkflowDependencyAnalyzer } from '../WorkflowDependencyAnalyzer';
import { WorkflowDefinitionRepository } from '../WorkflowRepository';
import type { WorkflowDefinition } from '../types';

// ---- helpers ----

function makeDef(id: string, name: string, subWorkflowIds: string[] = []): WorkflowDefinition {
  const nodes: any[] = [
    { id: `${id}-start`, type: 'start', name: 'Start', position: { x: 0, y: 0 }, config: { type: 'start' } },
  ];

  for (let i = 0; i < subWorkflowIds.length; i++) {
    nodes.push({
      id: `${id}-sub-${i}`,
      type: 'sub-workflow',
      name: `Sub ${i}`,
      position: { x: (i + 1) * 100, y: 0 },
      config: { type: 'sub-workflow', subWorkflowId: subWorkflowIds[i], waitForCompletion: true },
    });
  }

  nodes.push({ id: `${id}-end`, type: 'end', name: 'End', position: { x: (subWorkflowIds.length + 1) * 100, y: 0 }, config: { type: 'end' } });

  return {
    id,
    tenantId: 'tenant-1',
    name,
    version: 1,
    enabled: true,
    nodes,
    edges: [],
    createdBy: 'test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockDefRepo(): jest.Mocked<WorkflowDefinitionRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(),
    findAll: jest.fn(),
    findByTenant: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as any;
}

// ---- tests ----

describe('WorkflowDependencyAnalyzer', () => {
  let mockRepo: jest.Mocked<WorkflowDefinitionRepository>;
  let analyzer: WorkflowDependencyAnalyzer;

  beforeEach(() => {
    mockRepo = createMockDefRepo();
    analyzer = new WorkflowDependencyAnalyzer(mockRepo as any);
  });

  // ========== constructor ==========

  describe('constructor', () => {
    it('should accept a custom repository', () => {
      expect(analyzer).toBeDefined();
    });
  });

  // ========== buildDependencyGraph ==========

  describe('buildDependencyGraph', () => {
    it('should build graph with no definitions', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
      expect(graph.cycles).toHaveLength(0);
    });

    it('should build graph with definitions that have no sub-workflow calls', async () => {
      const defs = [makeDef('a', 'A'), makeDef('b', 'B')];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.nodes.size).toBe(2);
      expect(graph.nodes.get('a')).toBe('A');
      expect(graph.nodes.get('b')).toBe('B');
      expect(graph.edges.get('a')).toEqual([]);
      expect(graph.edges.get('b')).toEqual([]);
      expect(graph.cycles).toHaveLength(0);
    });

    it('should detect edges for sub-workflow nodes', async () => {
      const defs = [makeDef('a', 'A', ['b']), makeDef('b', 'B')];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.edges.get('a')).toEqual(['b']);
      expect(graph.edges.get('b')).toEqual([]);
      expect(graph.cycles).toHaveLength(0);
    });

    it('should detect a two-node cycle (A -> B -> A)', async () => {
      const defs = [makeDef('a', 'A', ['b']), makeDef('b', 'B', ['a'])];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.cycles.length).toBeGreaterThanOrEqual(1);
      const cycle = graph.cycles[0];
      expect(cycle.cycle).toContain('a');
      expect(cycle.cycle).toContain('b');
      expect(cycle.length).toBe(2);
    });

    it('should detect a three-node cycle (A -> B -> C -> A)', async () => {
      const defs = [
        makeDef('a', 'A', ['b']),
        makeDef('b', 'B', ['c']),
        makeDef('c', 'C', ['a']),
      ];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 3 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.cycles.length).toBeGreaterThanOrEqual(1);
      const cycle = graph.cycles[0];
      expect(cycle.cycle).toContain('a');
      expect(cycle.cycle).toContain('b');
      expect(cycle.cycle).toContain('c');
      expect(cycle.length).toBe(3);
    });

    it('should not detect cycles for linear chain (A -> B -> C)', async () => {
      const defs = [
        makeDef('a', 'A', ['b']),
        makeDef('b', 'B', ['c']),
        makeDef('c', 'C'),
      ];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 3 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.cycles).toHaveLength(0);
    });

    it('should handle self-referencing definition (A -> A)', async () => {
      const defs = [makeDef('a', 'A', ['a'])];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 1 });

      const graph = await analyzer.buildDependencyGraph();

      expect(graph.cycles.length).toBeGreaterThanOrEqual(1);
      expect(graph.cycles[0].cycle).toContain('a');
    });
  });

  // ========== analyze ==========

  describe('analyze', () => {
    it('should return safe when no definitions exist', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      const result = await analyzer.analyze();

      expect(result.isSafe).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.totalDefinitions).toBe(0);
      expect(result.totalEdges).toBe(0);
    });

    it('should return safe for independent definitions', async () => {
      const defs = [makeDef('a', 'A'), makeDef('b', 'B')];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const result = await analyzer.analyze();

      expect(result.isSafe).toBe(true);
      expect(result.totalDefinitions).toBe(2);
      expect(result.totalEdges).toBe(0);
    });

    it('should return unsafe when cycles exist', async () => {
      const defs = [makeDef('a', 'A', ['b']), makeDef('b', 'B', ['a'])];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const result = await analyzer.analyze();

      expect(result.isSafe).toBe(false);
      expect(result.cycles.length).toBeGreaterThanOrEqual(1);
      expect(result.totalDefinitions).toBe(2);
      expect(result.totalEdges).toBe(2);
    });

    it('should count total edges correctly', async () => {
      const defs = [makeDef('a', 'A', ['b', 'c']), makeDef('b', 'B'), makeDef('c', 'C')];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 3 });

      const result = await analyzer.analyze();

      expect(result.totalEdges).toBe(2);
    });
  });

  // ========== checkDefinition ==========

  describe('checkDefinition', () => {
    it('should return isValid=false and error when definition not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const result = await analyzer.checkDefinition('nonexistent');

      expect(result.isSafe).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Definition not found');
      expect(result.cycles).toEqual([]);
    });

    it('should return safe when definition has no sub-workflow dependencies', async () => {
      const def = makeDef('a', 'A');
      mockRepo.findById.mockResolvedValue(def);

      const result = await analyzer.checkDefinition('a');

      expect(result.isSafe).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.dependencies).toEqual([]);
      expect(result.cycles).toHaveLength(0);
    });

    it('should return safe for non-circular dependency', async () => {
      const defA = makeDef('a', 'A', ['b']);
      const defB = makeDef('b', 'B');
      mockRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'a') return defA;
        if (id === 'b') return defB;
        return null;
      });
      mockRepo.findByIds.mockResolvedValue(new Map([['b', 'B']]));

      const result = await analyzer.checkDefinition('a');

      expect(result.isSafe).toBe(true);
      expect(result.dependencies).toEqual(['b']);
    });

    it('should detect circular dependency (A -> B -> A)', async () => {
      const defA = makeDef('a', 'A', ['b']);
      const defB = makeDef('b', 'B', ['a']);
      mockRepo.findById.mockImplementation(async (id: string) => {
        if (id === 'a') return defA;
        if (id === 'b') return defB;
        return null;
      });
      mockRepo.findByIds.mockResolvedValue(new Map([['a', 'A'], ['b', 'B']]));

      const result = await analyzer.checkDefinition('a');

      expect(result.isSafe).toBe(false);
      expect(result.cycles.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== getVisualizationData ==========

  describe('getVisualizationData', () => {
    it('should return nodes, edges, and cycles', async () => {
      const defs = [makeDef('a', 'A', ['b']), makeDef('b', 'B', ['a'])];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const viz = await analyzer.getVisualizationData();

      expect(viz.nodes).toHaveLength(2);
      expect(viz.edges).toHaveLength(2);
      expect(viz.cycles.length).toBeGreaterThanOrEqual(1);

      // Check that cycle nodes are marked
      const nodeA = viz.nodes.find(n => n.id === 'a');
      expect(nodeA?.inCycle).toBe(true);
    });

    it('should mark non-cycle nodes correctly', async () => {
      const defs = [makeDef('a', 'A', ['b']), makeDef('b', 'B')];
      mockRepo.findAll.mockResolvedValue({ entities: defs, total: 2 });

      const viz = await analyzer.getVisualizationData();

      const nodeA = viz.nodes.find(n => n.id === 'a');
      const nodeB = viz.nodes.find(n => n.id === 'b');
      expect(nodeA?.inCycle).toBe(false);
      expect(nodeB?.inCycle).toBe(false);
    });
  });
});
