/**
 * ArtifactOperationService Tests
 *
 * Covers: operation tracking, status updates, operation history with filters,
 * artifact statistics, tenant cleanup.
 *
 * Uses in-memory mock repositories to test service logic without PostgreSQL.
 */

import {
  ArtifactOperationService,
  ArtifactOperationInput,
  OperationFilters,
} from '../ArtifactOperationService';
import { ArtifactOperationRepository, ArtifactOperationEntity } from '../../../repositories/ArtifactOperationRepository';

// ==================== Mock Repository ====================

class MockArtifactOperationRepository extends ArtifactOperationRepository {
  private store: Map<string, ArtifactOperationEntity> = new Map();

  constructor() {
    super({} as any); // No real DB needed for tests
  }

  async create(data: Omit<ArtifactOperationEntity, 'created_at' | 'updated_at'> & Partial<Pick<ArtifactOperationEntity, 'id'>>): Promise<ArtifactOperationEntity> {
    const entity: ArtifactOperationEntity = {
      ...data,
      created_at: new Date(),
    } as ArtifactOperationEntity;
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<ArtifactOperationEntity | undefined> {
    return this.store.get(id);
  }

  async findAll(options: { where?: Record<string, any>; orderBy?: string; orderDir?: 'ASC' | 'DESC'; limit?: number; offset?: number } = {}): Promise<{ entities: ArtifactOperationEntity[]; total: number }> {
    let entities = Array.from(this.store.values());

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        if (value !== undefined && value !== null) {
          entities = entities.filter(e => (e as any)[key] === value);
        }
      }
    }

    const orderBy = options.orderBy || 'created_at';
    const orderDir = options.orderDir || 'DESC';
    entities.sort((a, b) => {
      const aVal = (a as any)[orderBy];
      const bVal = (b as any)[orderBy];
      if (aVal < bVal) return orderDir === 'ASC' ? -1 : 1;
      if (aVal > bVal) return orderDir === 'ASC' ? 1 : -1;
      return 0;
    });

    const offset = options.offset || 0;
    const limit = options.limit || entities.length;
    const sliced = entities.slice(offset, offset + limit);

    return { entities: sliced, total: entities.length };
  }

  async update(id: string, data: Partial<ArtifactOperationEntity>): Promise<ArtifactOperationEntity> {
    const entity = this.store.get(id);
    if (!entity) throw new Error(`Entity ${id} not found`);
    Object.assign(entity, data);
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  // Custom methods
  async findByTenant(tenantId: string, filters?: Record<string, any>, options?: any): Promise<{ entities: ArtifactOperationEntity[]; total: number }> {
    let entities = Array.from(this.store.values()).filter(e => e.tenant_id === tenantId);
    if (filters?.artifactId) entities = entities.filter(e => e.artifact_id === filters.artifactId);
    if (filters?.operation) entities = entities.filter(e => e.operation === filters.operation);
    if (filters?.status) entities = entities.filter(e => e.status === filters.status);
    if (filters?.initiatedBy) entities = entities.filter(e => e.initiated_by === filters.initiatedBy);
    if (filters?.startDate) entities = entities.filter(e => e.created_at >= new Date(filters.startDate));
    if (filters?.endDate) entities = entities.filter(e => e.created_at <= new Date(filters.endDate));
    return { entities, total: entities.length };
  }

  async getTenantStats(tenantId: string): Promise<any> {
    const entities = Array.from(this.store.values()).filter(e => e.tenant_id === tenantId);
    const operationsByType: Record<string, number> = {};
    const operationsByStatus: Record<string, number> = {};
    const artifactIds = new Set<string>();
    let totalDuration = 0;
    let completedCount = 0;

    for (const e of entities) {
      operationsByType[e.operation] = (operationsByType[e.operation] || 0) + 1;
      operationsByStatus[e.status] = (operationsByStatus[e.status] || 0) + 1;
      artifactIds.add(e.artifact_id);
      if (e.duration_ms !== null && e.duration_ms !== undefined) {
        totalDuration += e.duration_ms;
        completedCount++;
      }
    }

    const successCount = operationsByStatus['completed'] || 0;
    return {
      totalOperations: entities.length,
      operationsByType,
      operationsByStatus,
      uniqueArtifacts: artifactIds.size,
      averageDuration: completedCount > 0 ? totalDuration / completedCount : 0,
      successRate: entities.length > 0 ? successCount / entities.length : 0,
    };
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    let count = 0;
    for (const [id, entity] of this.store.entries()) {
      if (entity.tenant_id === tenantId) {
        this.store.delete(id);
        count++;
      }
    }
    return count;
  }

  async updateStatus(id: string, status: string, completedAt?: Date, durationMs?: number): Promise<ArtifactOperationEntity | undefined> {
    const entity = this.store.get(id);
    if (!entity) return undefined;
    entity.status = status;
    if (completedAt) entity.completed_at = completedAt;
    if (durationMs !== undefined) entity.duration_ms = durationMs;
    return entity;
  }

  clear() {
    this.store.clear();
  }
}

