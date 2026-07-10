/**
 * FederationAdvancedService 单元测试
 *
 * 测试调度策略管理、跨集群作业调度、资源池管理等功能
 * 包含读写一致性验证测试
 */

import { FederationAdvancedService } from '../FederationAdvancedService';
import { FederationAdvancedRepository } from '../../../repositories/FederationAdvancedRepository';
import { OptimisticLockError } from '../../../repositories/FederationAdvancedRepository';

// Helper to create a mock DB that records all queries and returns controlled results
function createMockDb() {
  const store: Record<string, any[]> = {
    federation_scheduling_policies: [],
    federation_cross_cluster_jobs: [],
    federation_resource_pools: [],
  };
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    // Simulate async DB latency so fire-and-forget races can be detected
    await new Promise(resolve => setTimeout(resolve, 10));

    // INSERT ... ON CONFLICT ... RETURNING * handler
    const returningMatch = sql.match(/ON CONFLICT.+?RETURNING \*/s);
    const insertMatch = sql.match(/INSERT INTO (\w+)/i);
    const conflictMatch = sql.match(/ON CONFLICT \(([^)]+)\)/i);

    if (insertMatch && conflictMatch) {
      const tableName = insertMatch[1];
      const conflictCol = conflictMatch[1];
      // Extract the first param as the ID
      const idParam = _params?.[0] as string;
      const existingIndex = store[tableName].findIndex((r: any) => r[conflictCol] === idParam);

      if (existingIndex >= 0) {
        // UPDATE path: optimistic locking check
        const row = store[tableName][existingIndex];
        // expectedVersion is the last param in the UPSERT (WHERE version = $N)
        const expectedVersion = Number(_params[_params.length - 1]);
        if (row.version !== expectedVersion) {
          return { rows: [], rowCount: 0 };
        }
        if (tableName === 'federation_scheduling_policies') {
          row.name = _params[1];
          row.description = _params[2];
          row.strategy = _params[3];
          row.rules = typeof _params[4] === 'string' ? JSON.parse(_params[4]) : _params[4];
          row.status = _params[5];
          row.version = Number(_params[6]) || row.version + 1;
          row.updated_at = new Date().toISOString();
        } else if (tableName === 'federation_cross_cluster_jobs') {
          // UPSERT param order: $1=id,$2=tenantId,$3=name,$4=spec,$5=targetClusters,$6=status,$7=scheduledAt,$8=completedAt,$9=newVersion,$10=expectedVersion
          row.target_clusters = _params[4];
          row.status = _params[5];
          row.scheduled_at = _params[6] instanceof Date ? _params[6].toISOString() : _params[6];
          row.completed_at = _params[7] instanceof Date ? _params[7].toISOString() : _params[7];
          row.version = Number(_params[8]) || row.version + 1;
        } else if (tableName === 'federation_resource_pools') {
          row.name = _params[1];
          row.description = _params[2];
          row.cluster_id = _params[3];
          row.used_cpu = _params[7];
          row.used_memory = _params[8];
          row.status = _params[9];
          row.version = Number(_params[10]) || row.version + 1;
        }
        store[tableName][existingIndex] = row;
        return { rows: [row], rowCount: 1 };
      } else {
        // INSERT path
        const newRow: any = { id: idParam };
        if (tableName === 'federation_scheduling_policies') {
          newRow.tenant_id = _params[1];
          newRow.name = _params[2];
          newRow.description = _params[3];
          newRow.strategy = _params[4];
          newRow.rules = typeof _params[5] === 'string' ? JSON.parse(_params[5]) : _params[5];
          newRow.status = _params[6];
          newRow.version = 1;
          newRow.created_at = new Date().toISOString();
          newRow.updated_at = new Date().toISOString();
        } else if (tableName === 'federation_cross_cluster_jobs') {
          newRow.tenant_id = _params[1];
          newRow.name = _params[2];
          newRow.spec = typeof _params[3] === 'string' ? JSON.parse(_params[3]) : _params[3];
          newRow.target_clusters = _params[4];
          newRow.status = _params[5];
          newRow.scheduled_at = _params[6];
          newRow.completed_at = _params[7];
          newRow.version = 1;
          newRow.created_at = new Date().toISOString();
        } else if (tableName === 'federation_resource_pools') {
          newRow.tenant_id = _params[1];
          newRow.name = _params[2];
          newRow.description = _params[3];
          newRow.cluster_id = _params[4];
          newRow.cpu = _params[5];
          newRow.memory = _params[6];
          newRow.used_cpu = _params[7];
          newRow.used_memory = _params[8];
          newRow.status = _params[9];
          newRow.version = 1;
          newRow.created_at = new Date().toISOString();
        }
        store[tableName].push(newRow);
        return { rows: [newRow], rowCount: 1 };
      }
    }

    // SELECT handlers (id-based must come before tenant_id-based to avoid wrong match)
    if (sql.includes('SELECT * FROM federation_scheduling_policies WHERE id')) {
      const id = _params?.[0];
      const row = store.federation_scheduling_policies.find((r: any) => r.id === id);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes('SELECT * FROM federation_scheduling_policies WHERE tenant_id')) {
      const tenantId = _params?.[0];
      const rows = store.federation_scheduling_policies.filter((r: any) => r.tenant_id === tenantId);
      return { rows, rowCount: rows.length };
    }
    if (sql.includes('SELECT * FROM federation_cross_cluster_jobs WHERE id')) {
      const id = _params?.[0];
      const row = store.federation_cross_cluster_jobs.find((r: any) => r.id === id);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes('SELECT * FROM federation_cross_cluster_jobs WHERE tenant_id')) {
      const tenantId = _params?.[0];
      const rows = store.federation_cross_cluster_jobs.filter((r: any) => r.tenant_id === tenantId);
      return { rows, rowCount: rows.length };
    }
    if (sql.includes('SELECT * FROM federation_resource_pools WHERE id')) {
      const poolId = _params?.[0];
      const row = store.federation_resource_pools.find((r: any) => r.id === poolId);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes('SELECT * FROM federation_resource_pools WHERE tenant_id')) {
      const tenantId = _params?.[0];
      const rows = store.federation_resource_pools.filter((r: any) => r.tenant_id === tenantId);
      return { rows, rowCount: rows.length };
    }
    // Startup loads (no filter)
    if (sql.includes('SELECT * FROM federation_scheduling_policies ORDER BY created_at ASC')) {
      return { rows: [...store.federation_scheduling_policies], rowCount: store.federation_scheduling_policies.length };
    }
    if (sql.includes('SELECT * FROM federation_cross_cluster_jobs ORDER BY scheduled_at ASC')) {
      return { rows: [...store.federation_cross_cluster_jobs], rowCount: store.federation_cross_cluster_jobs.length };
    }
    if (sql.includes('SELECT * FROM federation_resource_pools ORDER BY created_at ASC')) {
      return { rows: [...store.federation_resource_pools], rowCount: store.federation_resource_pools.length };
    }

    return { rows: [], rowCount: 0 };
  });

  return { query, store };
}

