/**
 * SyncRepository - Cloud sync jobs and resource sync state
 *
 * Handles CRUD for:
 * - Cloud sync jobs (cloud_sync_jobs table)
 * - Cloud resource sync state (cloud_resource_sync_state table)
 */

import { OrionError, ErrorCode } from '../../errors';

// =============================================================================
// Entity Types
// =============================================================================

export interface CloudSyncJobEntity {
  id: string;
  tenant_id: string;
  account_id: string;
  provider: string;
  sync_type: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  resources_discovered: number;
  resources_created: number;
  resources_updated: number;
  resources_deleted: number;
  resources_skipped: number;
  errors: any[];
  conflict_resolutions: any[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CloudResourceSyncStateEntity {
  id: string;
  tenant_id: string;
  account_id: string;
  resource_type: string;
  provider_resource_id: string;
  resource_name: string | null;
  region: string;
  provider_state: string;
  orion_state: string;
  sync_status: string;
  last_sync_at: Date;
  last_discovered_at: Date;
  drift_detected_at: Date | null;
  conflict_reason: string | null;
  spec_hash: string | null;
  provider_spec: Record<string, any>;
  orion_spec: Record<string, any>;
  tags: Record<string, any>;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// SyncRepository
// =============================================================================

export class SyncRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

  // ==================== Cloud Sync Job Operations ====================

  async createCloudSyncJob(input: {
    id: string;
    tenant_id: string;
    account_id: string;
    provider: string;
    sync_type?: string;
    status?: string;
    metadata?: Record<string, any>;
  }): Promise<CloudSyncJobEntity> {
    const result = await this.db.query(
      `INSERT INTO cloud_sync_jobs
        (id, tenant_id, account_id, provider, sync_type, status, started_at, completed_at,
         resources_discovered, resources_created, resources_updated, resources_deleted,
         resources_skipped, errors, conflict_resolutions, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        input.id,
        input.tenant_id,
        input.account_id,
        input.provider,
        input.sync_type || 'full',
        input.status || 'pending',
        null,
        null,
        0,
        0,
        0,
        0,
        0,
        '[]',
        '[]',
        JSON.stringify(input.metadata || {}),
        new Date(),
        new Date(),
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into cloud_sync_jobs returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapCloudSyncJobRow(result.rows[0]);
  }

  async findCloudSyncJobById(id: string): Promise<CloudSyncJobEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cloud_sync_jobs WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCloudSyncJobRow(result.rows[0]);
  }

  async findCloudSyncJobsByTenant(tenantId: string, accountId?: string): Promise<CloudSyncJobEntity[]> {
    if (accountId) {
      const result = await this.db.query(
        `SELECT * FROM cloud_sync_jobs WHERE tenant_id = $1 AND account_id = $2 ORDER BY created_at DESC`,
        [tenantId, accountId],
      );
      return result.rows.map((row: any) => this.mapCloudSyncJobRow(row));
    }
    const result = await this.db.query(
      `SELECT * FROM cloud_sync_jobs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapCloudSyncJobRow(row));
  }

  async updateCloudSyncJobStatus(
    id: string,
    status: string,
    updates?: {
      startedAt?: Date;
      completedAt?: Date;
      resourcesDiscovered?: number;
      resourcesCreated?: number;
      resourcesUpdated?: number;
      resourcesDeleted?: number;
      resourcesSkipped?: number;
      errors?: any[];
    }
  ): Promise<CloudSyncJobEntity> {
    const setClauses: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [id, status];
    let paramIndex = 3;

    if (updates?.startedAt) {
      setClauses.push(`started_at = $${paramIndex++}`);
      params.push(updates.startedAt);
    }
    if (updates?.completedAt) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      params.push(updates.completedAt);
    }
    if (updates?.resourcesDiscovered !== undefined) {
      setClauses.push(`resources_discovered = $${paramIndex++}`);
      params.push(updates.resourcesDiscovered);
    }
    if (updates?.resourcesCreated !== undefined) {
      setClauses.push(`resources_created = $${paramIndex++}`);
      params.push(updates.resourcesCreated);
    }
    if (updates?.resourcesUpdated !== undefined) {
      setClauses.push(`resources_updated = $${paramIndex++}`);
      params.push(updates.resourcesUpdated);
    }
    if (updates?.resourcesDeleted !== undefined) {
      setClauses.push(`resources_deleted = $${paramIndex++}`);
      params.push(updates.resourcesDeleted);
    }
    if (updates?.resourcesSkipped !== undefined) {
      setClauses.push(`resources_skipped = $${paramIndex++}`);
      params.push(updates.resourcesSkipped);
    }
    if (updates?.errors !== undefined) {
      setClauses.push(`errors = $${paramIndex++}`);
      params.push(JSON.stringify(updates.errors));
    }

    const query = `UPDATE cloud_sync_jobs SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new OrionError(`Cloud sync job not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.mapCloudSyncJobRow(result.rows[0]);
  }

  // ==================== Cloud Resource Sync State Operations ====================

  async upsertCloudResourceSyncState(input: {
    id: string;
    tenant_id: string;
    account_id: string;
    resource_type: string;
    provider_resource_id: string;
    resource_name?: string;
    region: string;
    provider_state: string;
    orion_state?: string;
    sync_status?: string;
    spec_hash?: string | null;
    provider_spec?: Record<string, any>;
    orion_spec?: Record<string, any>;
    tags?: Record<string, any>;
  }): Promise<CloudResourceSyncStateEntity> {
    const result = await this.db.query(
      `INSERT INTO cloud_resource_sync_state
        (id, tenant_id, account_id, resource_type, provider_resource_id, resource_name,
         region, provider_state, orion_state, sync_status, last_sync_at, last_discovered_at,
         drift_detected_at, conflict_reason, spec_hash, provider_spec, orion_spec, tags,
         metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NULL, NULL, $11, $12, $13, $14, '{}', NOW(), NOW())
       ON CONFLICT (tenant_id, account_id, provider_resource_id)
       DO UPDATE SET
         resource_name = EXCLUDED.resource_name,
         region = EXCLUDED.region,
         provider_state = EXCLUDED.provider_state,
         orion_state = EXCLUDED.orion_state,
         sync_status = EXCLUDED.sync_status,
         last_sync_at = NOW(),
         last_discovered_at = NOW(),
         spec_hash = EXCLUDED.spec_hash,
         provider_spec = EXCLUDED.provider_spec,
         orion_spec = EXCLUDED.orion_spec,
         tags = EXCLUDED.tags,
         updated_at = NOW()
       RETURNING *`,
      [
        input.id,
        input.tenant_id,
        input.account_id,
        input.resource_type,
        input.provider_resource_id,
        input.resource_name || null,
        input.region,
        input.provider_state,
        input.orion_state || 'running',
        input.sync_status || 'synced',
        input.spec_hash || null,
        JSON.stringify(input.provider_spec || {}),
        JSON.stringify(input.orion_spec || {}),
        JSON.stringify(input.tags || {}),
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT/UPDATE cloud_resource_sync_state returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapCloudResourceSyncStateRow(result.rows[0]);
  }

  async findCloudResourceSyncStateByAccount(tenantId: string, accountId: string): Promise<CloudResourceSyncStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_resource_sync_state WHERE tenant_id = $1 AND account_id = $2 ORDER BY last_sync_at DESC`,
      [tenantId, accountId],
    );
    return result.rows.map((row: any) => this.mapCloudResourceSyncStateRow(row));
  }

  async updateCloudResourceSyncStatus(
    id: string,
    syncStatus: string,
    updates?: {
      orionState?: string;
      driftDetectedAt?: Date;
      conflictReason?: string;
    }
  ): Promise<CloudResourceSyncStateEntity> {
    const setClauses: string[] = ['sync_status = $2', 'updated_at = NOW()'];
    const params: any[] = [id, syncStatus];
    let paramIndex = 3;

    if (updates?.orionState) {
      setClauses.push(`orion_state = $${paramIndex++}`);
      params.push(updates.orionState);
    }
    if (updates?.driftDetectedAt) {
      setClauses.push(`drift_detected_at = $${paramIndex++}`);
      params.push(updates.driftDetectedAt);
    }
    if (updates?.conflictReason) {
      setClauses.push(`conflict_reason = $${paramIndex++}`);
      params.push(updates.conflictReason);
    }

    const query = `UPDATE cloud_resource_sync_state SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;

    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new OrionError(`Cloud resource sync state not found: ${id}`, ErrorCode.NOT_FOUND);
    }
    return this.mapCloudResourceSyncStateRow(result.rows[0]);
  }

  async deleteCloudResourceSyncStateByAccount(tenantId: string, accountId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM cloud_resource_sync_state WHERE tenant_id = $1 AND account_id = $2`,
      [tenantId, accountId],
    );
    return result.rowCount ?? 0;
  }

  // ==================== Converters ====================

  private mapCloudSyncJobRow(row: any): CloudSyncJobEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      account_id: row.account_id,
      provider: row.provider,
      sync_type: row.sync_type,
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
      resources_discovered: Number(row.resources_discovered),
      resources_created: Number(row.resources_created),
      resources_updated: Number(row.resources_updated),
      resources_deleted: Number(row.resources_deleted),
      resources_skipped: Number(row.resources_skipped),
      errors: typeof row.errors === 'string' ? JSON.parse(row.errors) : (row.errors ?? []),
      conflict_resolutions: typeof row.conflict_resolutions === 'string' ? JSON.parse(row.conflict_resolutions) : (row.conflict_resolutions ?? []),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapCloudResourceSyncStateRow(row: any): CloudResourceSyncStateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      account_id: row.account_id,
      resource_type: row.resource_type,
      provider_resource_id: row.provider_resource_id,
      resource_name: row.resource_name,
      region: row.region,
      provider_state: row.provider_state,
      orion_state: row.orion_state,
      sync_status: row.sync_status,
      last_sync_at: row.last_sync_at,
      last_discovered_at: row.last_discovered_at,
      drift_detected_at: row.drift_detected_at,
      conflict_reason: row.conflict_reason,
      spec_hash: row.spec_hash,
      provider_spec: typeof row.provider_spec === 'string' ? JSON.parse(row.provider_spec) : (row.provider_spec ?? {}),
      orion_spec: typeof row.orion_spec === 'string' ? JSON.parse(row.orion_spec) : (row.orion_spec ?? {}),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? {}),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