// ==================== Tests ====================

describe('ArtifactOperationService', () => {
  let service: ArtifactOperationService;
  let mockRepo: MockArtifactOperationRepository;

  const validOperation: ArtifactOperationInput = {
    artifactId: 'artifact-001',
    operation: 'build',
    source: 'git-repo',
    target: 'registry',
    metadata: { branch: 'main' },
  };

  beforeEach(() => {
    mockRepo = new MockArtifactOperationRepository();
    service = new ArtifactOperationService(mockRepo);
  });

  afterEach(() => {
    mockRepo.clear();
  });

  // ==================== trackOperation ====================

  describe('trackOperation', () => {
    it('should track a new operation with pending status', async () => {
      const operation = await service.trackOperation('tenant-1', validOperation);

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

    it('should track all operation types', async () => {
      const operations: Array<'build' | 'publish' | 'deploy' | 'scan' | 'promote' | 'delete' | 'rollback'> =
        ['build', 'publish', 'deploy', 'scan', 'promote', 'delete', 'rollback'];

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
        operation: 'build',
      });

      expect(operation.artifactId).toBe('minimal-artifact');
      expect(operation.source).toBeUndefined();
      expect(operation.target).toBeUndefined();
    });

    it('should index operations by tenant', async () => {
      await service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      await service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'build' });
      await service.trackOperation('tenant-2', { artifactId: 'a3', operation: 'build' });

      const tenant1Ops = await service.getOperationHistory('tenant-1');
      expect(tenant1Ops.length).toBe(2);

      const tenant2Ops = await service.getOperationHistory('tenant-2');
      expect(tenant2Ops.length).toBe(1);
    });

    it('should generate unique IDs for each operation', async () => {
      const op1 = await service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      const op2 = await service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'build' });

      expect(op1.id).not.toBe(op2.id);
    });
  });

  // ==================== updateOperationStatus ====================

  describe('updateOperationStatus', () => {
    it('should update operation status', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const updated = await service.updateOperationStatus(created.id, 'running');
      expect(updated?.status).toBe('running');
    });

    it('should set completion time and duration when marking completed', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const completedAt = new Date(Date.now() + 5000).toISOString();
      const updated = await service.updateOperationStatus(created.id, 'completed', completedAt);

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBe(completedAt);
    });

    it('should update to failed status', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const updated = await service.updateOperationStatus(created.id, 'failed');
      expect(updated?.status).toBe('failed');
    });

    it('should update to cancelled status', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const updated = await service.updateOperationStatus(created.id, 'cancelled');
      expect(updated?.status).toBe('cancelled');
    });

    it('should return undefined for non-existent operation', async () => {
      const updated = await service.updateOperationStatus('non-existent', 'completed');
      expect(updated).toBeUndefined();
    });

    it('should support all valid statuses', async () => {
      const statuses: Array<'pending' | 'running' | 'completed' | 'failed' | 'cancelled'> =
        ['pending', 'running', 'completed', 'failed', 'cancelled'];

      for (const status of statuses) {
        const created = await service.trackOperation('tenant-1', {
          artifactId: `artifact-${status}`,
          operation: 'build',
        });
        const updated = await service.updateOperationStatus(created.id, status);
        expect(updated?.status).toBe(status);
      }
    });
  });

  // ==================== getOperation ====================

  describe('getOperation', () => {
    it('should get a single operation by ID', async () => {
      const created = await service.trackOperation('tenant-1', validOperation);

      const found = await service.getOperation(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent operation', async () => {
      expect(await service.getOperation('non-existent')).toBeUndefined();
    });
  });

  // ==================== getOperationHistory ====================

  describe('getOperationHistory', () => {
    beforeEach(async () => {
      await service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'build' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-001', operation: 'publish' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-002', operation: 'scan' });
      await service.trackOperation('tenant-1', { artifactId: 'artifact-003', operation: 'deploy' });
      await service.trackOperation('tenant-2', { artifactId: 'artifact-004', operation: 'build' });
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
        operation: 'build',
      });

      expect(history.length).toBe(1);
      expect(history[0].operation).toBe('build');
    });

    it('should filter by status', async () => {
      const allOps = await service.getOperationHistory('tenant-1');
      await service.updateOperationStatus(allOps[0].id, 'completed');
      await service.updateOperationStatus(allOps[1].id, 'completed');

      const completedOps = await service.getOperationHistory('tenant-1', {
        status: 'completed',
      });

      expect(completedOps.length).toBe(2);
    });

    it('should filter by date range', async () => {
      const startDate = new Date(Date.now() - 10000).toISOString();
      const endDate = new Date(Date.now() + 10000).toISOString();

      const history = await service.getOperationHistory('tenant-1', {
        startDate,
        endDate,
      });

      expect(history.length).toBeGreaterThan(0);
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
      for (let i = 0; i < 5; i++) {
        const op = await service.trackOperation('tenant-1', {
          artifactId: `artifact-${i % 3}`,
          operation: ['build', 'publish', 'scan', 'deploy', 'promote'][i],
        });

        if (i < 3) {
          const completedAt = new Date(Date.now() + (i + 1) * 1000).toISOString();
          await service.updateOperationStatus(op.id, 'completed', completedAt);
        }
      }
      const ops = await service.getOperationHistory('tenant-1');
      await service.updateOperationStatus(ops[3].id, 'failed');
    });

    it('should return total operations count', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.totalOperations).toBe(5);
    });

    it('should count operations by type', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.operationsByType.build).toBe(1);
      expect(stats.operationsByType.publish).toBe(1);
      expect(stats.operationsByType.scan).toBe(1);
      expect(stats.operationsByType.deploy).toBe(1);
      expect(stats.operationsByType.promote).toBe(1);
    });

    it('should count operations by status', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.operationsByStatus.completed).toBe(3);
      expect(stats.operationsByStatus.failed).toBe(1);
      expect(stats.operationsByStatus.pending).toBe(1);
    });

    it('should count unique artifacts', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.uniqueArtifacts).toBe(3);
    });

    it('should calculate success rate', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      expect(stats.successRate).toBe(3 / 5);
    });

    it('should return recent operations sorted by date', async () => {
      const stats = await service.getArtifactStats('tenant-1');
      const ops = stats.recentOperations;
      expect(ops.length).toBeLessThanOrEqual(20);

      for (let i = 0; i < ops.length - 1; i++) {
        expect(new Date(ops[i].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(ops[i + 1].createdAt).getTime()
        );
      }
    });

    it('should return zero stats for tenant with no operations', async () => {
      const stats = await service.getArtifactStats('tenant-empty');
      expect(stats.totalOperations).toBe(0);
      expect(stats.uniqueArtifacts).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.recentOperations).toEqual([]);
    });
  });

  // ==================== deleteTenantOperations ====================

  describe('deleteTenantOperations', () => {
    it('should delete all operations for a tenant', async () => {
      await service.trackOperation('tenant-1', { artifactId: 'a1', operation: 'build' });
      await service.trackOperation('tenant-1', { artifactId: 'a2', operation: 'build' });
      await service.trackOperation('tenant-2', { artifactId: 'a3', operation: 'build' });

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