describe('FederationAdvancedService', () => {
  // ==================== Scheduling Policy Management ====================

  describe('createSchedulingPolicy', () => {
    it('应该成功创建调度策略', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const result = await service.createSchedulingPolicy('tenant-1', {
        name: 'cost-optimized-policy',
        description: 'Optimize for cost',
        strategy: 'cost-optimized',
        rules: { maxCostPerMonth: 5000 },
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('cost-optimized-policy');
      expect(result.description).toBe('Optimize for cost');
      expect(result.strategy).toBe('cost-optimized');
      expect(result.rules).toEqual({ maxCostPerMonth: 5000 });
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('应该使用默认值创建策略', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const result = await service.createSchedulingPolicy('tenant-1', {
        name: 'minimal-policy',
      });

      expect(result.strategy).toBe('balanced');
      expect(result.description).toBe('');
      expect(result.rules).toEqual({});
      expect(result.status).toBe('active');
    });

    it('应该支持不同的策略类型', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const strategies = ['cost-optimized', 'latency-optimized', 'balanced', 'custom'] as const;

      for (const strategy of strategies) {
        const result = await service.createSchedulingPolicy('tenant-1', {
          name: `${strategy}-policy`,
          strategy,
        });
        expect(result.strategy).toBe(strategy);
      }
    });

    it('写后应立即能通过 listSchedulingPolicies 读取到新策略（读写一致性）', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      await service.createSchedulingPolicy('tenant-1', {
        name: 'consistency-test-policy',
        strategy: 'balanced',
      });

      // Immediately list — should see the newly created policy (write-through)
      const policies = await service.listSchedulingPolicies('tenant-1');
      expect(policies.find(p => p.name === 'consistency-test-policy')).toBeDefined();
      expect(policies.length).toBe(1);
    });
  });

  describe('listSchedulingPolicies', () => {
    it('没有策略时应返回空数组', async () => {
      const service = new FederationAdvancedService();
      const result = await service.listSchedulingPolicies('tenant-1');
      expect(result).toEqual([]);
    });

    it('应该只返回指定租户的策略', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      await service.createSchedulingPolicy('tenant-1', { name: 'policy-1' });
      await service.createSchedulingPolicy('tenant-1', { name: 'policy-2' });
      await service.createSchedulingPolicy('tenant-2', { name: 'policy-3' });

      const t1Policies = await service.listSchedulingPolicies('tenant-1');
      const t2Policies = await service.listSchedulingPolicies('tenant-2');

      expect(t1Policies.length).toBe(2);
      expect(t2Policies.length).toBe(1);
      expect(t2Policies[0].name).toBe('policy-3');
    });
  });

  // ==================== Cross-Cluster Job Scheduling ================

  describe('scheduleCrossClusterJob', () => {
    it('应该成功调度跨集群作业', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const result = await service.scheduleCrossClusterJob('tenant-1', {
        name: 'deploy-app',
        targetClusters: ['cluster-east', 'cluster-west'],
        resourceRequirements: { cpu: 4, memory: 8192 },
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('deploy-app');
      expect(result.targetClusters).toEqual(['cluster-east', 'cluster-west']);
      expect(result.status).toBe('pending');
      expect(result.scheduledAt).toBeDefined();
      expect(result.completedAt).toBeNull();
      expect(result.spec).toBeDefined();
    });

    it('应该支持单集群调度', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const result = await service.scheduleCrossClusterJob('tenant-1', {
        name: 'single-cluster-job',
        targetClusters: ['cluster-east'],
      });

      expect(result.targetClusters).toEqual(['cluster-east']);
      expect(result.status).toBe('pending');
    });
  });

  // ==================== Resource Pool Management =========================

  describe('createResourcePool', () => {
    it('应该成功创建资源池', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const result = await service.createResourcePool('tenant-1', {
        name: 'compute-pool',
        description: 'General compute pool',
        clusterId: 'cluster-east',
        cpu: 64,
        memory: 131072,
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('compute-pool');
      expect(result.description).toBe('General compute pool');
      expect(result.clusterId).toBe('cluster-east');
      expect(result.cpu).toBe(64);
      expect(result.memory).toBe(131072);
      expect(result.usedCpu).toBe(0);
      expect(result.usedMemory).toBe(0);
      expect(result.status).toBe('active');
      expect(result.createdAt).toBeDefined();
    });

    it('应该使用默认描述', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const result = await service.createResourcePool('tenant-1', {
        name: 'pool-no-desc',
        clusterId: 'cluster-1',
        cpu: 16,
        memory: 32768,
      });

      expect(result.description).toBe('');
    });
  });

  describe('getResourcePoolStatus', () => {
    it('资源池不存在时应返回 null', async () => {
      const service = new FederationAdvancedService();
      const result = await service.getResourcePoolStatus('nonexistent');
      expect(result).toBeNull();
    });

    it('应该返回资源池状态', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const pool = await service.createResourcePool('tenant-1', {
        name: 'compute-pool',
        clusterId: 'cluster-east',
        cpu: 32,
        memory: 65536,
      });

      const result = await service.getResourcePoolStatus(pool.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(pool.id);
      expect(result!.name).toBe('compute-pool');
      expect(result!.cpu).toBe(32);
      expect(result!.memory).toBe(65536);
      expect(result!.usedCpu).toBe(0);
      expect(result!.usedMemory).toBe(0);
      expect(result!.status).toBe('active');
    });
  });

  // ==================== Optimistic Locking ==============================

  describe('updateJobStatus (optimistic locking)', () => {
    it('应该成功更新作业状态', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const job = await service.scheduleCrossClusterJob('tenant-1', {
        name: 'test-job',
        targetClusters: ['cluster-east'],
      });

      // Get version from DB row
      const mockResult = await query('SELECT * FROM federation_cross_cluster_jobs WHERE id = $1', [job.id]);
      const version = mockResult.rows[0].version;

      const updated = await service.updateJobStatus(job.id, 'running', null, version);
      expect(updated?.status).toBe('running');
    });

    it('乐观锁冲突时应抛出 OptimisticLockError', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const job = await service.scheduleCrossClusterJob('tenant-1', {
        name: 'lock-test-job',
        targetClusters: ['cluster-east'],
      });

      // Get version from DB row
      const mockResult = await query('SELECT * FROM federation_cross_cluster_jobs WHERE id = $1', [job.id]);
      const version = mockResult.rows[0].version;

      // First update succeeds
      await service.updateJobStatus(job.id, 'running', null, version);

      // Second update with same version should fail (version already incremented)
      await expect(
        service.updateJobStatus(job.id, 'completed', new Date().toISOString(), version),
      ).rejects.toThrow(OptimisticLockError);
    });
  });

  describe('updatePoolUsage (optimistic locking)', () => {
    it('应该成功更新资源池使用率', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const pool = await service.createResourcePool('tenant-1', {
        name: 'usage-pool',
        clusterId: 'cluster-east',
        cpu: 64,
        memory: 131072,
      });

      // Get version from DB row
      const mockResult = await query('SELECT * FROM federation_resource_pools WHERE id = $1', [pool.id]);
      const version = mockResult.rows[0].version;

      const updated = await service.updatePoolUsage(pool.id, 32, 65536, 'degraded', version);
      expect(updated?.usedCpu).toBe(32);
      expect(updated?.usedMemory).toBe(65536);
      expect(updated?.status).toBe('degraded');
    });

    it('乐观锁冲突时应抛出 OptimisticLockError', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      const pool = await service.createResourcePool('tenant-1', {
        name: 'lock-test-pool',
        clusterId: 'cluster-east',
        cpu: 64,
        memory: 131072,
      });

      // Get version from DB row
      const mockResult = await query('SELECT * FROM federation_resource_pools WHERE id = $1', [pool.id]);
      const version = mockResult.rows[0].version;

      // First update succeeds
      await service.updatePoolUsage(pool.id, 10, 10000, undefined, version);

      // Second update with same version should fail
      await expect(
        service.updatePoolUsage(pool.id, 20, 20000, undefined, version),
      ).rejects.toThrow(OptimisticLockError);
    });
  });

  // ==================== Consistency Verification =========================

  describe('verifyConsistency', () => {
    it('没有 DB 时应返回一致', async () => {
      const service = new FederationAdvancedService();
      const result = await service.verifyConsistency();
      expect(result.isConsistent).toBe(true);
      expect(result.divergences).toEqual([]);
    });

    it('写后应立即通过一致性检查', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      await service.createSchedulingPolicy('tenant-1', {
        name: 'consistent-policy',
        strategy: 'balanced',
      });

      const result = await service.verifyConsistency();
      expect(result.isConsistent).toBe(true);
      expect(result.divergences).toEqual([]);
    });

    it('创建策略和资源池后整体应一致', async () => {
      const { query } = createMockDb();
      const service = new FederationAdvancedService({ query });

      await service.createSchedulingPolicy('tenant-1', { name: 'policy-a' });
      await service.createResourcePool('tenant-1', {
        name: 'pool-a',
        clusterId: 'cluster-1',
        cpu: 32,
        memory: 65536,
      });

      const result = await service.verifyConsistency();
      expect(result.isConsistent).toBe(true);
    });
  });

  describe('repairConsistency', () => {
    it('应该同步内存状态与 DB 状态', async () => {
      const { query, store } = createMockDb();
      const service = new FederationAdvancedService({ query });

      // Create a policy
      await service.createSchedulingPolicy('tenant-1', { name: 'repair-policy' });

      // Manually corrupt the in-memory state (simulate divergence)
      service['schedulingPolicies'].set('corrupt-id', {
        id: 'corrupt-id',
        tenantId: 'tenant-1',
        name: 'ghost-policy',
        description: '',
        strategy: 'balanced',
        rules: {},
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Verify divergence exists
      let result = await service.verifyConsistency();
      expect(result.isConsistent).toBe(false);
      expect(result.divergences.length).toBeGreaterThanOrEqual(1);

      // Repair
      await service.repairConsistency();

      // Verify consistent after repair
      result = await service.verifyConsistency();
      expect(result.isConsistent).toBe(true);
    });
  });
});
