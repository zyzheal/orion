/**
 * ArtifactOperationService Tests
 *
 * Covers: operation tracking, status updates, operation history with filters,
 * artifact statistics, tenant cleanup.
 *
 * Uses in-memory mode (db=null) to test service logic without PostgreSQL.
 * Uses jest.resetModules() to get a fresh module-level Map between tests.
 */

// We need to reset modules between tests to get a fresh inMemoryOperations Map
let ArtifactOperationService: typeof import('../ArtifactOperationService').ArtifactOperationService;
let service: import('../ArtifactOperationService').ArtifactOperationService;

function createService() {
  jest.resetModules();
  const mod = require('../ArtifactOperationService');
  ArtifactOperationService = mod.ArtifactOperationService;
  return new ArtifactOperationService(null);
}

// ==================== Tests ====================

describe('ArtifactOperationService', () => {
  beforeEach(() => {
    service = createService();
  });

  const validOperation = {
    artifactId: 'artifact-001',
    operation: 'upload' as const,
    source: 'git-repo',
    target: 'registry',
    metadata: { branch: 'main' },
  };

  // ==================== trackOperation ====================

  describe('trackOperation', () => {
    it('should track a new operation with completed status', async () => {
      const operation = await service.trackOperation('tenant-1', validOperation);

      expect(operation.id).toBeDefined();
      expect(operation.tenantId).toBe('tenant-1');
      expect(operation.artifactId).toBe('artifact-001');
      expect(operation.operation).toBe('upload');
      expect(operation.status).toBe('completed');
      expect(operation.source).toBe('git-repo');
      expect(operation.target).toBe('registry');
      expect(operation.metadata).toEqual({ branch: 'main' });
      expect(operation.createdAt).toBeDefined();
      expect(operation.completedAt).toBeDefined();
    });

    it('should track all operation types', async () => {
      const operations = [
        'upload', 'download', 'delete', 'scan', 'promote',
        'quarantine', 'copy', 'move', 'tag', 'untag',
      ] as const;

      for (const op of operations) {
        const operation = await service.trackOperation('tenant-1', {
          artifactId: `artifact-${op}`,
          operation: op,
        });
        expect(operation.operation).toBe(op);
      }
    });

    it('should work with minimal input', async () => {
      const operation = await service.trackOperation('tenant-1', {
        artifactId: 'minimal-artifact',
        operation: 'download',
      });

      expect(operation.artifactId).toBe('minimal-artifact');
      expect(operation.source).toBeUndefined();
      expect(operation.target).toBeUndefined();
    });

    it('should index operations by tenant', async () => {
      await service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'upload' });
      await service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'upload' });
      await service.trackOperation('tenant-2', { artifactId: 'a3', operation: 'upload' });

      const tenant1Ops = await service.getOperationHistory('tenant-1');
      expect(tenant1Ops.length).toBe(2);

      const tenant2Ops = await service.getOperationHistory('tenant-2');
      expect(tenant2Ops.length).toBe(1);
    });

    it('should generate unique IDs for each operation', async () => {
      const op1 = await service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'upload' });
      const op2 = await service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'upload' });

      expect(op1.id).not.toBe(op2.id);
    });
  });

  // ==================== updateOperationStatus ====================

  describe('updateOperationStatus', () => {
    it('should update operation status', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const updated = await service.updateOperationStatus(created.id, 'tenant-1', 'running');
      expect(updated?.status).toBe('running');
    });

    it('should set completion time and duration when marking completed', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const completedAt = new Date(Date.now() + 5000);
      const updated = await service.updateOperationStatus(created.id, 'tenant-1', 'completed', completedAt, 5000);

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBe(completedAt);
      expect(updated?.durationMs).toBe(5000);
    });

    it('should update to failed status', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const updated = await service.updateOperationStatus(created.id, 'tenant-1', 'failed');
      expect(updated?.status).toBe('failed');
    });

    it('should return null for non-existent operation', async () => {
      const updated = await service.updateOperationStatus('non-existent', 'tenant-1', 'completed');
      expect(updated).toBeNull();
    });

    it('should support all valid statuses', async () => {
      const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const created = await service.trackOperation('tenant-1', {
          artifactId: `artifact-${status}`,
          operation: 'scan',
        });
        const updated = await service.updateOperationStatus(created.id, 'tenant-1', status);
        expect(updated?.status).toBe(status);
      }
    });
  });

  // ==================== getOperationHistory ====================

  describe('getOperationHistory', () => {
    beforeEach(async () => {
      await service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'upload' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'download' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-002', operation: 'scan' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-003', operation: 'delete' });
      await service.trackOperation('tenant-2', { artifactId: 'artifact-004', operation: 'upload' });
    });

    it('should return all operations for a tenant', async () => {
      const history = await service.getOperationHistory('tenant-1');
      expect(history.length).toBe(4);
    });

    it('should filter by artifactId', async () => {
      const history = await service.getOperationHistory('tenant-1', {
        artifactId: 'artifact-001',
      });

      expect(history.length).toBe(2);
      expect(history.every(op => op.artifactId === 'artifact-001')).toBe(true);
    });

    it('should filter by operation type', async () => {
      const history = await service.getOperationHistory('tenant-1', {
        operation: 'upload',
      });

      expect(history.length).toBe(1);
      expect(history[0].operation).toBe('upload');
    });

    it('should filter by status', async () => {
      const allOps = await service.getOperationHistory('tenant-1');
      await service.updateOperationStatus(allOps[0].id, 'tenant-1', 'failed');
      await service.updateOperationStatus(allOps[1].id, 'tenant-1', 'failed');

      const failedOps = await service.getOperationHistory('tenant-1', {
        status: 'failed',
      });

      expect(failedOps.length).toBe(2);
    });

    it('should return empty array when no operations match filter', async () => {
      const history = await service.getOperationHistory('tenant-1', {
        artifactId: 'non-existent-artifact',
      });

      expect(history).toEqual([]);
    });

    it('should return all operations when no filters provided', async () => {
      const history = await service.getOperationHistory('tenant-1');
      expect(history.length).toBe(4);
    });

    it('should enforce tenant isolation', async () => {
      const history = await service.getOperationHistory('tenant-2');
      expect(history.length).toBe(1);
      expect(history.every(op => op.tenantId === 'tenant-2')).toBe(true);
    });
  });

  // ==================== getArtifactStats ====================

  describe('getArtifactStats', () => {
    beforeEach(async () => {
      await service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'upload' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'download' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-002', operation: 'scan' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-003', operation: 'delete' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-003', operation: 'promote' });
    });

    it('should return total operations count', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.totalOperations).toBe(5);
    });

    it('should count operations by type', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.operationsByType.upload).toBe(1);
      expect(stats.operationsByType.download).toBe(1);
      expect(stats.operationsByType.scan).toBe(1);
      expect(stats.operationsByType.delete).toBe(1);
      expect(stats.operationsByType.promote).toBe(1);
    });

    it('should count operations by status', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      // All operations are completed by default
      expect(stats.operationsByStatus.completed).toBe(5);
    });

    it('should count unique artifacts', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.uniqueArtifacts).toBe(3);
    });

    it('should calculate success rate', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.successRate).toBe(1); // all completed
    });

    it('should return zero stats for tenant with no operations', async () => {
      const stats = await service.getArtifactStats('tenant-empty');
      expect(stats.totalOperations).toBe(0);
      expect(stats.uniqueArtifacts).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  // ==================== deleteTenantOperations ====================

  describe('deleteTenantOperations', () => {
    it('should delete all operations for a tenant', async () => {
      await service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'upload' });
      await service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'upload' });
      await service.trackOperation('tenant-2', { artifactId: 'a3', operation: 'upload' });

      const deleted = await service.deleteTenantOperations('tenant-1');
      expect(deleted).toBe(2);

      expect(await service.getOperationHistory('tenant-1')).toEqual([]);
      expect((await service.getOperationHistory('tenant-2')).length).toBe(1);
    });

    it('should return 0 for tenant with no operations', async () => {
      const deleted = await service.deleteTenantOperations('tenant-empty');
      expect(deleted).toBe(0);
    });
  });
});
