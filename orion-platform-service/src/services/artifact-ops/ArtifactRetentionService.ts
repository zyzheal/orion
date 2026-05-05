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
 * Uses in-memory Map storage with tenant isolation.
 */
export class ArtifactRetentionService {
  private policies = new Map<string, RetentionPolicy>();
  private policyIndex = new Map<string, string[]>(); // tenantId -> policyIds
  private artifacts = new Map<string, ArtifactEntry[]>(); // tenantId -> artifacts
  private evaluations = new Map<string, RetentionEvaluation>();

  /**
   * Define a new retention policy for a tenant.
   */
  defineRetentionPolicy(
    tenantId: string,
    input: RetentionPolicyInput,
  ): RetentionPolicy {
    const id = `rp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const policy: RetentionPolicy = {
      id,
      tenantId,
      name: input.name,
      maxAgeDays: input.maxAgeDays,
      maxVersions: input.maxVersions,
      maxSizeMB: input.maxSizeMB,
      protectedTags: input.protectedTags,
      schedule: input.schedule,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    this.policies.set(id, policy);

    if (!this.policyIndex.has(tenantId)) {
      this.policyIndex.set(tenantId, []);
    }
    this.policyIndex.get(tenantId)!.push(id);

    return policy;
  }

  /**
   * Get a policy by ID.
   */
  getPolicy(policyId: string): RetentionPolicy | undefined {
    return this.policies.get(policyId);
  }

  /**
   * List policies for a tenant.
   */
  listPolicies(tenantId: string): RetentionPolicy[] {
    const ids = this.policyIndex.get(tenantId) || [];
    return ids
      .map((id) => this.policies.get(id))
      .filter((p): p is RetentionPolicy => p !== undefined);
  }

  /**
   * Update a policy.
   */
  updatePolicy(
    policyId: string,
    updates: Partial<RetentionPolicyInput & { enabled: boolean }>,
  ): RetentionPolicy | undefined {
    const policy = this.policies.get(policyId);
    if (!policy) return undefined;

    Object.assign(policy, updates, { updatedAt: new Date().toISOString() });
    return policy;
  }

  /**
   * Delete a policy.
   */
  deletePolicy(policyId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    const ids = this.policyIndex.get(policy.tenantId);
    if (ids) {
      const idx = ids.indexOf(policyId);
      if (idx !== -1) ids.splice(idx, 1);
    }

    return this.policies.delete(policyId);
  }

  /**
   * Register artifacts for a tenant (for evaluation purposes).
   */
  registerArtifacts(tenantId: string, artifacts: ArtifactEntry[]): void {
    this.artifacts.set(tenantId, artifacts);
  }

  /**
   * Evaluate retention policies for a tenant.
   * Returns evaluation results for each policy.
   */
  evaluateRetention(tenantId: string): RetentionEvaluation[] {
    const policies = this.listPolicies(tenantId);
    const tenantArtifacts = this.artifacts.get(tenantId) || [];
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

      this.evaluations.set(`${tenantId}_${policy.id}`, evaluation);
      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /**
   * Simulate cleanup of expired artifacts for a tenant.
   * Returns the list of cleaned-up artifact IDs.
   */
  cleanupExpiredArtifacts(tenantId: string): {
    cleaned: string[];
    spaceFreedMB: number;
  } {
    const evaluations = this.evaluateRetention(tenantId);
    const cleaned: string[] = [];
    let spaceFreedMB = 0;

    // Collect all expired artifact IDs across policies
    const expiredIds = new Set<string>();
    for (const eval_ of evaluations) {
      for (const expired of eval_.expiredArtifacts) {
        expiredIds.add(expired.artifactId);
      }
    }

    // Remove from artifact list
    const tenantArtifacts = this.artifacts.get(tenantId) || [];
    const remaining = tenantArtifacts.filter((a) => {
      if (expiredIds.has(a.id)) {
        cleaned.push(a.id);
        spaceFreedMB += a.sizeMB;
        return false;
      }
      return true;
    });

    this.artifacts.set(tenantId, remaining);

    return { cleaned, spaceFreedMB };
  }

  /**
   * Generate a retention report for a tenant.
   */
  getRetentionReport(tenantId: string): RetentionReport {
    const policies = this.listPolicies(tenantId);
    const evaluations = this.evaluateRetention(tenantId);

    const activePolicies = policies.filter((p) => p.enabled).length;
    const totalArtifacts = this.artifacts.get(tenantId)?.length || 0;
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

  /**
   * Clear all data.
   */
  destroy(): void {
    this.policies.clear();
    this.policyIndex.clear();
    this.artifacts.clear();
    this.evaluations.clear();
  }
}
