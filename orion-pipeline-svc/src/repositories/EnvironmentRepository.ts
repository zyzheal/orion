/**
 * EnvironmentRepository - In-memory stub for pipeline environments.
 *
 * TODO: Replace with PostgreSQL implementation using pipeline_environments table.
 */

import type { EnvironmentEntity } from '../models/Environment';

export type { EnvironmentEntity };

export interface EnvironmentCreateInput {
  id?: string;
  tenantId: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
  variables?: Record<string, string>;
  approvalRequired?: boolean;
  approvalCount?: number;
}

const store = new Map<string, EnvironmentEntity>();

export class EnvironmentRepository {
  async create(input: Omit<EnvironmentEntity, 'createdAt' | 'updatedAt'>): Promise<EnvironmentEntity> {
    const now = new Date().toISOString();
    const entity: EnvironmentEntity = {
      id: input.id || crypto.randomUUID(),
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      displayOrder: input.displayOrder ?? 0,
      variables: input.variables ?? {},
      approvalRequired: input.approvalRequired ?? false,
      approvalCount: input.approvalCount ?? 1,
      createdAt: now,
      updatedAt: now,
    };
    store.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<EnvironmentEntity | undefined> {
    return store.get(id);
  }

  async findByTenant(tenantId: string): Promise<EnvironmentEntity[]> {
    return Array.from(store.values())
      .filter(e => e.tenantId === tenantId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async findByTenantAndName(tenantId: string, name: string): Promise<EnvironmentEntity | undefined> {
    return Array.from(store.values()).find(e => e.tenantId === tenantId && e.name === name);
  }

  async update(id: string, input: Partial<EnvironmentEntity>): Promise<EnvironmentEntity> {
    const existing = store.get(id);
    if (!existing) throw new Error(`Environment '${id}' not found`);
    const updated = { ...existing, ...input, updatedAt: new Date().toISOString() };
    store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return store.delete(id);
  }
}
