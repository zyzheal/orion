/**
 * MultiCloudRepository - Database layer for Multi-Cloud operations
 *
 * Provides PostgreSQL persistence for:
 * - Cloud accounts and resource inventory (MultiCloudManagerService)
 * - Cross-zone DR, cloud networks, scheduling policies/decisions (MultiCloudAdvancedService)
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../errors';

// =============================================================================
// Existing Entity Types (CloudAccount, CloudResource)
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
// New Entity Types (MultiCloudAdvancedService)
// =============================================================================

export interface CrossZoneDREntity {
  id: string;
  tenant_id: string;
  name: string;
  primary_zone: string;
  secondary_zone: string;
  strategy: 'active-passive' | 'active-active';
  rpo: number;
  rto: number;
  status: 'configured' | 'testing' | 'active' | 'failed';
  last_test_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DRTestResultEntity {
  id: string;
  dr_id: string;
  status: 'success' | 'failed' | 'partial';
  duration: number;
  details: Record<string, unknown>;
  tested_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CloudNetworkEntity {
  id: string;
  tenant_id: string;
  name: string;
  vpc_id: string;
  subnets: string[];
  security_groups: string[];
  status: 'active' | 'provisioning' | 'error';
  created_at: Date;
  updated_at: Date;
}

export interface SchedulingPolicyEntity {
  id: string;
  tenant_id: string;
  name: string;
  strategy: 'cost-optimized' | 'performance-optimized' | 'balanced' | 'geo-proximity';
  constraints: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SchedulingDecisionEntity {
  id: string;
  policy_id: string;
  resource_type: string;
  selected_provider: string;
  selected_region: string;
  estimated_cost: number;
  reason: string;
  alternatives: { provider: string; region: string; cost: number }[];
  decided_at: Date;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Sync Job Entity Types (CloudSyncService)
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
// MultiCloudRepository (cloud accounts, resources, plus advanced entities)
// =============================================================================

export class MultiCloudRepository extends BaseRepository<CloudAccountEntity> {
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

  // ==================== Cross-Zone DR Operations ====================

  async createCrossZoneDR(input: {
    id: string;
    tenant_id: string;
    name: string;
    primary_zone: string;
    secondary_zone: string;
    strategy: string;
    rpo: number;
    rto: number;
    status: string;
    last_test_at: Date | null;
    created_at: Date;
  }): Promise<CrossZoneDREntity> {
    const result = await this.db.query(
      `INSERT INTO cross_zone_dr
        (id, tenant_id, name, primary_zone, secondary_zone, strategy, rpo, rto, status, last_test_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [input.id, input.tenant_id, input.name, input.primary_zone, input.secondary_zone,
       input.strategy, input.rpo, input.rto, input.status, input.last_test_at, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into cross_zone_dr returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapCrossZoneDRRow(result.rows[0]);
  }

  async findCrossZoneDRById(id: string): Promise<CrossZoneDREntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cross_zone_dr WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCrossZoneDRRow(result.rows[0]);
  }

  async findCrossZoneDRByTenant(tenantId: string): Promise<CrossZoneDREntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cross_zone_dr WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapCrossZoneDRRow(row));
  }

  async updateCrossZoneDRStatus(id: string, status: string, lastTestAt?: Date | null): Promise<void> {
    if (lastTestAt !== undefined) {
      await this.db.query(
        `UPDATE cross_zone_dr SET status = $1, last_test_at = $2, updated_at = NOW() WHERE id = $3`,
        [status, lastTestAt, id],
      );
    } else {
      await this.db.query(
        `UPDATE cross_zone_dr SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, id],
      );
    }
  }

  // ==================== DR Test Result Operations ====================

  async createDRTestResult(input: {
    id: string;
    dr_id: string;
    status: string;
    duration: number;
    details: Record<string, unknown>;
    tested_at: Date;
    created_at: Date;
  }): Promise<DRTestResultEntity> {
    const result = await this.db.query(
      `INSERT INTO dr_test_results
        (id, dr_id, status, duration, details, tested_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.id, input.dr_id, input.status, input.duration,
       JSON.stringify(input.details), input.tested_at, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into dr_test_results returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapDRTestResultRow(result.rows[0]);
  }

  async findDRTestResultsByDRId(drId: string): Promise<DRTestResultEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM dr_test_results WHERE dr_id = $1 ORDER BY tested_at DESC`,
      [drId],
    );
    return result.rows.map((row: any) => this.mapDRTestResultRow(row));
  }

  // ==================== Cloud Network Operations ====================

  async createCloudNetwork(input: {
    id: string;
    tenant_id: string;
    name: string;
    vpc_id: string;
    subnets: string[];
    security_groups: string[];
    status: string;
    created_at: Date;
  }): Promise<CloudNetworkEntity> {
    const result = await this.db.query(
      `INSERT INTO cloud_networks
        (id, tenant_id, name, vpc_id, subnets, security_groups, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.id, input.tenant_id, input.name, input.vpc_id,
       JSON.stringify(input.subnets), JSON.stringify(input.security_groups),
       input.status, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into cloud_networks returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapCloudNetworkRow(result.rows[0]);
  }

  async findCloudNetworkById(id: string): Promise<CloudNetworkEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cloud_networks WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCloudNetworkRow(result.rows[0]);
  }

  async findCloudNetworksByTenant(tenantId: string): Promise<CloudNetworkEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_networks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapCloudNetworkRow(row));
  }

  // ==================== Scheduling Policy Operations ====================

  async createSchedulingPolicy(input: {
    id: string;
    tenant_id: string;
    name: string;
    strategy: string;
    constraints: Record<string, unknown>;
    priority: number;
    enabled: boolean;
    created_at: Date;
  }): Promise<SchedulingPolicyEntity> {
    const result = await this.db.query(
      `INSERT INTO scheduling_policies
        (id, tenant_id, name, strategy, constraints, priority, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.id, input.tenant_id, input.name, input.strategy,
       JSON.stringify(input.constraints), input.priority, input.enabled, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into scheduling_policies returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapSchedulingPolicyRow(result.rows[0]);
  }

  async findSchedulingPolicyById(id: string): Promise<SchedulingPolicyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM scheduling_policies WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapSchedulingPolicyRow(result.rows[0]);
  }

  async findSchedulingPoliciesByTenant(tenantId: string): Promise<SchedulingPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scheduling_policies WHERE tenant_id = $1 ORDER BY priority ASC, created_at DESC`,
      [tenantId],
    );
    return result.rows.map((row: any) => this.mapSchedulingPolicyRow(row));
  }

  // ==================== Scheduling Decision Operations ====================

  async createSchedulingDecision(input: {
    id: string;
    policy_id: string;
    resource_type: string;
    selected_provider: string;
    selected_region: string;
    estimated_cost: number;
    reason: string;
    alternatives: { provider: string; region: string; cost: number }[];
    decided_at: Date;
    created_at: Date;
  }): Promise<SchedulingDecisionEntity> {
    const result = await this.db.query(
      `INSERT INTO scheduling_decisions
        (id, policy_id, resource_type, selected_provider, selected_region, estimated_cost, reason, alternatives, decided_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [input.id, input.policy_id, input.resource_type, input.selected_provider,
       input.selected_region, input.estimated_cost, input.reason,
       JSON.stringify(input.alternatives), input.decided_at, input.created_at],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into scheduling_decisions returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return this.mapSchedulingDecisionRow(result.rows[0]);
  }

  async findSchedulingDecisionsByPolicyId(policyId: string): Promise<SchedulingDecisionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scheduling_decisions WHERE policy_id = $1 ORDER BY decided_at DESC`,
      [policyId],
    );
    return result.rows.map((row: any) => this.mapSchedulingDecisionRow(row));
  }

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

  private mapCrossZoneDRRow(row: any): CrossZoneDREntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      primary_zone: row.primary_zone,
      secondary_zone: row.secondary_zone,
      strategy: row.strategy,
      rpo: Number(row.rpo),
      rto: Number(row.rto),
      status: row.status,
      last_test_at: row.last_test_at ? new Date(row.last_test_at) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapDRTestResultRow(row: any): DRTestResultEntity {
    return {
      id: row.id,
      dr_id: row.dr_id,
      status: row.status,
      duration: Number(row.duration),
      details: typeof row.details === 'string' ? JSON.parse(row.details) : (row.details ?? {}),
      tested_at: row.tested_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapCloudNetworkRow(row: any): CloudNetworkEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      vpc_id: row.vpc_id,
      subnets: typeof row.subnets === 'string' ? JSON.parse(row.subnets) : (row.subnets ?? []),
      security_groups: typeof row.security_groups === 'string' ? JSON.parse(row.security_groups) : (row.security_groups ?? []),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapSchedulingPolicyRow(row: any): SchedulingPolicyEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      strategy: row.strategy,
      constraints: typeof row.constraints === 'string' ? JSON.parse(row.constraints) : (row.constraints ?? {}),
      priority: Number(row.priority),
      enabled: row.enabled ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapSchedulingDecisionRow(row: any): SchedulingDecisionEntity {
    return {
      id: row.id,
      policy_id: row.policy_id,
      resource_type: row.resource_type,
      selected_provider: row.selected_provider,
      selected_region: row.selected_region,
      estimated_cost: Number(row.estimated_cost),
      reason: row.reason,
      alternatives: typeof row.alternatives === 'string' ? JSON.parse(row.alternatives) : (row.alternatives ?? []),
      decided_at: row.decided_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

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
