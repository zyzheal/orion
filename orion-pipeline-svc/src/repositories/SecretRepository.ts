// Stub - TODO: implement with PostgreSQL
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

export class SecretRepository {
  constructor(_pool: Pool | null) {}
  async create(_input: SecretCreateInput): Promise<SecretEntity> {
    throw new Error('Not implemented');
  }
  async findById(_id: string): Promise<SecretEntity | null> {
    return null;
  }
  async findByName(_tenantId: string, _name: string, _scope?: SecretScope): Promise<SecretEntity | null> {
    return null;
  }
  async listByTenantAndScope(_tenantId: string, _scope?: SecretScope): Promise<SecretEntity[]> {
    return [];
  }
  async update(_id: string, _value: string): Promise<SecretEntity | null> {
    return null;
  }
  async delete(_id: string): Promise<boolean> {
    return false;
  }
  async upsert(_input: SecretCreateInput): Promise<SecretEntity> {
    throw new Error('Not implemented');
  }
  async findByTenantAndName(_tenantId: string, _name: string, _scope?: SecretScope): Promise<SecretEntity | null> {
    return null;
  }
}
export type SecretRepositoryType = typeof SecretRepository;
