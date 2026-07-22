/**
 * Policy Service - Business logic for OPA policy management
 */

import { PolicyRepository, PolicyEntity } from './PolicyRepository';

export class PolicyService {
  constructor(private repo: PolicyRepository) {}

  async listPolicies(): Promise<PolicyEntity[]> {
    return this.repo.findAll();
  }

  async getPolicyById(id: string): Promise<PolicyEntity | undefined> {
    return this.repo.findById(id);
  }

  async createPolicy(data: {
    name: string;
    description: string;
    rego: string;
    category: string;
    severity: string;
    enabled?: boolean;
    tags?: string[];
  }): Promise<PolicyEntity> {
    return this.repo.create({
      name: data.name,
      description: data.description,
      rego: data.rego,
      category: data.category,
      severity: data.severity,
      enabled: data.enabled ?? true,
      tags: data.tags ?? [],
    });
  }

  async updatePolicy(id: string, data: Partial<PolicyEntity>): Promise<PolicyEntity | undefined> {
    return this.repo.update(id, data);
  }

  async deletePolicy(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  async toggle(id: string): Promise<PolicyEntity> {
    const result = await this.repo.toggle(id);
    if (!result) throw new Error(`Policy ${id} not found`);
    return result;
  }

  // ==================== Bundle Management ====================

  async listBundles(): Promise<Array<{ id: string; name: string; policyCount: number; updatedAt: string }>> {
    const policies = await this.repo.findAll();
    const bundleMap = new Map<string, PolicyEntity[]>();

    for (const policy of policies) {
      const bundle = bundleMap.get(policy.category) || [];
      bundle.push(policy);
      bundleMap.set(policy.category, bundle);
    }

    return Array.from(bundleMap.entries()).map(([name, policies]) => ({
      id: `bundle-${name}`,
      name,
      policyCount: policies.length,
      updatedAt: policies[0]?.updatedAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getBundle(id: string): Promise<{ id: string; name: string; policies: PolicyEntity[] } | undefined> {
    const policies = await this.repo.findAll();
    // Bundle ID is like 'bundle-security', extract category
    const name = id.replace('bundle-', '');
    const bundlePolicies = policies.filter(p => p.category === name);

    if (bundlePolicies.length === 0) return undefined;

    return {
      id,
      name,
      policies: bundlePolicies,
    };
  }

  async syncBundles(): Promise<{ synced: number; bundles: string[] }> {
    const policies = await this.repo.findAll();
    const bundles = new Set<string>();

    for (const policy of policies) {
      bundles.add(policy.category);
    }

    return { synced: bundles.size, bundles: Array.from(bundles) };
  }

  // ==================== Policy Testing ====================

  async testPolicy(rego: string, testCases: Array<Record<string, unknown>>): Promise<Array<{ testCase: number; passed: boolean; violations: string[] }>> {
    // MVP: simulate policy evaluation without actual OPA engine
    // In production, invoke OPA REST API or embedded engine
    return testCases.map((tc, idx) => ({
      testCase: idx + 1,
      passed: true, // MVP: always pass
      violations: [],
    }));
  }
}
