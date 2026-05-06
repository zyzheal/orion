/**
 * ArtifactOperationService Tests
 *
 * Covers: operation tracking, status updates, operation history with filters,
 * artifact statistics, tenant cleanup.
 */

import {
  ArtifactOperationService,
  ArtifactOperationInput,
  OperationFilters,
} from '../ArtifactOperationService';

describe('ArtifactOperationService', () => {
  let service: ArtifactOperationService;

  const validOperation: ArtifactOperationInput = {
    artifactId: 'artifact-001',
    operation: 'build',
    source: 'git-repo',
    target: 'registry',
    metadata: { branch: 'main' },
  };

  beforeEach(() => {
    service = new ArtifactOperationService();
  });

  afterEach(() => {
    service.destroy();
  });

  // ==================== trackOperation ====================

  describe('trackOperation', () => {
    it('should track a new operation with pending status', () => {
      const operation = service.trackOperation('tenant-1', validOperation);

      expect(operation.id).toBeDefined();
      expect(operation.tenantId).toBe('tenant-1');
      expect(operation.artifactId).toBe('artifact-001');
      expect(operation.operation).toBe('build');
      expect(operation.status).toBe('pending');
      expect(operation.source).toBe('git-repo');
      expect(operation.target).toBe('registry');
      expect(operation.metadata).toEqual({ branch: 'main' });
      expect(operation.createdAt).toBeDefined();
      expect(operation.completedAt).toBeUndefined();
      expect(operation.duration).toBeUndefined();
    });

    it('should track all operation types', () => {
      const operations: Array<'build' | 'publish' | 'deploy' | 'scan' | 'promote' | 'delete' | 'rollback'> =
        ['build', 'publish', 'deploy', 'scan', 'promote', 'delete', 'rollback'];

      for (const op of operations) {
        const operation = service.trackOperation('tenant-1', {
          artifactId: `artifact-${op}`,
          operation: op,
        });
        expect(operation.operation).toBe(op);
      }
    });

    it('should work with minimal input', () => {
      const operation = service.trackOperation('tenant-1', {
        artifactId: 'minimal-artifact',
        operation: 'build',
      });

      expect(operation.artifactId).toBe('minimal-artifact');
      expect(operation.source).toBeUndefined();
      expect(operation.target).toBeUndefined();
      expect(operation.metadata).toBeUndefined();
    });

    it('should index operations by tenant', () => {
      service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'build' });
      service.trackOperation('tenant-2', { artifactId: 'a3', operation: 'build' });

      const tenant1Ops = service.getOperationHistory('tenant-1');
      expect(tenant1Ops.length).toBe(2);

      const tenant2Ops = service.getOperationHistory('tenant-2');
      expect(tenant2Ops.length).toBe(1);
    });

    it('should generate unique IDs for each operation', () => {
      const op1 = service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      const op2 = service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'build' });

      expect(op1.id).not.toBe(op2.id);
    });
  });

  // ==================== updateOperationStatus ====================

  describe('updateOperationStatus', () => {
    it('should update operation status', () => {
      const created = service.trackOperation('tenant-1', validOperation);

      const updated = service.updateOperationStatus(created.id, 'running');
      expect(updated?.status).toBe('running');
    });

    it('should set completion time and duration when marking completed', () => {
      const created = service.trackOperation('tenant-1', validOperation);

      const completedAt = new Date(Date.now() + 5000).toISOString();
      const updated = service.updateOperationStatus(created.id, 'completed', completedAt);

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBe(completedAt);
      expect(updated?.duration).toBeGreaterThan(0);
    });

    it('should update to failed status', () => {
      const created = service.trackOperation('tenant-1', validOperation);

      const updated = service.updateOperationStatus(created.id, 'failed');
      expect(updated?.status).toBe('failed');
    });

    it('should update to cancelled status', () => {
      const created = service.trackOperation('tenant-1', validOperation);

      const updated = service.updateOperationStatus(created.id, 'cancelled');
      expect(updated?.status).toBe('cancelled');
    });

    it('should return undefined for non-existent operation', () => {
      const updated = service.updateOperationStatus('non-existent', 'completed');
      expect(updated).toBeUndefined();
    });

    it('should support all valid statuses', () => {
      const statuses: Array<'pending' | 'running' | 'completed' | 'failed' | 'cancelled'> =
        ['pending', 'running', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const created = service.trackOperation('tenant-1', {
          artifactId: `artifact-${status}`,
          operation: 'build',
        });
        const updated = service.updateOperationStatus(created.id, status);
        expect(updated?.status).toBe(status);
      }
    });
  });

  // ==================== getOperation ====================

  describe('getOperation', () => {
    it('should get a single operation by ID', () => {
      const created = service.trackOperation('tenant-1', validOperation);

      const found = service.getOperation(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent operation', () => {
      expect(service.getOperation('non-existent')).toBeUndefined();
    });
  });

  // ==================== getOperationHistory ====================

  describe('getOperationHistory', () => {
    beforeEach(() => {
      service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'build' });
      service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'publish' });
      service.trackOperation('tenant-1', { artifactId: 'artifact-002', operation: 'scan' });
      service.trackOperation('tenant-1', { artifactId: 'artifact-003', operation: 'deploy' });
      service.trackOperation('tenant-2', { artifactId: 'artifact-004', operation: 'build' });
    });

    it('should return all operations for a tenant', () => {
      const history = service.getOperationHistory('tenant-1');
      expect(history.length).toBe(4);
    });

    it('should filter by artifactId', () => {
      const history = service.getOperationHistory('tenant-1', {
        artifactId: 'artifact-001',
      });

      expect(history.length).toBe(2);
      expect(history.every(op => op.artifactId === 'artifact-001')).toBe(true);
    });

    it('should filter by operation type', () => {
      const history = service.getOperationHistory('tenant-1', {
        operation: 'build',
      });

      expect(history.length).toBe(1);
      expect(history[0].operation).toBe('build');
    });

    it('should filter by status', () => {
      // First, mark some operations as completed
      const allOps = service.getOperationHistory('tenant-1');
      service.updateOperationStatus(allOps[0].id, 'completed');
      service.updateOperationStatus(allOps[1].id, 'completed');

      const completedOps = service.getOperationHistory('tenant-1', {
        status: 'completed',
      });

      expect(completedOps.length).toBe(2);
    });

    it('should filter by initiatedBy', () => {
      const created = service.trackOperation('tenant-1', {
        artifactId: 'artifact-005',
        operation: 'build',
      });
      const op = service.getOperation(created.id)!;
      (op as any).initiatedBy = 'deploy-bot';

      const history = service.getOperationHistory('tenant-1', {
        initiatedBy: 'deploy-bot',
      });

      expect(history.length).toBe(1);
      expect(history[0].initiatedBy).toBe('deploy-bot');
    });

    it('should filter by date range', () => {
      const startDate = new Date(Date.now() - 10000).toISOString();
      const endDate = new Date(Date.now() + 10000).toISOString();

      const history = service.getOperationHistory('tenant-1', {
        startDate,
        endDate,
      });

      // All operations created within this range
      expect(history.length).toBeGreaterThan(0);
    });

    it('should return empty array when no operations match filter', () => {
      const history = service.getOperationHistory('tenant-1', {
        artifactId: 'non-existent-artifact',
      });

      expect(history).toEqual([]);
    });

    it('should return all operations when no filters provided', () => {
      const history = service.getOperationHistory('tenant-1');
      expect(history.length).toBe(4);
    });

    it('should enforce tenant isolation', () => {
      const history = service.getOperationHistory('tenant-2');
      expect(history.length).toBe(1);
      expect(history.every(op => op.tenantId === 'tenant-2')).toBe(true);
    });
  });

  // ==================== getArtifactStats ====================

  describe('getArtifactStats', () => {
    beforeEach(() => {
      // Create a mix of operations
      for (let i = 0; i < 5; i++) {
        const op = service.trackOperation('tenant-1', {
          artifactId: `artifact-${i % 3}`, // 3 unique artifacts
          operation: ['build', 'publish', 'scan', 'deploy', 'promote'][i],
        });

        if (i < 3) {
          // Mark first 3 as completed
          const completedAt = new Date(Date.now() + (i + 1) * 1000).toISOString();
          service.updateOperationStatus(op.id, 'completed', completedAt);
        }
      }
      // Mark 4th as failed
      const ops = service.getOperationHistory('tenant-1');
      service.updateOperationStatus(ops[3].id, 'failed');
      // 5th stays pending
    });

    it('should return total operations count', () => {
      const stats = service.getArtifactStats('tenant-1');

      expect(stats.totalOperations).toBe(5);
    });

    it('should count operations by type', () => {
      const stats = service.getArtifactStats('tenant-1');

      expect(stats.operationsByType.build).toBe(1);
      expect(stats.operationsByType.publish).toBe(1);
      expect(stats.operationsByType.scan).toBe(1);
      expect(stats.operationsByType.deploy).toBe(1);
      expect(stats.operationsByType.promote).toBe(1);
    });

    it('should count operations by status', () => {
      const stats = service.getArtifactStats('tenant-1');

      expect(stats.operationsByStatus.completed).toBe(3);
      expect(stats.operationsByStatus.failed).toBe(1);
      expect(stats.operationsByStatus.pending).toBe(1);
    });

    it('should count unique artifacts', () => {
      const stats = service.getArtifactStats('tenant-1');

      expect(stats.uniqueArtifacts).toBe(3);
    });

    it('should calculate average duration', () => {
      const stats = service.getArtifactStats('tenant-1');

      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    it('should calculate success rate', () => {
      const stats = service.getArtifactStats('tenant-1');

      expect(stats.successRate).toBe(3 / 5); // 3 completed out of 5
    });

    it('should return recent operations sorted by date', () => {
      const stats = service.getArtifactStats('tenant-1');

      const ops = stats.recentOperations;
      expect(ops.length).toBeLessThanOrEqual(20);

      // Verify sorted by createdAt descending
      for (let i = 0; i < ops.length - 1; i++) {
        expect(new Date(ops[i].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(ops[i + 1].createdAt).getTime()
        );
      }
    });

    it('should return zero stats for tenant with no operations', () => {
      const stats = service.getArtifactStats('tenant-empty');

      expect(stats.totalOperations).toBe(0);
      expect(stats.uniqueArtifacts).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.recentOperations).toEqual([]);
    });
  });

  // ==================== deleteTenantOperations ====================

  describe('deleteTenantOperations', () => {
    it('should delete all operations for a tenant', () => {
      service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'build' });
      service.trackOperation('tenant-2', { artifactId: 'a3', operation: 'build' });

      const deleted = service.deleteTenantOperations('tenant-1');
      expect(deleted).toBe(2);

      expect(service.getOperationHistory('tenant-1')).toEqual([]);
      // Other tenant should be unaffected
      expect(service.getOperationHistory('tenant-2').length).toBe(1);
    });

    it('should return 0 for tenant with no operations', () => {
      const deleted = service.deleteTenantOperations('tenant-empty');
      expect(deleted).toBe(0);
    });
  });

  // ==================== destroy ====================

  describe('destroy', () => {
    it('should clear all operations and indices', () => {
      service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      service.trackOperation('tenant-2', { artifactId: 'a2', operation: 'build' });

      service.destroy();

      expect(service.getOperationHistory('tenant-1')).toEqual([]);
      expect(service.getOperationHistory('tenant-2')).toEqual([]);
      expect(service.getOperation('any-id')).toBeUndefined();
    });

    it('should not throw when called on empty service', () => {
      expect(() => service.destroy()).not.toThrow();
    });
  });
});
