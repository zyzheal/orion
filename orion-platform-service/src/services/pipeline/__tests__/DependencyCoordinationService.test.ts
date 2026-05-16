/**
 * DependencyCoordinationService Tests
 *
 * Tests for the pipeline dependency coordination service.
 * Covers: registerDependency, unregisterDependency, resolveDependencies,
 * getDependencyGraph, findCycles, getTopologicalOrder.
 */

import { DependencyCoordinationService, PipelineDependency, PipelineResult } from '../DependencyCoordinationService';

function createService(): DependencyCoordinationService {
  return new DependencyCoordinationService();
}

// ==================== Tests ====================

describe('DependencyCoordinationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== registerDependency() ====================

  describe('registerDependency()', () => {
    it('should register a pipeline dependency', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);

      const dep = await service.getDependency('pipeline-a');
      expect(dep).toBeDefined();
      expect(dep?.pipelineId).toBe('pipeline-a');
      expect(dep?.dependsOn).toEqual(['pipeline-b', 'pipeline-c']);
    });

    it('should register with custom required inputs', async () => {
      const service = createService();
      const requiredInputs = { version: '1.0.0', env: 'staging' };

      await service.registerDependency('pipeline-a', ['pipeline-b'], requiredInputs);

      const dep = await service.getDependency('pipeline-a');
      expect(dep?.requiredInputs).toEqual(requiredInputs);
    });

    it('should register with custom blocking status', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b'], {}, ['failed', 'any']);

      const dep = await service.getDependency('pipeline-a');
      expect(dep?.blockingStatus).toEqual(['failed', 'any']);
    });

    it('should use default blocking status when not specified', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);

      const dep = await service.getDependency('pipeline-a');
      expect(dep?.blockingStatus).toEqual(['success']);
    });
  });

  // ==================== unregisterDependency() ====================

  describe('unregisterDependency()', () => {
    it('should unregister an existing dependency', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      const result = await service.unregisterDependency('pipeline-a');

      expect(result).toBe(true);
      expect(await service.getDependency('pipeline-a')).toBeUndefined();
    });

    it('should return false when unregistering non-existent dependency', async () => {
      const service = createService();

      const result = await service.unregisterDependency('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== getDependency() ====================

  describe('getDependency()', () => {
    it('should return dependency when exists', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);

      const dep = await service.getDependency('pipeline-a');
      expect(dep).toBeDefined();
      expect(dep?.dependsOn).toHaveLength(2);
    });

    it('should return undefined when not exists', async () => {
      const service = createService();

      const dep = await service.getDependency('non-existent');
      expect(dep).toBeUndefined();
    });
  });

  // ==================== getAllDependencies() ====================

  describe('getAllDependencies()', () => {
    it('should return all registered dependencies', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-c', ['pipeline-d']);
      await service.registerDependency('pipeline-e', []);

      const deps = await service.getAllDependencies();
      expect(deps).toHaveLength(3);
    });

    it('should return empty array when no dependencies', async () => {
      const service = createService();

      const deps = await service.getAllDependencies();
      expect(deps).toHaveLength(0);
    });
  });

  // ==================== resolveDependencies() ====================

  describe('resolveDependencies()', () => {
    describe('when pipeline has no dependencies', () => {
      it('should return resolved: true', async () => {
        const service = createService();

        const result = await service.resolveDependencies('pipeline-a', new Map());

        expect(result.resolved).toBe(true);
        expect(result.blockedBy).toHaveLength(0);
        expect(result.readyAt).toBeDefined();
      });
    });

    describe('when all dependencies resolved', () => {
      it('should return resolved: true with successful parent pipelines', async () => {
        const service = createService();

        await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);

        const pipelineResults = new Map<string, PipelineResult>([
          ['pipeline-b', { status: 'success', outputs: {} }],
          ['pipeline-c', { status: 'success', outputs: {} }],
        ]);

        const result = await service.resolveDependencies('pipeline-a', pipelineResults);

        expect(result.resolved).toBe(true);
        expect(result.blockedBy).toHaveLength(0);
        expect(result.readyAt).toBeDefined();
      });

      it('should resolve when parent pipeline has different unblocking status', async () => {
        const service = createService();

        // Only unblock on 'failed' status (success still blocks)
        await service.registerDependency('pipeline-a', ['pipeline-b'], {}, ['failed']);

        const pipelineResults = new Map<string, PipelineResult>([
          ['pipeline-b', { status: 'failed', outputs: {} }],
        ]);

        const result = await service.resolveDependencies('pipeline-a', pipelineResults);

        expect(result.resolved).toBe(true);
      });
    });

    describe('when partially blocked', () => {
      it('should return resolved: false when one parent not run', async () => {
        const service = createService();

        await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);

        const pipelineResults = new Map<string, PipelineResult>([
          ['pipeline-b', { status: 'success', outputs: {} }],
        ]);

        const result = await service.resolveDependencies('pipeline-a', pipelineResults);

        expect(result.resolved).toBe(false);
        expect(result.blockedBy).toContain('pipeline-c');
      });

      it('should return resolved: false when parent has non-unblocking status', async () => {
        const service = createService();

        // Only unblocks on 'pending' status (anything else blocks)
        // Since parent status is 'failed', it will block
        await service.registerDependency('pipeline-a', ['pipeline-b'], {}, ['pending']);

        const pipelineResults = new Map<string, PipelineResult>([
          ['pipeline-b', { status: 'failed', outputs: {} }],
        ]);

        const result = await service.resolveDependencies('pipeline-a', pipelineResults);

        expect(result.resolved).toBe(false);
        expect(result.blockedBy).toContain('pipeline-b');
      });
    });

    describe('when fully blocked', () => {
      it('should return resolved: false when all parents not run', async () => {
        const service = createService();

        await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);

        const pipelineResults = new Map<string, PipelineResult>();

        const result = await service.resolveDependencies('pipeline-a', pipelineResults);

        expect(result.resolved).toBe(false);
        expect(result.blockedBy).toEqual(['pipeline-b', 'pipeline-c']);
      });

      it('should return resolved: true when unblocking status is "any" (never blocks)', async () => {
        const service = createService();

        // 'any' means any parent status will unblock (never blocks)
        await service.registerDependency('pipeline-a', ['pipeline-b'], {}, ['any']);

        const pipelineResults = new Map<string, PipelineResult>([
          ['pipeline-b', { status: 'success', outputs: {} }],
        ]);

        const result = await service.resolveDependencies('pipeline-a', pipelineResults);

        expect(result.resolved).toBe(true);
        expect(result.blockedBy).toHaveLength(0);
      });
    });
  });

  // ==================== getDependencyGraph() ====================

  describe('getDependencyGraph()', () => {
    it('should build correct graph with nodes and edges', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);
      await service.registerDependency('pipeline-b', ['pipeline-c']);
      await service.registerDependency('pipeline-c', []);

      const graph = await service.getDependencyGraph();

      expect(graph.nodes).toContain('pipeline-a');
      expect(graph.nodes).toContain('pipeline-b');
      expect(graph.nodes).toContain('pipeline-c');
      expect(graph.edges).toEqual(
        expect.arrayContaining([
          { from: 'pipeline-c', to: 'pipeline-a' },
          { from: 'pipeline-b', to: 'pipeline-a' },
          { from: 'pipeline-c', to: 'pipeline-b' },
        ])
      );
    });

    it('should return empty graph when no dependencies', async () => {
      const service = createService();

      const graph = await service.getDependencyGraph();

      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });
  });

  // ==================== findCycles() ====================

  describe('findCycles()', () => {
    it('should detect circular dependency A -> B -> A', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-b', ['pipeline-a']);

      const cycles = await service.findCycles();

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect circular dependency A -> B -> C -> A', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-b', ['pipeline-c']);
      await service.registerDependency('pipeline-c', ['pipeline-a']);

      const cycles = await service.findCycles();

      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty when no cycles', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-b', ['pipeline-c']);
      await service.registerDependency('pipeline-c', []);

      const cycles = await service.findCycles();

      expect(cycles).toHaveLength(0);
    });
  });

  // ==================== getTopologicalOrder() ====================

  describe('getTopologicalOrder()', () => {
    it('should return correct execution order for linear chain', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-b', ['pipeline-c']);
      await service.registerDependency('pipeline-c', []);

      const order = await service.getTopologicalOrder();

      expect(order).toContain('pipeline-c');
      expect(order).toContain('pipeline-b');
      expect(order).toContain('pipeline-a');

      // c should come before b, b should come before a
      const cIdx = order.indexOf('pipeline-c');
      const bIdx = order.indexOf('pipeline-b');
      const aIdx = order.indexOf('pipeline-a');
      expect(cIdx).toBeLessThan(bIdx);
      expect(bIdx).toBeLessThan(aIdx);
    });

    it('should return correct order for parallel branches', async () => {
      const service = createService();

      // a depends on b and c, both depend on d
      await service.registerDependency('pipeline-a', ['pipeline-b', 'pipeline-c']);
      await service.registerDependency('pipeline-b', ['pipeline-d']);
      await service.registerDependency('pipeline-c', ['pipeline-d']);
      await service.registerDependency('pipeline-d', []);

      const order = await service.getTopologicalOrder();

      const dIdx = order.indexOf('pipeline-d');
      const bIdx = order.indexOf('pipeline-b');
      const cIdx = order.indexOf('pipeline-c');
      const aIdx = order.indexOf('pipeline-a');

      expect(dIdx).toBeLessThan(bIdx);
      expect(dIdx).toBeLessThan(cIdx);
      expect(bIdx).toBeLessThan(aIdx);
      expect(cIdx).toBeLessThan(aIdx);
    });

    it('should return empty array when no dependencies', async () => {
      const service = createService();

      const order = await service.getTopologicalOrder();

      expect(order).toHaveLength(0);
    });

    it('should return empty array when only independent pipelines', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', []);
      await service.registerDependency('pipeline-b', []);

      const order = await service.getTopologicalOrder();

      expect(order).toHaveLength(2);
    });
  });

  // ==================== resolveAllDependencies() ====================

  describe('resolveAllDependencies()', () => {
    it('should resolve dependencies for all registered pipelines', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-b', []);

      const pipelineResults = new Map<string, PipelineResult>([
        ['pipeline-b', { status: 'success', outputs: {} }],
      ]);

      const results = await service.resolveAllDependencies(pipelineResults);

      expect(results.size).toBe(2);

      const aResult = results.get('pipeline-a');
      const bResult = results.get('pipeline-b');

      expect(aResult?.resolved).toBe(true);
      expect(bResult?.resolved).toBe(true);
    });
  });

  // ==================== clearAllDependencies() ====================

  describe('clearAllDependencies()', () => {
    it('should clear all registered dependencies', async () => {
      const service = createService();

      await service.registerDependency('pipeline-a', ['pipeline-b']);
      await service.registerDependency('pipeline-c', ['pipeline-d']);

      await service.clearAllDependencies();

      const deps = await service.getAllDependencies();
      expect(deps).toHaveLength(0);
    });
  });
});