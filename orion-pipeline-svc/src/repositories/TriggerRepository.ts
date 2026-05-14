// Trigger Repository - In-memory implementation
export interface TriggerEntity {
  id: string;
  tenantId: string;
  pipelineId: string;
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  config: Record<string, unknown>;
  enabled: boolean;
  status?: string;
  lastTriggeredAt?: string;
  nextTriggerAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerCreateInput {
  tenantId: string;
  pipelineId: string;
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  config: Record<string, unknown>;
  enabled?: boolean;
}

const store = new Map<string, TriggerEntity>();

export class TriggerRepository {
  constructor(_pool?: any) {}

  async create(input: TriggerCreateInput): Promise<TriggerEntity> {
    const now = new Date().toISOString();
    const entity: TriggerEntity = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      pipelineId: input.pipelineId,
      type: input.type,
      config: input.config,
      enabled: input.enabled ?? true,
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    };
    store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<TriggerEntity | undefined> {
    return store.get(id);
  }

  async findByPipelineId(pipelineId: string): Promise<TriggerEntity[]> {
    return Array.from(store.values()).filter(t => t.pipelineId === pipelineId);
  }

  async findByTenant(tenantId: string): Promise<TriggerEntity[]> {
    return Array.from(store.values()).filter(t => t.tenantId === tenantId);
  }

  async findByType(tenantId: string, type: string): Promise<TriggerEntity[]> {
    return Array.from(store.values()).filter(t => t.tenantId === tenantId && t.type === type);
  }

  async update(id: string, input: Partial<TriggerEntity>): Promise<TriggerEntity | null> {
    const existing = store.get(id);
    if (!existing) return null;
    const updated: TriggerEntity = { ...existing, ...input, updatedAt: new Date().toISOString() };
    store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  }

  async enable(id: string): Promise<TriggerEntity | null> {
    return this.update(id, { enabled: true });
  }

  async disable(id: string): Promise<TriggerEntity | null> {
    return this.update(id, { enabled: false });
  }

  async findActiveTriggers(tenantId: string): Promise<TriggerEntity[]> {
    return Array.from(store.values()).filter(t => t.tenantId === tenantId && t.enabled);
  }

  async updateTriggerConfig(id: string, config: Record<string, unknown>): Promise<TriggerEntity | null> {
    return this.update(id, { config });
  }

  async updateStatus(id: string, status: string | boolean): Promise<TriggerEntity | null> {
    const statusStr = typeof status === 'string' ? status : (status ? 'active' : 'idle');
    return this.update(id, { status: statusStr });
  }

  async saveExecutionRecord(triggerId: string, _result: Record<string, unknown>): Promise<void> {
    const trigger = store.get(triggerId);
    if (trigger) {
      trigger.lastTriggeredAt = new Date().toISOString();
      trigger.updatedAt = new Date().toISOString();
      store.set(triggerId, trigger);
    }
  }

  async initialize?(): Promise<void> {
    // Placeholder for DB initialization
  }
}

export const TriggerRepositoryImpl = new TriggerRepository();
export type TriggerRepositoryType = typeof TriggerRepository;