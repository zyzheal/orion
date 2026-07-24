/**
 * Disaster Recovery Repository
 * 
 * Data access layer for disaster recovery configuration and operations.
 * Handles all database interactions for DR management.
 */

import { Pool, QueryResult } from 'pg';

// =============================================================================
// Types
// =============================================================================

export type SyncMode = 'sync' | 'async' | 'semi-sync';
export type ConfigStatus = 'active' | 'inactive' | 'failing_over' | 'failed_over' | 'failed_back';
export type FailoverType = 'failover' | 'failback';
export type TriggeredBy = 'manual' | 'automatic' | 'scheduled';
export type FailoverStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type ReplicationStatus = 'normal' | 'delayed' | 'stopped' | 'error' | 'unknown';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type ClusterStatusValue = 'online' | 'offline' | 'syncing' | 'unknown';
export type ClusterRole = 'primary' | 'standby' | 'witness';

export interface DisasterRecoveryConfig {
  id: string;
  name: string;
  primaryClusterId: string;
  primaryClusterEndpoint: string;
  standbyClusterId: string;
  standbyClusterEndpoint: string;
  syncMode: SyncMode;
  autoFailover: boolean;
  failoverThresholdSeconds: number;
  healthCheckIntervalSeconds: number;
  syncIntervalSeconds: number;
  rpoTargetSeconds: number;
  rtoTargetSeconds: number;
  status: ConfigStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FailoverHistory {
  id: string;
  configId: string;
  failoverType: FailoverType;
  triggeredBy: TriggeredBy;
  triggerReason: string | null;
  sourceClusterId: string;
  targetClusterId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: FailoverStatus;
  rpoAchievedSeconds: number | null;
  rtoAchievedSeconds: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface ReplicationLagMonitoring {
  id: string;
  configId: string;
  clusterId: string;
  lagSeconds: number;
  lagBytes: number | null;
  lastSyncTimestamp: Date | null;
  replicationStatus: ReplicationStatus;
  recordedAt: Date;
}

export interface HealthCheckHistory {
  id: string;
  configId: string;
  clusterId: string;
  healthStatus: HealthStatus;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface ClusterStatus {
  id: string;
  configId: string;
  clusterId: string;
  role: ClusterRole;
  status: ClusterStatusValue;
  lastHeartbeat: Date | null;
  dataCenter: string | null;
  region: string | null;
  availabilityZone: string | null;
  connectionString: string | null;
  isPrimary: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FailoverLock {
  id: string;
  configId: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface DisasterRecoveryStatus {
  configId: string;
  name: string;
  primaryClusterId: string;
  primaryClusterEndpoint: string;
  standbyClusterId: string;
  standbyClusterEndpoint: string;
  syncMode: SyncMode;
  autoFailover: boolean;
  rpoTargetSeconds: number;
  rtoTargetSeconds: number;
  configStatus: ConfigStatus;
  primaryStatus: ClusterStatusValue | null;
  standbyStatus: ClusterStatusValue | null;
  currentLagSeconds: number | null;
  rpoStatus: 'compliant' | 'non-compliant';
  lastUpdated: Date;
}

export interface CreateConfigInput {
  name: string;
  primaryClusterId: string;
  primaryClusterEndpoint: string;
  standbyClusterId: string;
  standbyClusterEndpoint: string;
  syncMode?: SyncMode;
  autoFailover?: boolean;
  failoverThresholdSeconds?: number;
  healthCheckIntervalSeconds?: number;
  syncIntervalSeconds?: number;
  rpoTargetSeconds?: number;
  rtoTargetSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateConfigInput {
  name?: string;
  primaryClusterId?: string;
  primaryClusterEndpoint?: string;
  standbyClusterId?: string;
  standbyClusterEndpoint?: string;
  syncMode?: SyncMode;
  autoFailover?: boolean;
  failoverThresholdSeconds?: number;
  healthCheckIntervalSeconds?: number;
  syncIntervalSeconds?: number;
  rpoTargetSeconds?: number;
  rtoTargetSeconds?: number;
  status?: ConfigStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateFailoverInput {
  configId: string;
  failoverType: FailoverType;
  triggeredBy: TriggeredBy;
  triggerReason?: string;
  sourceClusterId: string;
  targetClusterId: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateFailoverInput {
  status?: FailoverStatus;
  completedAt?: Date;
  rpoAchievedSeconds?: number;
  rtoAchievedSeconds?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Repository Implementation
// =============================================================================

export class DisasterRecoveryRepository {
  constructor(private readonly pool: Pool) {}

  // ===========================================================================
  // Configuration Methods
  // ===========================================================================

  /**
   * Create a new disaster recovery configuration
   */
  async createConfig(input: CreateConfigInput): Promise<DisasterRecoveryConfig> {
    const query = `
      INSERT INTO disaster_recovery_config (
        name, primary_cluster_id, primary_cluster_endpoint,
        standby_cluster_id, standby_cluster_endpoint,
        sync_mode, auto_failover, failover_threshold_seconds,
        health_check_interval_seconds, sync_interval_seconds,
        rpo_target_seconds, rto_target_seconds, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      input.name,
      input.primaryClusterId,
      input.primaryClusterEndpoint,
      input.standbyClusterId,
      input.standbyClusterEndpoint,
      input.syncMode ?? 'async',
      input.autoFailover ?? false,
      input.failoverThresholdSeconds ?? 300,
      input.healthCheckIntervalSeconds ?? 10,
      input.syncIntervalSeconds ?? 60,
      input.rpoTargetSeconds ?? 300,
      input.rtoTargetSeconds ?? 600,
      JSON.stringify(input.metadata ?? {}),
    ];

    const result = await this.pool.query(query, values);
    return this.mapConfig(result.rows[0]);
  }

  /**
   * Get configuration by ID
   */
  async getConfigById(id: string): Promise<DisasterRecoveryConfig | null> {
    const query = 'SELECT * FROM disaster_recovery_config WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapConfig(result.rows[0]) : null;
  }

  /**
   * Get all configurations
   */
  async getAllConfigs(): Promise<DisasterRecoveryConfig[]> {
    const query = 'SELECT * FROM disaster_recovery_config ORDER BY created_at DESC';
    const result = await this.pool.query(query);
    return result.rows.map(this.mapConfig);
  }

  /**
   * Get active configurations
   */
  async getActiveConfigs(): Promise<DisasterRecoveryConfig[]> {
    const query = "SELECT * FROM disaster_recovery_config WHERE status = 'active' ORDER BY created_at DESC";
    const result = await this.pool.query(query);
    return result.rows.map(this.mapConfig);
  }

  /**
   * Update configuration
   */
  async updateConfig(id: string, input: UpdateConfigInput): Promise<DisasterRecoveryConfig | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, keyof UpdateConfigInput> = {
      name: 'name',
      primary_cluster_id: 'primaryClusterId',
      primary_cluster_endpoint: 'primaryClusterEndpoint',
      standby_cluster_id: 'standbyClusterId',
      standby_cluster_endpoint: 'standbyClusterEndpoint',
      sync_mode: 'syncMode',
      auto_failover: 'autoFailover',
      failover_threshold_seconds: 'failoverThresholdSeconds',
      health_check_interval_seconds: 'healthCheckIntervalSeconds',
      sync_interval_seconds: 'syncIntervalSeconds',
      rpo_target_seconds: 'rpoTargetSeconds',
      rto_target_seconds: 'rtoTargetSeconds',
      status: 'status',
      metadata: 'metadata',
    };

    for (const [column, field] of Object.entries(fieldMap)) {
      const value = input[field];
      if (value !== undefined) {
        updates.push(`${column} = $${paramIndex}`);
        values.push(field === 'metadata' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return this.getConfigById(id);
    }

    values.push(id);
    const query = `
      UPDATE disaster_recovery_config 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0 ? this.mapConfig(result.rows[0]) : null;
  }

  /**
   * Delete configuration
   */
  async deleteConfig(id: string): Promise<boolean> {
    const query = 'DELETE FROM disaster_recovery_config WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ===========================================================================
  // Status Methods
  // ===========================================================================

  /**
   * Get DR status view
   */
  async getDisasterRecoveryStatus(configId?: string): Promise<DisasterRecoveryStatus[]> {
    let query = 'SELECT * FROM v_disaster_recovery_status';
    const params: string[] = [];

    if (configId) {
      query += ' WHERE config_id = $1';
      params.push(configId);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(row => ({
      configId: row.config_id,
      name: row.name,
      primaryClusterId: row.primary_cluster_id,
      primaryClusterEndpoint: row.primary_cluster_endpoint,
      standbyClusterId: row.standby_cluster_id,
      standbyClusterEndpoint: row.standby_cluster_endpoint,
      syncMode: row.sync_mode,
      autoFailover: row.auto_failover,
      rpoTargetSeconds: row.rpo_target_seconds,
      rtoTargetSeconds: row.rto_target_seconds,
      configStatus: row.config_status,
      primaryStatus: row.primary_status,
      standbyStatus: row.standby_status,
      currentLagSeconds: row.current_lag_seconds,
      rpoStatus: row.rpo_status,
      lastUpdated: row.last_updated,
    }));
  }

  /**
   * Check RPO compliance
   */
  async checkRpoCompliance(configId: string): Promise<boolean> {
    const query = 'SELECT check_rpo_compliance($1) AS compliant';
    const result = await this.pool.query(query, [configId]);
    return result.rows[0].compliant;
  }

  // ===========================================================================
  // Failover Methods
  // ===========================================================================

  /**
   * Create failover record
   */
  async createFailover(input: CreateFailoverInput): Promise<FailoverHistory> {
    const query = `
      INSERT INTO failover_history (
        config_id, failover_type, triggered_by, trigger_reason,
        source_cluster_id, target_cluster_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      input.configId,
      input.failoverType,
      input.triggeredBy,
      input.triggerReason ?? null,
      input.sourceClusterId,
      input.targetClusterId,
      JSON.stringify(input.metadata ?? {}),
    ];

    const result = await this.pool.query(query, values);
    return this.mapFailoverHistory(result.rows[0]);
  }

  /**
   * Update failover record
   */
  async updateFailover(id: string, input: UpdateFailoverInput): Promise<FailoverHistory | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, keyof UpdateFailoverInput> = {
      status: 'status',
      completed_at: 'completedAt',
      rpo_achieved_seconds: 'rpoAchievedSeconds',
      rto_achieved_seconds: 'rtoAchievedSeconds',
      error_message: 'errorMessage',
      metadata: 'metadata',
    };

    for (const [column, field] of Object.entries(fieldMap)) {
      const value = input[field];
      if (value !== undefined) {
        updates.push(`${column} = $${paramIndex}`);
        values.push(field === 'metadata' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return this.getFailoverById(id);
    }

    values.push(id);
    const query = `
      UPDATE failover_history 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0 ? this.mapFailoverHistory(result.rows[0]) : null;
  }

  /**
   * Get failover by ID
   */
  async getFailoverById(id: string): Promise<FailoverHistory | null> {
    const query = 'SELECT * FROM failover_history WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows.length > 0 ? this.mapFailoverHistory(result.rows[0]) : null;
  }

  /**
   * Get failover history for config
   */
  async getFailoverHistory(configId: string, limit: number = 50): Promise<FailoverHistory[]> {
    const query = `
      SELECT * FROM failover_history 
      WHERE config_id = $1 
      ORDER BY started_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [configId, limit]);
    return result.rows.map(this.mapFailoverHistory);
  }

  /**
   * Get latest failover for config
   */
  async getLatestFailover(configId: string): Promise<FailoverHistory | null> {
    const query = `
      SELECT * FROM failover_history 
      WHERE config_id = $1 
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query, [configId]);
    return result.rows.length > 0 ? this.mapFailoverHistory(result.rows[0]) : null;
  }

  /**
   * Get active failover for config
   */
  async getActiveFailover(configId: string): Promise<FailoverHistory | null> {
    const query = `
      SELECT * FROM failover_history 
      WHERE config_id = $1 AND status IN ('pending', 'in_progress')
      ORDER BY started_at DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query, [configId]);
    return result.rows.length > 0 ? this.mapFailoverHistory(result.rows[0]) : null;
  }

  // ===========================================================================
  // Lock Methods
  // ===========================================================================

  /**
   * Acquire failover lock
   */
  async acquireFailoverLock(
    configId: string,
    lockedBy: string,
    lockDurationSeconds: number = 300
  ): Promise<FailoverLock | null> {
    // First, expire any existing locks
    await this.expireLocks(configId);

    const query = `
      INSERT INTO failover_lock (config_id, locked_by, expires_at, is_active)
      VALUES ($1, $2, NOW() + INTERVAL '${lockDurationSeconds} seconds', true)
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [configId, lockedBy]);
      return this.mapFailoverLock(result.rows[0]);
    } catch (error) {
      // Lock acquisition failed (likely due to existing lock)
      return null;
    }
  }

  /**
   * Release failover lock
   */
  async releaseFailoverLock(lockId: string): Promise<boolean> {
    const query = `
      UPDATE failover_lock 
      SET is_active = false 
      WHERE id = $1 AND is_active = true
    `;
    const result = await this.pool.query(query, [lockId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Check if config is locked
   */
  async isConfigLocked(configId: string): Promise<FailoverLock | null> {
    await this.expireLocks(configId);
    
    const query = `
      SELECT * FROM failover_lock 
      WHERE config_id = $1 AND is_active = true AND expires_at > NOW()
    `;
    const result = await this.pool.query(query, [configId]);
    return result.rows.length > 0 ? this.mapFailoverLock(result.rows[0]) : null;
  }

  /**
   * Expire old locks
   */
  private async expireLocks(configId: string): Promise<void> {
    const query = `
      UPDATE failover_lock 
      SET is_active = false 
      WHERE config_id = $1 AND (is_active = false OR expires_at <= NOW())
    `;
    await this.pool.query(query, [configId]);
  }

  // ===========================================================================
  // Replication Lag Methods
  // ===========================================================================

  /**
   * Record replication lag
   */
  async recordReplicationLag(input: {
    configId: string;
    clusterId: string;
    lagSeconds: number;
    lagBytes?: number;
    lastSyncTimestamp?: Date;
    replicationStatus: ReplicationStatus;
  }): Promise<ReplicationLagMonitoring> {
    const query = `
      INSERT INTO replication_lag_monitoring (
        config_id, cluster_id, lag_seconds, lag_bytes,
        last_sync_timestamp, replication_status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      input.configId,
      input.clusterId,
      input.lagSeconds,
      input.lagBytes ?? null,
      input.lastSyncTimestamp ?? null,
      input.replicationStatus,
    ];

    const result = await this.pool.query(query, values);
    return this.mapReplicationLag(result.rows[0]);
  }

  /**
   * Get latest replication lag
   */
  async getLatestReplicationLag(configId: string): Promise<ReplicationLagMonitoring | null> {
    const query = `
      SELECT * FROM replication_lag_monitoring 
      WHERE config_id = $1 
      ORDER BY recorded_at DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query, [configId]);
    return result.rows.length > 0 ? this.mapReplicationLag(result.rows[0]) : null;
  }

  // ===========================================================================
  // Health Check Methods
  // ===========================================================================

  /**
   * Record health check
   */
  async recordHealthCheck(input: {
    configId: string;
    clusterId: string;
    healthStatus: HealthStatus;
    responseTimeMs?: number;
    errorMessage?: string;
  }): Promise<HealthCheckHistory> {
    const query = `
      INSERT INTO health_check_history (
        config_id, cluster_id, health_status, response_time_ms, error_message
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      input.configId,
      input.clusterId,
      input.healthStatus,
      input.responseTimeMs ?? null,
      input.errorMessage ?? null,
    ];

    const result = await this.pool.query(query, values);
    return this.mapHealthCheck(result.rows[0]);
  }

  /**
   * Get latest health check for cluster
   */
  async getLatestHealthCheck(configId: string, clusterId: string): Promise<HealthCheckHistory | null> {
    const query = `
      SELECT * FROM health_check_history 
      WHERE config_id = $1 AND cluster_id = $2
      ORDER BY checked_at DESC 
      LIMIT 1
    `;
    const result = await this.pool.query(query, [configId, clusterId]);
    return result.rows.length > 0 ? this.mapHealthCheck(result.rows[0]) : null;
  }

  // ===========================================================================
  // Cluster Status Methods
  // ===========================================================================

  /**
   * Upsert cluster status
   */
  async upsertClusterStatus(input: {
    configId: string;
    clusterId: string;
    role: ClusterRole;
    status: ClusterStatusValue;
    lastHeartbeat?: Date;
    dataCenter?: string;
    region?: string;
    availabilityZone?: string;
    connectionString?: string;
    isPrimary: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<ClusterStatus> {
    const query = `
      INSERT INTO cluster_status (
        config_id, cluster_id, role, status, last_heartbeat,
        data_center, region, availability_zone, connection_string,
        is_primary, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (config_id, cluster_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        last_heartbeat = EXCLUDED.last_heartbeat,
        data_center = EXCLUDED.data_center,
        region = EXCLUDED.region,
        availability_zone = EXCLUDED.availability_zone,
        connection_string = EXCLUDED.connection_string,
        is_primary = EXCLUDED.is_primary,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      input.configId,
      input.clusterId,
      input.role,
      input.status,
      input.lastHeartbeat ?? null,
      input.dataCenter ?? null,
      input.region ?? null,
      input.availabilityZone ?? null,
      input.connectionString ?? null,
      input.isPrimary,
      JSON.stringify(input.metadata ?? {}),
    ];

    const result = await this.pool.query(query, values);
    return this.mapClusterStatus(result.rows[0]);
  }

  /**
   * Get cluster status
   */
  async getClusterStatus(configId: string, clusterId: string): Promise<ClusterStatus | null> {
    const query = 'SELECT * FROM cluster_status WHERE config_id = $1 AND cluster_id = $2';
    const result = await this.pool.query(query, [configId, clusterId]);
    return result.rows.length > 0 ? this.mapClusterStatus(result.rows[0]) : null;
  }

  /**
   * Get all cluster statuses for config
   */
  async getAllClusterStatuses(configId: string): Promise<ClusterStatus[]> {
    const query = 'SELECT * FROM cluster_status WHERE config_id = $1';
    const result = await this.pool.query(query, [configId]);
    return result.rows.map(this.mapClusterStatus);
  }

  // ===========================================================================
  // Audit Methods
  // ===========================================================================

  /**
   * Log audit event
   */
  async logAuditEvent(input: {
    configId?: string;
    action: string;
    actor?: string;
    actorIp?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const query = `
      INSERT INTO disaster_recovery_audit_log (config_id, action, actor, actor_ip, details)
      VALUES ($1, $2, $3, $4, $5)
    `;

    const values = [
      input.configId ?? null,
      input.action,
      input.actor ?? null,
      input.actorIp ?? null,
      JSON.stringify(input.details ?? {}),
    ];

    await this.pool.query(query, values);
  }

  /**
   * Get audit log
   */
  async getAuditLog(configId: string, limit: number = 100): Promise<Array<{
    id: string;
    configId: string | null;
    action: string;
    actor: string | null;
    actorIp: string | null;
    details: Record<string, unknown>;
    createdAt: Date;
  }>> {
    const query = `
      SELECT * FROM disaster_recovery_audit_log 
      WHERE config_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [configId, limit]);
    return result.rows.map(row => ({
      id: row.id,
      configId: row.config_id,
      action: row.action,
      actor: row.actor,
      actorIp: row.actor_ip,
      details: row.details,
      createdAt: row.created_at,
    }));
  }

  // ===========================================================================
  // Cleanup Methods
  // ===========================================================================

  /**
   * Cleanup old health check records
   */
  async cleanupOldHealthChecks(maxAge: number = 7): Promise<number> {
    const query = `
      DELETE FROM health_check_history 
      WHERE checked_at < NOW() - INTERVAL '${maxAge} days'
    `;
    const result = await this.pool.query(query);
    return result.rowCount ?? 0;
  }

  /**
   * Cleanup old replication lag records
   */
  async cleanupOldReplicationLag(maxAge: number = 7): Promise<number> {
    const query = `
      DELETE FROM replication_lag_monitoring 
      WHERE recorded_at < NOW() - INTERVAL '${maxAge} days'
    `;
    const result = await this.pool.query(query);
    return result.rowCount ?? 0;
  }

  // ===========================================================================
  // Mapping Methods
  // ===========================================================================

  private mapConfig(row: Record<string, unknown>): DisasterRecoveryConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      primaryClusterId: row.primary_cluster_id as string,
      primaryClusterEndpoint: row.primary_cluster_endpoint as string,
      standbyClusterId: row.standby_cluster_id as string,
      standbyClusterEndpoint: row.standby_cluster_endpoint as string,
      syncMode: row.sync_mode as SyncMode,
      autoFailover: row.auto_failover as boolean,
      failoverThresholdSeconds: row.failover_threshold_seconds as number,
      healthCheckIntervalSeconds: row.health_check_interval_seconds as number,
      syncIntervalSeconds: row.sync_interval_seconds as number,
      rpoTargetSeconds: row.rpo_target_seconds as number,
      rtoTargetSeconds: row.rto_target_seconds as number,
      status: row.status as ConfigStatus,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapFailoverHistory(row: Record<string, unknown>): FailoverHistory {
    return {
      id: row.id as string,
      configId: row.config_id as string,
      failoverType: row.failover_type as FailoverType,
      triggeredBy: row.triggered_by as TriggeredBy,
      triggerReason: row.trigger_reason as string | null,
      sourceClusterId: row.source_cluster_id as string,
      targetClusterId: row.target_cluster_id as string,
      startedAt: row.started_at as Date,
      completedAt: row.completed_at as Date | null,
      status: row.status as FailoverStatus,
      rpoAchievedSeconds: row.rpo_achieved_seconds as number | null,
      rtoAchievedSeconds: row.rto_achieved_seconds as number | null,
      errorMessage: row.error_message as string | null,
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  private mapReplicationLag(row: Record<string, unknown>): ReplicationLagMonitoring {
    return {
      id: row.id as string,
      configId: row.config_id as string,
      clusterId: row.cluster_id as string,
      lagSeconds: row.lag_seconds as number,
      lagBytes: row.lag_bytes as number | null,
      lastSyncTimestamp: row.last_sync_timestamp as Date | null,
      replicationStatus: row.replication_status as ReplicationStatus,
      recordedAt: row.recorded_at as Date,
    };
  }

  private mapHealthCheck(row: Record<string, unknown>): HealthCheckHistory {
    return {
      id: row.id as string,
      configId: row.config_id as string,
      clusterId: row.cluster_id as string,
      healthStatus: row.health_status as HealthStatus,
      responseTimeMs: row.response_time_ms as number | null,
      errorMessage: row.error_message as string | null,
      checkedAt: row.checked_at as Date,
    };
  }

  private mapClusterStatus(row: Record<string, unknown>): ClusterStatus {
    return {
      id: row.id as string,
      configId: row.config_id as string,
      clusterId: row.cluster_id as string,
      role: row.role as ClusterRole,
      status: row.status as ClusterStatusValue,
      lastHeartbeat: row.last_heartbeat as Date | null,
      dataCenter: row.data_center as string | null,
      region: row.region as string | null,
      availabilityZone: row.availability_zone as string | null,
      connectionString: row.connection_string as string | null,
      isPrimary: row.is_primary as boolean,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }

  private mapFailoverLock(row: Record<string, unknown>): FailoverLock {
    return {
      id: row.id as string,
      configId: row.config_id as string,
      lockedBy: row.locked_by as string,
      lockedAt: row.locked_at as Date,
      expiresAt: row.expires_at as Date,
      isActive: row.is_active as boolean,
      metadata: row.metadata as Record<string, unknown>,
    };
  }
}

export default DisasterRecoveryRepository;