// RBAC Rule Repository - In-memory implementation
export interface RBACRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  subjects: string[];
  conditions?: Record<string, unknown>;
  priority: number;
  createdAt: string;
  updatedAt: string;
  // Additional fields for pipeline RBAC
  userId?: string;
  role?: string;
}

export interface RBACRuleCreateInput {
  tenantId: string;
  name: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  subjects: string[];
  conditions?: Record<string, unknown>;
  priority?: number;
}

const store = new Map<string, RBACRuleEntity>();

export class RBACRuleRepository {
  async create(input: RBACRuleCreateInput): Promise<RBACRuleEntity> {
    const now = new Date().toISOString();
    const entity: RBACRuleEntity = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      resource: input.resource,
      action: input.action,
      effect: input.effect,
      subjects: input.subjects,
      conditions: input.conditions,
      priority: input.priority ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<RBACRuleEntity | undefined> {
    return store.get(id);
  }

  async findByTenant(tenantId: string): Promise<RBACRuleEntity[]> {
    return Array.from(store.values()).filter(r => r.tenantId === tenantId);
  }

  async findByResource(tenantId: string, resource: string): Promise<RBACRuleEntity[]> {
    return Array.from(store.values()).filter(r => r.tenantId === tenantId && r.resource === resource);
  }

  async findBySubject(tenantId: string, subject: string): Promise<RBACRuleEntity[]> {
    return Array.from(store.values()).filter(r => r.tenantId === tenantId && r.subjects.includes(subject));
  }

  async update(id: string, input: Partial<RBACRuleEntity>): Promise<RBACRuleEntity | null> {
    const existing = store.get(id);
    if (!existing) return null;
    const updated: RBACRuleEntity = { ...existing, ...input, updatedAt: new Date().toISOString() };
    store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  }

  async findMatchingRules(tenantId: string, resource: string, action: string, subject: string): Promise<RBACRuleEntity[]> {
    const rules = await this.findByTenant(tenantId);
    return rules
      .filter(r => r.resource === resource && r.subjects.includes(subject))
      .filter(r => !r.action || r.action === action || r.action === '*')
      .sort((a, b) => b.priority - a.priority);
  }

  async deleteByPipelineId(pipelineId: string): Promise<number> {
    const toDelete = Array.from(store.values()).filter(r => r.resource === `pipeline:${pipelineId}`);
    toDelete.forEach(r => store.delete(r.id));
    return toDelete.length;
  }

  async upsert(input: RBACRuleCreateInput): Promise<RBACRuleEntity> {
    const existing = Array.from(store.values()).find(
      r => r.tenantId === input.tenantId && r.name === input.name
    );
    if (existing) {
      return (await this.update(existing.id, input))!;
    }
    return this.create(input);
  }

  async deleteByPipelineAndUser(pipelineId: string, userId: string): Promise<number> {
    const toDelete = Array.from(store.values()).filter(
      r => r.resource === `pipeline:${pipelineId}` && r.subjects.includes(userId)
    );
    toDelete.forEach(r => store.delete(r.id));
    return toDelete.length;
  }

  async findByPipelineId(pipelineId: string): Promise<RBACRuleEntity[]> {
    return Array.from(store.values()).filter(r => r.resource === `pipeline:${pipelineId}`);
  }

  async upsertByPipelineAndUser(pipelineId: string, userId: string, role: string): Promise<RBACRuleEntity> {
    const existing = Array.from(store.values()).find(
      r => r.resource === `pipeline:${pipelineId}` && r.subjects.includes(userId)
    );
    if (existing) {
      return (await this.update(existing.id, { action: role }))!;
    }
    return this.create({
      tenantId: '',
      name: `pipeline-${pipelineId}-${userId}`,
      resource: `pipeline:${pipelineId}`,
      action: role,
      effect: 'allow',
      subjects: [userId],
      priority: 0,
    });
  }
}

export const RBACRuleRepositoryImpl = new RBACRuleRepository();
export type RBACRuleRepositoryType = typeof RBACRuleRepository;