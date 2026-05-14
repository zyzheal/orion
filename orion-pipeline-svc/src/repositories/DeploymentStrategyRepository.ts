// DeploymentStrategy Repository - In-memory implementation
import { Pool } from 'pg';

export interface DeploymentStrategyEntity {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  description?: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DeploymentStrategyCreateInput {
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  description?: string | null;
  enabled?: boolean;
}

export interface DeploymentStrategyUpdateInput {
  name?: string;
  config?: Record<string, unknown>;
  description?: string;
  enabled?: boolean;
}

// In-memory store
const strategies = new Map<string, DeploymentStrategyEntity>();

export class DeploymentStrategyRepository {
  constructor(_pool: Pool | null) {}

  async create(input: DeploymentStrategyCreateInput): Promise<DeploymentStrategyEntity> {
    const now = new Date();
    const entity: DeploymentStrategyEntity = {
      id: crypto.randomUUID(),
      tenant_id: input.tenant_id,
      name: input.name,
      type: input.type,
      config: input.config,
      description: input.description ?? null,
      enabled: input.enabled ?? true,
      created_at: now,
      updated_at: now,
    };
    strategies.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<DeploymentStrategyEntity | null> {
    return strategies.get(id) ?? null;
  }

  async findByTenant(tenantId: string): Promise<DeploymentStrategyEntity[]> {
    return Array.from(strategies.values()).filter(s => s.tenant_id === tenantId);
  }

  async findByType(tenantId: string, type: string): Promise<DeploymentStrategyEntity[]> {
    return Array.from(strategies.values()).filter(s => s.tenant_id === tenantId && s.type === type);
  }

  async update(id: string, updates: DeploymentStrategyUpdateInput): Promise<DeploymentStrategyEntity | null> {
    const existing = strategies.get(id);
    if (!existing) return null;
    const updated: DeploymentStrategyEntity = { ...existing, ...updates, updated_at: new Date() };
    strategies.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return strategies.delete(id);
  }

  async findByName(tenantId: string, name: string): Promise<DeploymentStrategyEntity | null> {
    return Array.from(strategies.values()).find(s => s.tenant_id === tenantId && s.name === name) ?? null;
  }
}

export type DeploymentStrategyRepositoryType = typeof DeploymentStrategyRepository;