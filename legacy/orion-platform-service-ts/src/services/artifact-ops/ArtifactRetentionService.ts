import { v4 as uuidv4 } from 'uuid';
import { RetentionPolicyRepository, RetentionEvaluationRepository, RetentionPolicyEntity, RetentionEvaluationEntity } from '../../repositories/ArtifactRetentionRepository';
import { DatabasePool } from '../database';

import { OrionError, ErrorCode } from '../../errors';

export interface RetentionPolicyInput {
  name: string;
  maxAgeDays: number;
  maxVersions?: number;
  maxSizeMB?: number;
  protectedTags?: string[];
  schedule?: string; // cron expression
}

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  name: string;
  maxAgeDays: number;
  maxVersions?: number;
  maxSizeMB?: number;
  protectedTags?: string[];
  schedule?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactEntry {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  sizeMB: number;
  tags: string[];
  createdAt: string;
  lastAccessedAt?: string;
}

export interface RetentionEvaluation {
  policyId: string;
  tenantId: string;
  evaluatedAt: string;
  totalArtifacts: number;
  expiredCount: number;
  protectedCount: number;
  expiredArtifacts: ExpiredArtifactInfo[];
  spaceReclaimableMB: number;
}

export interface ExpiredArtifactInfo {
  artifactId: string;
  name: string;
  version: string;
  reason: string;
  sizeMB: number;
}

export interface RetentionReport {
  tenantId: string;
  policies: RetentionPolicy[];
  evaluations: RetentionEvaluation[];
  summary: {
    totalPolicies: number;
    activePolicies: number;
    totalArtifactsTracked: number;
    totalExpired: number;
    totalSpaceReclaimableMB: number;
  };
}

/**
 * ArtifactRetentionService — manages retention policies and cleanup for artifacts per tenant.
 * Uses PostgreSQL Repository pattern for persistence.
 *
 * Note: Artifact entries are evaluated at runtime (passed as input) rather than persisted,
 * since they come from the artifact registry service. Evaluations are persisted.
 */
export class ArtifactRetentionService {
  private policyRepository: RetentionPolicyRepository;
  private evaluationRepository: RetentionEvaluationRepository;

  constructor(dbOrRepositories: DatabasePool | { policyRepository: RetentionPolicyRepository; evaluationRepository: RetentionEvaluationRepository }) {
    if ('query' in dbOrRepositories) {
      // DatabasePool provided - create repositories
      const db = dbOrRepositories;
      this.policyRepository = new RetentionPolicyRepository(db);
      this.evaluationRepository = new RetentionEvaluationRepository(db);
    } else {
      // Repositories provided directly
      const { policyRepository, evaluationRepository } = dbOrRepositories;
      this.policyRepository = policyRepository;
      this.evaluationRepository = evaluationRepository;
    }
  }

  /**
   * Define a new retention policy for a tenant.
   */
  async defineRetentionPolicy(
    tenantId: string,
    input: RetentionPolicyInput,
  ): Promise<RetentionPolicy> {
    const id = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();

    const entity = await this.policyRepository.create({
      id,
      tenant_id: tenantId,
      name: input.name,
      max_age_days: input.maxAgeDays,
      max_versions: input.maxVersions || null,
      max_size_mb: input.maxSizeMB || null,
      protected_tags: input.protectedTags || [],
      schedule: input.schedule || null,
      enabled: true,
    });

    return this.policyEntityToDomain(entity);
  }

  /**
   * Get a policy by ID.
   */
  async getPolicy(policyId: string): Promise<RetentionPolicy | undefined> {
    const entity = await this.policyRepository.findById(policyId);
    if (!entity) return undefined;
    return this.policyEntityToDomain(entity);
  }

  /**
   * List policies for a tenant.
   */
  async listPolicies(tenantId: string, enabledOnly?: boolean): Promise<RetentionPolicy[]> {
    const entities = enabledOnly
      ? await this.policyRepository.findByTenantAndEnabled(tenantId)
      : await this.policyRepository.findByTenant(tenantId);
    return entities.map(e => this.policyEntityToDomain(e));
  }

  /**
   * Update a policy.
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<RetentionPolicyInput & { enabled: boolean }>,
  ): Promise<RetentionPolicy | undefined> {
    const entity = await this.policyRepository.findById(policyId);
    if (!entity) return undefined;

    const updateData: Partial<RetentionPolicyEntity> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.maxAgeDays !== undefined) updateData.max_age_days = updates.maxAgeDays;
    if (updates.maxVersions !== undefined) updateData.max_versions = updates.maxVersions;
    if (updates.maxSizeMB !== undefined) updateData.max_size_mb = updates.maxSizeMB;
    if (updates.protectedTags !== undefined) updateData.protected_tags = updates.protectedTags;
    if (updates.schedule !== undefined) updateData.schedule = updates.schedule;
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;

    const updated = await this.policyRepository.update(policyId, updateData);
    if (!updated) throw new OrionError('Failed to update retention policy', ErrorCode.OPERATION_FAILED);
    return this.policyEntityToDomain(updated);
  }

  /**
   * Delete a policy.
   */
  async deletePolicy(policyId: string): Promise<boolean> {
    return this.policyRepository.delete(policyId);
  }

