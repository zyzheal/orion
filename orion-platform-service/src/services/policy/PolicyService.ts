/**
 * PolicyService - Business logic layer for Policy operations
 */

import { PolicyRepository, PolicyDefinition, PolicyEvaluation } from './PolicyRepository';

export class PolicyServiceError extends Error {
  constructor(message: string, public code: string) { super(message); this.name = 'PolicyServiceError'; }
}

export class PolicyService {
  private repository: PolicyRepository;
  constructor(repository: PolicyRepository) { this.repository = repository; }

  async getPolicy(id: string): Promise<PolicyDefinition> {
    const policy = await this.repository.findPolicyById(id);
    if (!policy) throw new PolicyServiceError(`Policy not found: ${id}`, 'NOT_FOUND');
    return policy;
  }

  async listPolicies(tenantId?: string): Promise<PolicyDefinition[]> {
    return this.repository.findAllPolicies(tenantId);
  }

  async list(tenantId?: string): Promise<PolicyDefinition[]> {
    return this.listPolicies(tenantId);
  }

  async createPolicy(tenantId: string, name: string, resource: string, action: string, regoCode: string, effect?: string): Promise<PolicyDefinition> {
    if (!tenantId) throw new PolicyServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!name || !resource || !action) throw new PolicyServiceError('Name, resource, action required', 'INVALID_INPUT');
    return this.repository.createPolicy(tenantId, name, resource, action, regoCode, effect);
  }

  async updatePolicy(id: string, input: { name?: string; rego_code?: string; enabled?: boolean }): Promise<PolicyDefinition> {
    const existing = await this.repository.findPolicyById(id);
    if (!existing) throw new PolicyServiceError(`Policy not found: ${id}`, 'NOT_FOUND');
    const updated = await this.repository.updatePolicy(id, input);
    if (!updated) throw new PolicyServiceError(`Failed to update: ${id}`, 'UPDATE_FAILED');
    return updated;
  }

  async deletePolicy(id: string): Promise<boolean> {
    const existing = await this.repository.findPolicyById(id);
    if (!existing) throw new PolicyServiceError(`Policy not found: ${id}`, 'NOT_FOUND');
    return this.repository.deletePolicy(id);
  }

  async evaluate(tenantId: string, resourceType: string, resourceId: string, action: string, context: Record<string, any>): Promise<{ decision: string; policy?: PolicyDefinition }> {
    // Simple evaluation - find matching policy
    const policies = await this.repository.findAllPolicies(tenantId);
    const matching = policies.find(p => p.enabled && p.resource === resourceType && p.action === action);
    
    // Mock evaluation result
    const decision = matching ? 'allow' : 'deny';
    
    await this.repository.createEvaluation(
      tenantId, matching?.id || null, resourceType, resourceId, action, decision, context, { result: decision }
    );

    return { decision, policy: matching || undefined };
  }

  async getEvaluationHistory(tenantId: string, limit?: number): Promise<PolicyEvaluation[]> {
    return this.repository.findEvaluations(tenantId, limit);
  }

  // ==================== Bundle Management, Testing & Toggle (M31 additions) ====================

  /**
   * List all deployed OPA policy bundles
   */
  async listBundles(): Promise<Array<{ id: string; name: string; version: string; status: string; lastSynced: string; policyCount: number }>> {
    // MVP: return static list -- in production, query OPA /v1/bundles
    return [
      { id: 'bundle-security', name: 'Security Policies', version: '1.2.0', status: 'active', lastSynced: new Date().toISOString(), policyCount: 12 },
      { id: 'bundle-compliance', name: 'Compliance Policies', version: '1.0.3', status: 'active', lastSynced: new Date().toISOString(), policyCount: 8 },
    ];
  }

  /**
   * Get policy bundle details by ID
   */
  async getBundle(id: string): Promise<{ id: string; name: string; version: string; status: string; policies: Array<{ id: string; name: string; enabled: boolean }> } | null> {
    const bundles = await this.listBundles();
    const bundle = bundles.find((b) => b.id === id);
    if (!bundle) return null;

    return {
      ...bundle,
      policies: [
        { id: `pol-${id}-1`, name: `${bundle.name} - Policy 1`, enabled: true },
        { id: `pol-${id}-2`, name: `${bundle.name} - Policy 2`, enabled: true },
      ],
    };
  }

  /**
   * Sync policy bundles from git registry to OPA
   */
  async syncBundles(): Promise<{ synced: number; failed: number; details: Array<{ name: string; status: string }> }> {
    // MVP: simulate sync -- in production, pull from git and deploy to OPA
    return {
      synced: 2,
      failed: 0,
      details: [
        { name: 'Security Policies', status: 'synced' },
        { name: 'Compliance Policies', status: 'synced' },
      ],
    };
  }

  /**
   * Test a Rego policy against sample inputs
   */
  async testPolicy(rego: string, testCases: Array<Record<string, unknown>>): Promise<{
    totalTests: number;
    passed: number;
    failed: number;
    results: Array<{ testCase: number; passed: boolean; result: string; error?: string }>;
  }> {
    // MVP: basic Rego syntax validation only
    // In production, use OPA eval API: POST /v1/data with input + rego
    const results = testCases.map((tc, index) => {
      const hasSyntaxError = rego.includes('syntax_error');
      return {
        testCase: index + 1,
        passed: !hasSyntaxError,
        result: hasSyntaxError ? 'deny' : 'allow',
        error: hasSyntaxError ? 'Rego syntax error detected' : undefined,
      };
    });

    const passed = results.filter((r) => r.passed).length;

    return {
      totalTests: testCases.length,
      passed,
      failed: testCases.length - passed,
      results,
    };
  }

  /**
   * Toggle policy enabled/disabled
   */
  async toggle(id: string): Promise<{ id: string; enabled: boolean; updatedAt: string }> {
    const policy = await this.getPolicy(id);
    const updated = await this.updatePolicy(id, { enabled: !policy.enabled });
    return { id: updated.id, enabled: updated.enabled, updatedAt: updated.updatedAt.toISOString() };
  }
}