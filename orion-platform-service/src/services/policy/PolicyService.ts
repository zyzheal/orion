/**
 * Policy Service - OPA 策略定义和 Bundle 管理
 */

import { EventBusService } from '../event-bus-service';
import {
  PolicyDefinition,
  PolicyDefinitionCreateInput,
  PolicyDefinitionUpdateInput,
  createPolicyDefinition,
  PolicyBundle,
  PolicyBundleCreateInput,
  createPolicyBundle,
  PolicyCategory,
  PolicySeverity,
} from '../../models/PolicyDefinition';

export interface PolicyListFilter {
  category?: PolicyCategory;
  severity?: PolicySeverity;
  enabled?: boolean;
  gateId?: string;
}

export class PolicyService {
  private definitions: Map<string, PolicyDefinition> = new Map();
  private bundles: Map<string, PolicyBundle> = new Map();
  private eventBus?: EventBusService;

  constructor(options?: { eventBus?: EventBusService }) {
    this.eventBus = options?.eventBus;
  }

  // Policy Definition CRUD
  async create(input: PolicyDefinitionCreateInput): Promise<PolicyDefinition> {
    const policy = createPolicyDefinition(input);
    this.definitions.set(policy.id, policy);

    await this.eventBus?.publish('policy.definition.created', {
      policyId: policy.id,
      name: policy.name,
      category: policy.category,
    });
    return policy;
  }

  async getById(id: string): Promise<PolicyDefinition | undefined> {
    return this.definitions.get(id);
  }

  async list(filter: PolicyListFilter = {}): Promise<PolicyDefinition[]> {
    let items = Array.from(this.definitions.values());

    if (filter.category) {
      items = items.filter(p => p.category === filter.category);
    }
    if (filter.severity) {
      items = items.filter(p => p.severity === filter.severity);
    }
    if (filter.enabled !== undefined) {
      items = items.filter(p => p.enabled === filter.enabled);
    }
    if (filter.gateId) {
      items = items.filter(p => p.gateId === filter.gateId);
    }

    return items;
  }

  async update(id: string, input: PolicyDefinitionUpdateInput): Promise<PolicyDefinition | undefined> {
    const policy = this.definitions.get(id);
    if (!policy) return undefined;

    if (input.description !== undefined) policy.description = input.description;
    if (input.category !== undefined) policy.category = input.category;
    if (input.regoPath !== undefined) policy.regoPath = input.regoPath;
    if (input.gateId !== undefined) policy.gateId = input.gateId;
    if (input.severity !== undefined) policy.severity = input.severity;
    if (input.enabled !== undefined) policy.enabled = input.enabled;
    if (input.metadata !== undefined) policy.metadata = input.metadata;
    policy.updatedAt = new Date();

    this.definitions.set(id, policy);
    await this.eventBus?.publish('policy.definition.updated', { policyId: id });
    return policy;
  }

  async toggle(id: string): Promise<PolicyDefinition | undefined> {
    const policy = this.definitions.get(id);
    if (!policy) return undefined;

    policy.enabled = !policy.enabled;
    policy.updatedAt = new Date();
    this.definitions.set(id, policy);

    await this.eventBus?.publish('policy.definition.toggled', {
      policyId: id,
      enabled: policy.enabled,
    });
    return policy;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.definitions.delete(id);
    if (deleted) {
      await this.eventBus?.publish('policy.definition.deleted', { policyId: id });
    }
    return deleted;
  }

  // Bundle management
  async createBundle(input: PolicyBundleCreateInput): Promise<PolicyBundle> {
    const bundle = createPolicyBundle(input);
    this.bundles.set(bundle.id, bundle);

    await this.eventBus?.publish('policy.bundle.deployed', {
      bundleId: bundle.id,
      name: bundle.bundleName,
      gitRef: bundle.gitRef,
    });
    return bundle;
  }

  async getBundleById(id: string): Promise<PolicyBundle | undefined> {
    return this.bundles.get(id);
  }

  async listBundles(): Promise<PolicyBundle[]> {
    return Array.from(this.bundles.values());
  }

  /**
   * Mock sync from Git repository
   */
  async syncBundle(gitRef: string, bundleName: string): Promise<PolicyBundle> {
    // In production, this would clone/fetch the policy repo
    const mockRegoContent: Record<string, string> = {
      'security/base.rego': `package security.base

default allow = false

allow {
  input.user.role == "admin"
}
`,
      'cost/limits.rego': `package cost.limits

deny[msg] {
  input.environment == "production"
  input.budget > 10000
  msg := "Budget exceeds production limit"
}
`,
    };

    const bundle = await this.createBundle({
      bundleName,
      gitRef,
      regoContent: mockRegoContent,
      testResults: { passed: 12, failed: 0, skipped: 2 },
    });
    return bundle;
  }
}
