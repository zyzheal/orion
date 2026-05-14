/**
 * MultiCloud Repository - Stub Implementation
 *
 * In-memory stub for cloud account and resource repositories.
 * Used by MultiCloudManagerService and CloudProviderService.
 */

export interface CloudAccountEntity {
  id: string;
  tenant_id: string;
  account_id: string;
  account_name: string;
  credential_type: string;
  credential_ref: string;
  region: string;
  status: string;
  provider_id?: string;
  updated_at?: Date;
  tags: Record<string, any>;
  created_at: Date;
  [key: string]: unknown;
}

export interface CloudResourceEntity {
  id: string;
  tenant_id: string;
  account_id: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  region: string;
  state: string;
  spec: Record<string, any>;
  monthly_cost: number;
  discovered_at?: Date;
  tags: Record<string, any>;
  created_at: Date;
  [key: string]: unknown;
}

export class MultiCloudRepository {
  private accounts = new Map<string, CloudAccountEntity>();
  private resources = new Map<string, CloudResourceEntity>();

  constructor(_pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async createCloudAccount(data: {
    tenant_id: string;
    account_name: string;
    account_id: string;
    credential_type: string;
    credential_ref: string;
    region: string;
    provider_id?: string;
    tags: Record<string, any>;
  }): Promise<CloudAccountEntity> {
    const entity: CloudAccountEntity = {
      id: `mcr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenant_id: data.tenant_id,
      account_id: data.account_id,
      account_name: data.account_name,
      credential_type: data.credential_type,
      credential_ref: data.credential_ref,
      region: data.region,
      status: 'active',
      tags: data.tags,
      created_at: new Date(),
    };
    this.accounts.set(entity.id, entity);
    return entity;
  }

  async deleteCloudAccount(accountId: string, _tenantId: string): Promise<boolean> {
    for (const [key, val] of this.accounts.entries()) {
      if (val.account_id === accountId) {
        this.accounts.delete(key);
        return true;
      }
    }
    return false;
  }

  async findAccountsByTenant(tenantId: string): Promise<CloudAccountEntity[]> {
    return Array.from(this.accounts.values()).filter(a => a.tenant_id === tenantId);
  }

  async findAccountById(accountId: string): Promise<CloudAccountEntity | null> {
    for (const a of this.accounts.values()) {
      if (a.account_id === accountId) return a;
    }
    return null;
  }

  async createResource(data: {
    tenant_id: string;
    account_id: string;
    resource_type: string;
    resource_id: string;
    resource_name: string;
    region: string;
    state: string;
    spec: Record<string, any>;
    monthly_cost?: number;
    tags: Record<string, any>;
  }): Promise<CloudResourceEntity> {
    const entity: CloudResourceEntity = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...data,
      monthly_cost: data.monthly_cost ?? 0,
      created_at: new Date(),
    };
    this.resources.set(entity.id, entity);
    return entity;
  }

  async deleteResourcesByAccount(accountId: string, _tenantId: string): Promise<boolean> {
    let deleted = false;
    for (const [key, val] of this.resources.entries()) {
      if (val.account_id === accountId) {
        this.resources.delete(key);
        deleted = true;
      }
    }
    return deleted;
  }

  async findResourcesByTenant(tenantId: string, _accountId?: string): Promise<CloudResourceEntity[]> {
    return Array.from(this.resources.values()).filter(r => r.tenant_id === tenantId);
  }
}
