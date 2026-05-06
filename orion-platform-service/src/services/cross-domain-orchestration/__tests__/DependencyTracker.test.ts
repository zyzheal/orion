/**
 * DependencyTracker Tests
 *
 * Covers: dependency CRUD, impact assessment, dependency resolution,
 * and tenant isolation.
 */

import {
  DependencyTracker,
  CrossDomainDependency,
  CreateDependencyInput,
  ChangeImpact,
} from '../DependencyTracker';

describe('DependencyTracker', () => {
  let tracker: DependencyTracker;

  const validDependency: CreateDependencyInput = {
    sourceDomain: 'pipeline',
    sourceId: 'pipeline-001',
    sourceName: 'Main Build Pipeline',
    targetDomain: 'infrastructure',
    targetId: 'infra-001',
    targetName: 'Production Cluster',
    type: 'hard',
    impactLevel: 'high',
    description: 'Pipeline depends on cluster availability',
  };

  beforeEach(() => {
    tracker = new DependencyTracker();
  });

  // ==================== addDependency ====================

  describe('addDependency', () => {
    it('should create a new dependency with active status', async () => {
      const dep = await tracker.addDependency('tenant-1', validDependency, 'user-1');

      expect(dep.id).toBeDefined();
      expect(dep.tenantId).toBe('tenant-1');
      expect(dep.sourceDomain).toBe('pipeline');
      expect(dep.sourceId).toBe('pipeline-001');
      expect(dep.targetDomain).toBe('infrastructure');
      expect(dep.targetId).toBe('infra-001');
      expect(dep.type).toBe('hard');
      expect(dep.status).toBe('active');
      expect(dep.impactLevel).toBe('high');
      expect(dep.createdBy).toBe('user-1');
      expect(dep.createdAt).toBeInstanceOf(Date);
      expect(dep.updatedAt).toBeInstanceOf(Date);
      expect(dep.resolvedAt).toBeUndefined();
    });

    it('should support all dependency types', async () => {
      const types: Array<'hard' | 'soft' | 'optional'> = ['hard', 'soft', 'optional'];

      for (const type of types) {
        const dep = await tracker.addDependency('tenant-1', {
          ...validDependency,
          type,
          sourceId: `src-${type}`,
        }, 'user-1');
        expect(dep.type).toBe(type);
      }
    });

    it('should support all impact levels', async () => {
      const levels: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];

      for (const level of levels) {
        const dep = await tracker.addDependency('tenant-1', {
          ...validDependency,
          impactLevel: level,
          sourceId: `src-${level}`,
        }, 'user-1');
        expect(dep.impactLevel).toBe(level);
      }
    });

    it('should work without optional description', async () => {
      const dep = await tracker.addDependency('tenant-1', {
        ...validDependency,
        description: undefined,
      }, 'user-1');

      expect(dep.description).toBeUndefined();
    });

    it('should support all domain types', async () => {
      const domains: Array<'pipeline' | 'infrastructure' | 'deployment' | 'monitoring' | 'security'> =
        ['pipeline', 'infrastructure', 'deployment', 'monitoring', 'security'];

      for (const domain of domains) {
        const dep = await tracker.addDependency('tenant-1', {
          ...validDependency,
          sourceDomain: domain,
          targetDomain: domain === 'pipeline' ? 'infrastructure' : 'pipeline',
          sourceId: `src-${domain}`,
        }, 'user-1');
        expect(dep.sourceDomain).toBe(domain);
      }
    });
  });

  // ==================== getDependencies ====================

  describe('getDependencies', () => {
    it('should return all dependencies for a tenant', async () => {
      await tracker.addDependency('tenant-1', { ...validDependency, sourceId: 'p1' }, 'user-1');
      await tracker.addDependency('tenant-1', { ...validDependency, sourceId: 'p2' }, 'user-1');
      await tracker.addDependency('tenant-2', { ...validDependency, sourceId: 'p3' }, 'user-1');

      const deps = await tracker.getDependencies('tenant-1');
      expect(deps.length).toBe(2);
    });

    it('should return empty array when no dependencies exist', async () => {
      const deps = await tracker.getDependencies('tenant-empty');
      expect(deps).toEqual([]);
    });

    it('should enforce tenant isolation', async () => {
      await tracker.addDependency('tenant-1', { ...validDependency, sourceId: 'p1' }, 'user-1');

      const tenant2Deps = await tracker.getDependencies('tenant-2');
      expect(tenant2Deps).toEqual([]);
    });
  });

  // ==================== getSourceDependencies ====================

  describe('getSourceDependencies', () => {
    it('should return dependencies for a specific source', async () => {
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
      }, 'user-1');
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-002',
      }, 'user-1');

      const deps = await tracker.getSourceDependencies('tenant-1', 'pipeline', 'pipeline-001');
      expect(deps.length).toBe(1);
      expect(deps[0].sourceId).toBe('pipeline-001');
    });

    it('should return empty array when source has no dependencies', async () => {
      const deps = await tracker.getSourceDependencies('tenant-1', 'pipeline', 'non-existent');
      expect(deps).toEqual([]);
    });
  });

  // ==================== assessImpact ====================

  describe('assessImpact', () => {
    it('should assess impact for a source with active dependencies', async () => {
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        impactLevel: 'high',
      }, 'user-1');
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        targetId: 'infra-002',
        impactLevel: 'critical',
      }, 'user-1');
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        targetId: 'infra-003',
        impactLevel: 'low',
      }, 'user-1');

      const impact = await tracker.assessImpact('tenant-1', 'pipeline', 'pipeline-001', 'Infrastructure upgrade');

      expect(impact.changeId).toBeDefined();
      expect(impact.changeDescription).toBe('Infrastructure upgrade');
      expect(impact.sourceDomain).toBe('pipeline');
      expect(impact.impactedDependencies.length).toBe(3);
      expect(impact.impactSummary.high).toBe(1);
      expect(impact.impactSummary.critical).toBe(1);
      expect(impact.impactSummary.low).toBe(1);
      expect(impact.requiresApproval).toBe(true);
    });

    it('should require approval when critical dependencies exist', async () => {
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        impactLevel: 'critical',
      }, 'user-1');

      const impact = await tracker.assessImpact('tenant-1', 'pipeline', 'pipeline-001', 'Change');
      expect(impact.requiresApproval).toBe(true);
    });

    it('should require approval when high dependencies exist', async () => {
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        impactLevel: 'high',
      }, 'user-1');

      const impact = await tracker.assessImpact('tenant-1', 'pipeline', 'pipeline-001', 'Change');
      expect(impact.requiresApproval).toBe(true);
    });

    it('should not require approval for only low/medium dependencies', async () => {
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        impactLevel: 'low',
      }, 'user-1');
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        targetId: 'infra-002',
        impactLevel: 'medium',
      }, 'user-1');

      const impact = await tracker.assessImpact('tenant-1', 'pipeline', 'pipeline-001', 'Minor change');
      expect(impact.requiresApproval).toBe(false);
    });

    it('should only count active dependencies in impact summary', async () => {
      const dep1 = await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        impactLevel: 'high',
      }, 'user-1');
      await tracker.addDependency('tenant-1', {
        ...validDependency,
        sourceId: 'pipeline-001',
        targetId: 'infra-002',
        impactLevel: 'critical',
      }, 'user-1');

      // Resolve one dependency
      await tracker.resolveDependency(dep1.id);

      const impact = await tracker.assessImpact('tenant-1', 'pipeline', 'pipeline-001', 'Change');
      expect(impact.impactedDependencies.length).toBe(1);
      expect(impact.impactSummary.high).toBe(0);
      expect(impact.impactSummary.critical).toBe(1);
    });

    it('should return empty impact when no dependencies exist', async () => {
      const impact = await tracker.assessImpact('tenant-1', 'pipeline', 'non-existent', 'Change');

      expect(impact.impactedDependencies).toEqual([]);
      expect(impact.impactSummary).toEqual({ high: 0, medium: 0, low: 0, critical: 0 });
      expect(impact.requiresApproval).toBe(false);
    });
  });

  // ==================== resolveDependency ====================

  describe('resolveDependency', () => {
    it('should resolve an active dependency', async () => {
      const dep = await tracker.addDependency('tenant-1', validDependency, 'user-1');

      const resolved = await tracker.resolveDependency(dep.id);

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAt).toBeInstanceOf(Date);
      expect(resolved.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw for non-existent dependency', async () => {
      await expect(
        tracker.resolveDependency('non-existent')
      ).rejects.toThrow("Dependency 'non-existent' not found");
    });
  });

  // ==================== deleteDependency ====================

  describe('deleteDependency', () => {
    it('should delete an existing dependency', async () => {
      const dep = await tracker.addDependency('tenant-1', validDependency, 'user-1');

      const deleted = await tracker.deleteDependency(dep.id);
      expect(deleted).toBe(true);

      const deps = await tracker.getDependencies('tenant-1');
      expect(deps.length).toBe(0);
    });

    it('should return false for non-existent dependency', async () => {
      const deleted = await tracker.deleteDependency('non-existent');
      expect(deleted).toBe(false);
    });
  });
});
