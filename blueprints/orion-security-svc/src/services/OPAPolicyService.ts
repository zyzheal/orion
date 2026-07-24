/**
 * OPA Policy Engine Service
 *
 * Provides Open Policy Agent (OPA) integration for policy-as-code governance.
 * Supports policy creation, evaluation, bundling, and enforcement modes.
 */

export interface PolicyRule {
  id: string;
  effect: 'allow' | 'deny';
  condition: string;
  message: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  module: string;
  rules: PolicyRule[];
  enabled: boolean;
  enforcement: 'strict' | 'permissive' | 'audit';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyEvaluationRequest {
  input: Record<string, unknown>;
  policies?: string[];
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  decisions: { policy: string; effect: string; message: string }[];
  evaluatedPolicies: string[];
  evaluationTime: number;
}

export interface PolicyBundle {
  id: string;
  name: string;
  version: string;
  policies: Policy[];
  createdAt: Date;
}

/**
 * OPAPolicyService - Policy engine with OPA-like evaluation
 */
export class OPAPolicyService {
  private policies: Map<string, Policy> = new Map();
  private bundles: Map<string, PolicyBundle> = new Map();

  /**
   * Create a new policy
   */
  async createPolicy(
    name: string,
    description: string,
    rules: Omit<PolicyRule, 'id'>[],
    enforcement: Policy['enforcement']
  ): Promise<Policy> {
    const policy: Policy = {
      id: `policy-${crypto.randomUUID()}`,
      name,
      description,
      module: `package orion.${name.replace(/\s+/g, '_')}`,
      rules: rules.map(r => ({ ...r, id: `rule-${crypto.randomUUID()}` })),
      enabled: true,
      enforcement,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.policies.set(policy.id, policy);
    return policy;
  }

  /**
   * Evaluate input against policies
   */
  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();
    const decisions: PolicyEvaluationResult['decisions'] = [];
    const evaluatedPolicies: string[] = [];

    const policiesToEvaluate = request.policies
      ? Array.from(this.policies.values()).filter(p => request.policies!.includes(p.id))
      : Array.from(this.policies.values()).filter(p => p.enabled);

    for (const policy of policiesToEvaluate) {
      evaluatedPolicies.push(policy.id);

      let allowed = true;
      let message = 'Allowed by default';

      for (const rule of policy.rules) {
        const result = this.evaluateRule(rule, request.input);
        if (!result && rule.effect === 'deny') {
          allowed = false;
          message = rule.message;
          break;
        } else if (!result && policy.enforcement === 'strict') {
          allowed = false;
          message = `Strict enforcement: ${rule.message}`;
          break;
        }
      }

      decisions.push({
        policy: policy.name,
        effect: allowed ? 'allow' : 'deny',
        message,
      });

      if (!allowed && policy.enforcement === 'strict') break;
    }

    return {
      allowed: decisions.every(d => d.effect === 'allow'),
      decisions,
      evaluatedPolicies,
      evaluationTime: Date.now() - startTime,
    };
  }

  /**
   * Evaluate a single rule against input
   * Simple evaluation - in production would use actual OPA
   */
  private evaluateRule(rule: PolicyRule, input: Record<string, unknown>): boolean {
    // Simple evaluation logic for MVP
    // In production, this would invoke actual OPA engine with Rego

    if (rule.condition === 'always') return true;
    if (rule.condition === 'never') return false;

    // Check for role-based conditions
    if (rule.condition.startsWith('role:')) {
      const requiredRole = rule.condition.replace('role:', '');
      const userRoles = input.roles as string[] | undefined;
      return userRoles?.includes(requiredRole) ?? false;
    }

    // Check for permission-based conditions
    if (rule.condition.startsWith('permission:')) {
      const requiredPermission = rule.condition.replace('permission:', '');
      const userPermissions = input.permissions as string[] | undefined;
      return userPermissions?.includes(requiredPermission) ?? false;
    }

    // Check for tenant matching
    if (rule.condition.startsWith('tenant:')) {
      const requiredTenant = rule.condition.replace('tenant:', '');
      const inputTenant = input.tenantId as string | undefined;
      return inputTenant === requiredTenant;
    }

    // Default: pass
    return true;
  }

  /**
   * Get a policy by ID
   */
  async getPolicy(policyId: string): Promise<Policy | null> {
    return this.policies.get(policyId) || null;
  }

  /**
   * List all policies
   */
  async listPolicies(enabledOnly?: boolean): Promise<Policy[]> {
    const policies = Array.from(this.policies.values());
    return enabledOnly ? policies.filter(p => p.enabled) : policies;
  }

  /**
   * Update a policy
   */
  async updatePolicy(policyId: string, updates: Partial<Policy>): Promise<Policy | null> {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    const updated = { ...policy, ...updates, updatedAt: new Date(), version: policy.version + 1 };
    this.policies.set(policyId, updated);
    return updated;
  }

  /**
   * Delete a policy
   */
  async deletePolicy(policyId: string): Promise<boolean> {
    return this.policies.delete(policyId);
  }

  /**
   * Create a policy bundle
   */
  async createBundle(name: string, policyIds: string[]): Promise<PolicyBundle> {
    const policies = policyIds
      .map(id => this.policies.get(id))
      .filter(Boolean) as Policy[];

    const bundle: PolicyBundle = {
      id: `bundle-${crypto.randomUUID()}`,
      name,
      version: '1.0.0',
      policies,
      createdAt: new Date(),
    };
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  /**
   * Get a bundle by ID
   */
  async getBundle(bundleId: string): Promise<PolicyBundle | null> {
    return this.bundles.get(bundleId) || null;
  }

  /**
   * List all bundles
   */
  async listBundles(): Promise<PolicyBundle[]> {
    return Array.from(this.bundles.values());
  }

  /**
   * Evaluate input against a bundle
   */
  async evaluateBundle(bundleId: string, input: Record<string, unknown>): Promise<PolicyEvaluationResult> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) throw new Error('Bundle not found');

    return this.evaluate({ input, policies: bundle.policies.map(p => p.id) });
  }

  /**
   * Delete a bundle
   */
  async deleteBundle(bundleId: string): Promise<boolean> {
    return this.bundles.delete(bundleId);
  }

  /**
   * Enable or disable a policy
   */
  async togglePolicy(policyId: string): Promise<Policy | null> {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    policy.enabled = !policy.enabled;
    policy.updatedAt = new Date();
    this.policies.set(policyId, policy);
    return policy;
  }
}