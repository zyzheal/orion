// Secret Repository - In-memory implementation with PostgreSQL pattern
import { Pool } from 'pg';

export enum SecretScope { TENANT = 'tenant', PROJECT = 'project', GLOBAL = 'global' }

export interface SecretEntity {
  id: string;
  tenant_id: string;
  name: string;
  value: string;
  encrypted_value?: string;
  scope: SecretScope;
  created_by?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface SecretCreateInput {
  tenant_id: string;
  name: string;
  value: string;
  scope: SecretScope;
  created_by?: string;
}

// In-memory store
const secrets = new Map<string, SecretEntity>();

export class SecretRepository {
  constructor(_pool: Pool | null) {}

  async create(input: SecretCreateInput): Promise<SecretEntity> {
    const entity: SecretEntity = {
      id: crypto.randomUUID(),
      tenant_id: input.tenant_id,
      name: input.name,
      value: input.value,
      scope: input.scope,
      created_by: input.created_by,
      created_at: new Date(),
    };
    secrets.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<SecretEntity | null> {
    return secrets.get(id) ?? null;
  }

  async findByName(tenantId: string, name: string, scope?: SecretScope): Promise<SecretEntity | null> {
    for (const secret of secrets.values()) {
      if (secret.tenant_id === tenantId && secret.name === name) {
        if (!scope || secret.scope === scope) return secret;
      }
    }
    return null;
  }

  async listByTenantAndScope(tenantId: string, scope?: SecretScope): Promise<SecretEntity[]> {
    const results: SecretEntity[] = [];
    for (const secret of secrets.values()) {
      if (secret.tenant_id === tenantId) {
        if (!scope || secret.scope === scope) results.push(secret);
      }
    }
    return results;
  }

  async update(id: string, value: string): Promise<SecretEntity | null> {
    const existing = secrets.get(id);
    if (!existing) return null;
    const updated: SecretEntity = { ...existing, value, updated_at: new Date() };
    secrets.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return secrets.delete(id);
  }

  async upsert(input: SecretCreateInput): Promise<SecretEntity> {
    const existing = await this.findByName(input.tenant_id, input.name, input.scope);
    if (existing) {
      return (await this.update(existing.id, input.value))!;
    }
    return this.create(input);
  }

  async findByTenantAndName(tenantId: string, name: string, scope?: SecretScope): Promise<SecretEntity | null> {
    return this.findByName(tenantId, name, scope);
  }
}

export type SecretRepositoryType = typeof SecretRepository;