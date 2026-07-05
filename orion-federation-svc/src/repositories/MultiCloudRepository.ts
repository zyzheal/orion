/**
 * MultiCloud Repository - PostgreSQL Implementation
 *
 * Cloud account and resource repositories using PostgreSQL.
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
  constructor(private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

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
    const result = await this.pool.query(
      `INSERT INTO federation_cloud_accounts (tenant_id, account_id, account_name, credential_type, credential_ref, region, status, provider_id, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.tenant_id,
        data.account_id,
        data.account_name,
        data.credential_type,
        data.credential_ref,
        data.region,
        'active',
        data.provider_id || null,
        JSON.stringify(data.tags),
      ]
    );
    return this.mapAccountRow(result.rows[0]);
  }

  async deleteCloudAccount(accountId: string, _tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM federation_cloud_accounts WHERE account_id = $1',
      [accountId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAccountsByTenant(tenantId: string): Promise<CloudAccountEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM federation_cloud_accounts WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows.map(this.mapAccountRow);
  }

  async findAccountById(accountId: string): Promise<CloudAccountEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM federation_cloud_accounts WHERE account_id = $1',
      [accountId]
    );
    return result.rows[0] ? this.mapAccountRow(result.rows[0]) : null;
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
    const result = await this.pool.query(
      `INSERT INTO federation_cloud_resources (tenant_id, account_id, resource_type, resource_id, resource_name, region, state, spec, monthly_cost, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.tenant_id,
        data.account_id,
        data.resource_type,
        data.resource_id,
        data.resource_name,
        data.region,
        data.state,
        JSON.stringify(data.spec),
        data.monthly_cost ?? 0,
        JSON.stringify(data.tags),
      ]
    );
    return this.mapResourceRow(result.rows[0]);
  }

  async deleteResourcesByAccount(accountId: string, _tenantId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM federation_cloud_resources WHERE account_id = $1',
      [accountId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findResourcesByTenant(tenantId: string, _accountId?: string): Promise<CloudResourceEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM federation_cloud_resources WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows.map(this.mapResourceRow);
  }

  private mapAccountRow(row: Record<string, unknown>): CloudAccountEntity {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      account_id: row.account_id as string,
      account_name: row.account_name as string,
      credential_type: row.credential_type as string,
      credential_ref: row.credential_ref as string,
      region: row.region as string,
      status: row.status as string,
      provider_id: row.provider_id as string | undefined,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || {}),
      created_at: new Date(row.created_at as string),
      updated_at: row.updated_at ? new Date(row.updated_at as string) : undefined,
    };
  }

  private mapResourceRow(row: Record<string, unknown>): CloudResourceEntity {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      account_id: row.account_id as string,
      resource_type: row.resource_type as string,
      resource_id: row.resource_id as string,
      resource_name: row.resource_name as string,
      region: row.region as string,
      state: row.state as string,
      spec: typeof row.spec === 'string' ? JSON.parse(row.spec) : (row.spec || {}),
      monthly_cost: Number(row.monthly_cost) || 0,
      discovered_at: row.discovered_at ? new Date(row.discovered_at as string) : undefined,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || {}),
      created_at: new Date(row.created_at as string),
    };
  }
}