  /**
   * Evaluate retention policies for a tenant.
   * Returns evaluation results for each policy.
   *
   * Note: Artifacts are passed as input since they come from the artifact registry service.
   */
  async evaluateRetention(
    tenantId: string,
    tenantArtifacts: ArtifactEntry[],
  ): Promise<RetentionEvaluation[]> {
    const policies = await this.listPolicies(tenantId, true);
    const now = new Date();
    const evaluations: RetentionEvaluation[] = [];

    for (const policy of policies) {
      const expired: ExpiredArtifactInfo[] = [];
      let protectedCount = 0;

      for (const artifact of tenantArtifacts) {
        // Check protected tags
        if (
          policy.protectedTags &&
          policy.protectedTags.some((tag) => artifact.tags.includes(tag))
        ) {
          protectedCount++;
          continue;
        }

        // Check age
        const ageDays =
          (now.getTime() - new Date(artifact.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);

        if (ageDays > policy.maxAgeDays) {
          expired.push({
            artifactId: artifact.id,
            name: artifact.name,
            version: artifact.version,
            reason: `Age ${Math.floor(ageDays)} days exceeds max ${policy.maxAgeDays} days`,
            sizeMB: artifact.sizeMB,
          });
          continue;
        }

        // Check size limit
        if (policy.maxSizeMB !== undefined && artifact.sizeMB > policy.maxSizeMB) {
          expired.push({
            artifactId: artifact.id,
            name: artifact.name,
            version: artifact.version,
            reason: `Size ${artifact.sizeMB}MB exceeds max ${policy.maxSizeMB}MB`,
            sizeMB: artifact.sizeMB,
          });
        }
      }

      const spaceReclaimable = expired.reduce((sum, a) => sum + a.sizeMB, 0);

      const evaluation: RetentionEvaluation = {
        policyId: policy.id,
        tenantId,
        evaluatedAt: now.toISOString(),
        totalArtifacts: tenantArtifacts.length,
        expiredCount: expired.length,
        protectedCount,
        expiredArtifacts: expired,
        spaceReclaimableMB: spaceReclaimable,
      };

      // Persist evaluation
      await this.evaluationRepository.create({
        id: uuidv4(),
        policy_id: policy.id,
        tenant_id: tenantId,
        evaluated_at: now,
        total_artifacts: evaluation.totalArtifacts,
        expired_count: evaluation.expiredCount,
        protected_count: evaluation.protectedCount,
        expired_artifacts: expired as unknown as Record<string, unknown>[],
        space_reclaimable_mb: evaluation.spaceReclaimableMB,
      });

      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /**
   * Get retention evaluations for a tenant.
   */
  async getEvaluations(tenantId: string): Promise<RetentionEvaluation[]> {
    const entities = await this.evaluationRepository.findByTenant(tenantId);
    return entities.map(e => this.evaluationEntityToDomain(e));
  }

  /**
   * Generate a retention report for a tenant.
   */
  async getRetentionReport(
    tenantId: string,
    tenantArtifacts: ArtifactEntry[],
  ): Promise<RetentionReport> {
    const policies = await this.listPolicies(tenantId);
    const evaluations = await this.evaluateRetention(tenantId, tenantArtifacts);

    const activePolicies = policies.filter((p) => p.enabled).length;
    const totalArtifacts = tenantArtifacts.length;
    const totalExpired = evaluations.reduce(
      (sum, e) => sum + e.expiredCount,
      0,
    );
    const totalSpaceReclaimable = evaluations.reduce(
      (sum, e) => sum + e.spaceReclaimableMB,
      0,
    );

    return {
      tenantId,
      policies,
      evaluations,
      summary: {
        totalPolicies: policies.length,
        activePolicies,
        totalArtifactsTracked: totalArtifacts,
        totalExpired,
        totalSpaceReclaimableMB: totalSpaceReclaimable,
      },
    };
  }

  private policyEntityToDomain(entity: RetentionPolicyEntity): RetentionPolicy {
    return {
      id: entity.id,
      tenantId: entity.tenant_id,
      name: entity.name,
      maxAgeDays: entity.max_age_days,
      maxVersions: entity.max_versions || undefined,
      maxSizeMB: entity.max_size_mb || undefined,
      protectedTags: entity.protected_tags,
      schedule: entity.schedule || undefined,
      enabled: entity.enabled,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  private evaluationEntityToDomain(entity: RetentionEvaluationEntity): RetentionEvaluation {
    return {
      policyId: entity.policy_id,
      tenantId: entity.tenant_id,
      evaluatedAt: entity.evaluated_at.toISOString(),
      totalArtifacts: entity.total_artifacts,
      expiredCount: entity.expired_count,
      protectedCount: entity.protected_count,
      expiredArtifacts: entity.expired_artifacts as unknown as ExpiredArtifactInfo[],
      spaceReclaimableMB: entity.space_reclaimable_mb,
    };
  }
}
