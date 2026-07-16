// QualityGate Repository - In-memory implementation
import type { QualityGate, QualityGateRule, QualityGateCreateInput } from '../models/QualityGate';

// In-memory store matching the QualityGate model (with rules)
const store = new Map<string, QualityGate>();

export class QualityGateRepository {
  async create(input: QualityGateCreateInput): Promise<QualityGate> {
    const entity: QualityGate = {
      id: crypto.randomUUID(),
      name: input.name,
      rules: input.rules,
      enabled: input.enabled ?? true,
      tenantId: input.tenantId,
    };
    store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<QualityGate | undefined> {
    return store.get(id);
  }

  async findByTenant(tenantId: string, options?: { enabledOnly?: boolean }): Promise<QualityGate[]> {
    let results = Array.from(store.values()).filter(e => e.tenantId === tenantId);
    if (options?.enabledOnly) {
      results = results.filter(e => e.enabled);
    }
    return results;
  }

  async findByName(tenantId: string, name: string): Promise<QualityGate | undefined> {
    return Array.from(store.values()).find(e => e.tenantId === tenantId && e.name === name);
  }

  async update(id: string, input: Partial<QualityGate>): Promise<QualityGate | null> {
    const existing = store.get(id);
    if (!existing) return null;
    const updated: QualityGate = { ...existing, ...input };
    store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  }
}

export const QualityGateRepositoryImpl = new QualityGateRepository();
export type QualityGateRepositoryType = typeof QualityGateRepository;