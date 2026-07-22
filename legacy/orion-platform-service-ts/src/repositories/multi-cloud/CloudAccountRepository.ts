/**
 * CloudAccountRepository - Cloud accounts and resource inventory
 *
 * Handles CRUD for:
 * - Cloud accounts (cloud_accounts table)
 * - Cloud resources (cloud_resources table)
 */

import { BaseRepository } from '../../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

// =============================================================================
// Entity Types
// =============================================================================

export interface CloudAccountEntity {
  id: string;
  tenant_id: string;
  provider_id: string | null;
  account_name: string;
  account_id: string;
  credential_type: string;
  credential_ref: string;
  region: string;
  status: string;
  monthly_budget: number | null;
  current_spend: number;
  tags: Record<string, any>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface CloudResourceEntity {
  id: string;
  tenant_id: string;
  account_id: string;
  resource_type: string;
  resource_id: string;
  resource_name: string | null;
  region: string;
  state: string;
  spec: Record<string, any>;
  monthly_cost: number;
  tags: Record<string, any>;
  discovered_at: Date;
  updated_at: Date;
}

// =============================================================================
// CloudAccountRepository
// =============================================================================

export class CloudAccountRepository extends BaseRepository<CloudAccountEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'cloud_accounts');
  }

  // ==================== Cloud Account Operations ====================

  async createCloudAccount(input: {
    tenant_id: string;
    account_name: string;
    account_id: string;
    credential_type: string;
    credential_ref: string;
    region: string;
    provider_id?: string;
    monthly_budget?: number;
    tags?: Record<string, any>;
    created_by?: string;
  }): Promise<CloudAccountEntity> {
    const result = await this.db.query(
      `INSERT INTO cloud_accounts
        (tenant_id, provider_id, account_name, account_id, credential_type, credential_ref, region, status, monthly_budget, tags, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10)
       RETURNING *`,
      [
        input.tenant_id,
        input.provider_id || null,
        input.account_name,
        input.account_id,
        input.credential_type,
        input.credential_ref,
        input.region,
        input.monthly_budget || null,
        input.tags || {},
        input.created_by || 'system',
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into cloud_accounts returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAccountById(id: string): Promise<CloudAccountEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cloud_accounts WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAccountsByTenant(tenantId: string): Promise<CloudAccountEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_accounts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  async deleteCloudAccount(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM cloud_accounts WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Resource Inventory Operations ====================

  async createResource(input: {
    tenant_id: string;
    account_id: string;
    resource_type: string;
    resource_id: string;
    resource_name?: string;
    region: string;
    state?: string;
    spec?: Record<string, any>;
    monthly_cost?: number;
    tags?: Record<string, any>;
  }): Promise<CloudResourceEntity> {
    const result = await this.db.query(
      `INSERT INTO cloud_resources
        (tenant_id, account_id, resource_type, resource_id, resource_name, region, state, spec, monthly_cost, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.tenant_id,
        input.account_id,
        input.resource_type,
        input.resource_id,
        input.resource_name || null,
        input.region,
        input.state || 'running',
        input.spec || {},
        input.monthly_cost || 0,
        input.tags || {},
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into cloud_resources returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapResourceRow(result.rows[0]);
  }

  async findResourcesByTenant(tenantId: string, accountId?: string): Promise<CloudResourceEntity[]> {
    if (accountId) {
      const result = await this.db.query(
        `SELECT * FROM cloud_resources WHERE tenant_id = $1 AND account_id = $2 ORDER BY resource_type`,
        [tenantId, accountId],
      );
      return result.rows.map((row: any) => this.mapResourceRow(row));
    }
    const result = await this.db.query(
      `SELECT * FROM cloud_resources WHERE tenant_id = $1 ORDER BY resource_type`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapResourceRow(row));
  }

  async deleteResourcesByAccount(accountId: string, tenantId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM cloud_resources WHERE account_id = $1 AND tenant_id = $2`,
      [accountId, tenantId],
    );
    return result.rowCount ?? 0;
  }

  // ==================== Converters ====================

  protected mapRowToEntity(row: any): CloudAccountEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      provider_id: row.provider_id,
      account_name: row.account_name,
      account_id: row.account_id,
      credential_type: row.credential_type,
      credential_ref: row.credential_ref,
      region: row.region,
      status: row.status,
      monthly_budget: row.monthly_budget,
      current_spend: row.current_spend ?? 0,
      tags: row.tags || {},
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapResourceRow(row: any): CloudResourceEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      account_id: row.account_id,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      resource_name: row.resource_name,
      region: row.region,
      state: row.state,
      spec: row.spec || {},
      monthly_cost: row.monthly_cost ?? 0,
      tags: row.tags || {},
      discovered_at: row.discovered_at,
      updated_at: row.updated_at,
    };
  }
}
