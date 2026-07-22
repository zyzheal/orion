/**
 * ArtifactRetentionService Tests
 *
 * Covers: retention policy CRUD, evaluation, report generation.
 * Uses in-memory mock repositories.
 */

import { ArtifactRetentionService, RetentionPolicyInput, ArtifactEntry } from '../ArtifactRetentionService';
import { RetentionPolicyRepository, RetentionEvaluationRepository, RetentionPolicyEntity, RetentionEvaluationEntity } from '../../../repositories/ArtifactRetentionRepository';

// ==================== Mock Repositories ====================

class MockRetentionPolicyRepository extends RetentionPolicyRepository {
  private store: Map<string, RetentionPolicyEntity> = new Map();

  constructor() { super({} as any); }

  async create(data: any): Promise<RetentionPolicyEntity> {
    const now = new Date();
    const entity: RetentionPolicyEntity = { ...data, created_at: now, updated_at: now } as RetentionPolicyEntity;
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<RetentionPolicyEntity | undefined> {
    return this.store.get(id);
  }

  async update(id: string, data: Partial<RetentionPolicyEntity>): Promise<RetentionPolicyEntity> {
    const entity = this.store.get(id);
    if (!entity) throw new Error(`Policy ${id} not found`);
    Object.assign(entity, data, { updated_at: new Date() });
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async findByTenant(tenantId: string): Promise<RetentionPolicyEntity[]> {
    return Array.from(this.store.values()).filter(e => e.tenant_id === tenantId);
  }

  async findByTenantAndEnabled(tenantId: string): Promise<RetentionPolicyEntity[]> {
    return Array.from(this.store.values()).filter(e => e.tenant_id === tenantId && e.enabled);
  }

  clear() { this.store.clear(); }
}

class MockRetentionEvaluationRepository extends RetentionEvaluationRepository {
  private store: Map<string, RetentionEvaluationEntity> = new Map();

  constructor() { super({} as any); }

  async create(data: any): Promise<RetentionEvaluationEntity> {
    const entity: RetentionEvaluationEntity = { ...data, evaluated_at: new Date() } as RetentionEvaluationEntity;
    this.store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<RetentionEvaluationEntity | undefined> {
    return this.store.get(id);
  }

  async findByTenant(tenantId: string): Promise<RetentionEvaluationEntity[]> {
    return Array.from(this.store.values()).filter(e => e.tenant_id === tenantId);
  }

  async findByPolicy(policyId: string): Promise<RetentionEvaluationEntity[]> {
    return Array.from(this.store.values()).filter(e => e.policy_id === policyId);
  }

  async deleteByTenant(tenantId: string): Promise<number> {
    let count = 0;
    for (const [id, e] of this.store.entries()) {
      if (e.tenant_id === tenantId) { this.store.delete(id); count++; }
    }
    return count;
  }

  clear() { this.store.clear(); }
}

// ==================== Tests ====================

describe('ArtifactRetentionService', () => {
  let service: ArtifactRetentionService;
  let policyRepo: MockRetentionPolicyRepository;
  let evalRepo: MockRetentionEvaluationRepository;

  const validPolicy: RetentionPolicyInput = {
    name: '90-day retention',
    maxAgeDays: 90,
    maxVersions: 5,
    maxSizeMB: 500,
    protectedTags: ['release', 'production'],
  };

  const sampleArtifacts: ArtifactEntry[] = [
    { id: 'art-1', tenantId: 't1', name: 'app', version: '1.0', sizeMB: 100, tags: ['latest'], createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'art-2', tenantId: 't1', name: 'app', version: '0.9', sizeMB: 80, tags: ['release'], createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'art-3', tenantId: 't1', name: 'lib', version: '2.0', sizeMB: 600, tags: ['latest'], createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  beforeEach(() => {
    policyRepo = new MockRetentionPolicyRepository();
    evalRepo = new MockRetentionEvaluationRepository();
    service = new ArtifactRetentionService({ policyRepository: policyRepo, evaluationRepository: evalRepo });
  });

  afterEach(() => {
    policyRepo.clear();
    evalRepo.clear();
  });

  describe('defineRetentionPolicy', () => {
    it('should create a new retention policy', async () => {
      const policy = await service.defineRetentionPolicy('t1', validPolicy);
      expect(policy.id).toBeDefined();
      expect(policy.tenantId).toBe('t1');
      expect(policy.name).toBe('90-day retention');
      expect(policy.maxAgeDays).toBe(90);
      expect(policy.enabled).toBe(true);
    });

    it('should use defaults for optional fields', async () => {
      const policy = await service.defineRetentionPolicy('t1', {
        name: 'simple',
        maxAgeDays: 30,
      });
      expect(policy.name).toBe('simple');
      expect(policy.maxAgeDays).toBe(30);
      expect(policy.maxVersions).toBeUndefined();
      expect(policy.protectedTags).toEqual([]);
    });
  });

  describe('getPolicy', () => {
    it('should get a policy by ID', async () => {
      const created = await service.defineRetentionPolicy('t1', validPolicy);
      const found = await service.getPolicy(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent policy', async () => {
      expect(await service.getPolicy('non-existent')).toBeUndefined();
    });
  });

  describe('listPolicies', () => {
    it('should list all policies for a tenant', async () => {
      await service.defineRetentionPolicy('t1', { name: 'p1', maxAgeDays: 30 });
      await service.defineRetentionPolicy('t1', { name: 'p2', maxAgeDays: 60 });
      await service.defineRetentionPolicy('t2', { name: 'p3', maxAgeDays: 90 });

      const policies = await service.listPolicies('t1');
      expect(policies.length).toBe(2);
    });

    it('should filter enabled policies only', async () => {
      await service.defineRetentionPolicy('t1', { name: 'p1', maxAgeDays: 30 });
      const p2 = await service.defineRetentionPolicy('t1', { name: 'p2', maxAgeDays: 60 });
      await service.updatePolicy(p2.id, { enabled: false });

      const allPolicies = await service.listPolicies('t1');
      expect(allPolicies.length).toBe(2);

      const enabledPolicies = await service.listPolicies('t1', true);
      expect(enabledPolicies.length).toBe(1);
    });
  });

  describe('updatePolicy', () => {
    it('should update policy fields', async () => {
      const created = await service.defineRetentionPolicy('t1', validPolicy);
      const updated = await service.updatePolicy(created.id, { maxAgeDays: 180 });
      expect(updated?.maxAgeDays).toBe(180);
    });

    it('should disable a policy', async () => {
      const created = await service.defineRetentionPolicy('t1', validPolicy);
      const updated = await service.updatePolicy(created.id, { enabled: false });
      expect(updated?.enabled).toBe(false);
    });

    it('should return undefined for non-existent policy', async () => {
      expect(await service.updatePolicy('non-existent', { maxAgeDays: 180 })).toBeUndefined();
    });
  });

  describe('deletePolicy', () => {
    it('should delete a policy', async () => {
      const created = await service.defineRetentionPolicy('t1', validPolicy);
      const deleted = await service.deletePolicy(created.id);
      expect(deleted).toBe(true);
      expect(await service.getPolicy(created.id)).toBeUndefined();
    });

    it('should return false for non-existent policy', async () => {
      expect(await service.deletePolicy('non-existent')).toBe(false);
    });
  });

  describe('evaluateRetention', () => {
    it('should evaluate retention for a tenant', async () => {
      await service.defineRetentionPolicy('t1', { name: '90-day', maxAgeDays: 90 });
      const evaluations = await service.evaluateRetention('t1', sampleArtifacts);
      expect(evaluations.length).toBe(1);
      expect(evaluations[0].totalArtifacts).toBe(3);
      expect(evaluations[0].expiredCount).toBeGreaterThan(0);
    });

    it('should protect artifacts with protected tags', async () => {
      await service.defineRetentionPolicy('t1', {
        name: 'protected',
        maxAgeDays: 90,
        protectedTags: ['release'],
      });
      const evaluations = await service.evaluateRetention('t1', sampleArtifacts);
      expect(evaluations[0].protectedCount).toBe(1); // art-2 has 'release' tag
    });

    it('should flag artifacts exceeding size limit', async () => {
      await service.defineRetentionPolicy('t1', {
        name: 'size limit',
        maxAgeDays: 365,
        maxSizeMB: 500,
      });
      const evaluations = await service.evaluateRetention('t1', sampleArtifacts);
      expect(evaluations[0].expiredCount).toBe(1); // art-3 is 600MB
    });

    it('should persist evaluations', async () => {
      await service.defineRetentionPolicy('t1', { name: 'test', maxAgeDays: 90 });
      await service.evaluateRetention('t1', sampleArtifacts);
      const persisted = await evalRepo.findByTenant('t1');
      expect(persisted.length).toBe(1);
    });
  });

  describe('getRetentionReport', () => {
    it('should generate a retention report', async () => {
      await service.defineRetentionPolicy('t1', { name: '90-day', maxAgeDays: 90 });
      const report = await service.getRetentionReport('t1', sampleArtifacts);
      expect(report.tenantId).toBe('t1');
      expect(report.policies.length).toBe(1);
      expect(report.evaluations.length).toBe(1);
      expect(report.summary.totalArtifactsTracked).toBe(3);
      expect(report.summary.totalSpaceReclaimableMB).toBeGreaterThan(0);
    });
  });

  describe('getEvaluations', () => {
    it('should return evaluations for a tenant', async () => {
      await service.defineRetentionPolicy('t1', { name: 'test', maxAgeDays: 90 });
      await service.evaluateRetention('t1', sampleArtifacts);
      const evaluations = await service.getEvaluations('t1');
      expect(evaluations.length).toBe(1);
    });
  });
});
