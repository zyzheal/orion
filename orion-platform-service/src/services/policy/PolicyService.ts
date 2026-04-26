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
}