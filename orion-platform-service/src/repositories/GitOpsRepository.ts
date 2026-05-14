/**
 * GitOpsRepository - PostgreSQL persistence for GitOps configurations
 *
 * Manages GitOps configuration storage and sync history.
 */

import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';
import { GitOpsConfig, GitOpsStatus, SyncDirection } from '../services/config-mgmt/types';

interface GitOpsConfigRow {
  id: string;
  repo_url: string;
  branch: string;
  config_path: string;
  sync_interval: number;
  last_sync: Date | null;
  status: string;
  sync_direction: string;
  auto_apply: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  last_error: string | null;
}

interface SyncStatusRow {
  id: string;
  gitops_config_id: string;
  status: string;
  items_synced: number;
  items_failed: number;
  started_at: Date;
  completed_at: Date | null;
  error: string | null;
  drift_detected: boolean;
  drift_items: any[];
}

export class GitOpsRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  // ==================== GitOps Config CRUD ====================

  /**
   * Create a new GitOps configuration
   */
  async createGitOpsConfig(
    input: Omit<GitOpsConfig, 'lastSync' | 'lastError'> & { lastError?: string }
  ): Promise<GitOpsConfig> {
    const result = await this.pool.query(
      `INSERT INTO gitops_configs (
        id, repo_url, branch, config_path, sync_interval, status,
        sync_direction, auto_apply, created_by, last_error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.id,
        input.repoUrl,
        input.branch,
        input.configPath,
        input.syncInterval,
        input.status,
        input.syncDirection,
        input.autoApply,
        input.createdBy,
        input.lastError || null,
      ]
    );
    return this.mapRowToConfig(result.rows[0]);
  }

  /**
   * Find GitOps config by ID
   */
  async findById(id: string): Promise<GitOpsConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM gitops_configs WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRowToConfig(result.rows[0]) : null;
  }

  /**
   * Find all GitOps configs
   */
  async findAll(): Promise<GitOpsConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM gitops_configs ORDER BY created_at DESC'
    );
    return result.rows.map(row => this.mapRowToConfig(row));
  }

  /**
   * Find GitOps configs by status
   */
  async findByStatus(status: GitOpsStatus): Promise<GitOpsConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM gitops_configs WHERE status = $1',
      [status]
    );
    return result.rows.map(row => this.mapRowToConfig(row));
  }

  /**
   * Update GitOps config
   */
  async update(
    id: string,
    input: Partial<Omit<GitOpsConfig, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<GitOpsConfig | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.repoUrl !== undefined) {
      sets.push(`repo_url = $${idx++}`);
      params.push(input.repoUrl);
    }
    if (input.branch !== undefined) {
      sets.push(`branch = $${idx++}`);
      params.push(input.branch);
    }
    if (input.configPath !== undefined) {
      sets.push(`config_path = $${idx++}`);
      params.push(input.configPath);
    }
    if (input.syncInterval !== undefined) {
      sets.push(`sync_interval = $${idx++}`);
      params.push(input.syncInterval);
    }
    if (input.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(input.status);
    }
    if (input.lastSync !== undefined) {
      sets.push(`last_sync = $${idx++}`);
      params.push(input.lastSync);
    }
    if (input.lastError !== undefined) {
      sets.push(`last_error = $${idx++}`);
      params.push(input.lastError);
    }

    if (sets.length === 0) {
      return this.findById(id);
    }

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE gitops_configs SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ? this.mapRowToConfig(result.rows[0]) : null;
  }

  /**
   * Delete GitOps config
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM gitops_configs WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Sync History ====================

  /**
   * Create sync status record
   */
  async createSyncStatus(
    input: Omit<import('../services/config-mgmt/types').SyncStatus, 'completedAt'>
  ): Promise<import('../services/config-mgmt/types').SyncStatus> {
    const result = await this.pool.query(
      `INSERT INTO gitops_sync_history (
        id, gitops_config_id, status, items_synced, items_failed,
        started_at, error, drift_detected, drift_items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.id,
        input.gitOpsConfigId,
        input.status,
        input.itemsSynced,
        input.itemsFailed,
        input.startedAt,
        input.error || null,
        input.driftDetected,
        JSON.stringify(input.driftItems || []),
      ]
    );
    return this.mapRowToSyncStatus(result.rows[0]);
  }

  /**
   * Find sync history by config ID
   */
  async findSyncHistory(
    gitOpsConfigId: string,
    limit: number = 20
  ): Promise<import('../services/config-mgmt/types').SyncStatus[]> {
    const result = await this.pool.query(
      `SELECT * FROM gitops_sync_history
       WHERE gitops_config_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [gitOpsConfigId, limit]
    );
    return result.rows.map(row => this.mapRowToSyncStatus(row));
  }

  /**
   * Find latest sync status
   */
  async findLatestSyncStatus(
    gitOpsConfigId: string
  ): Promise<import('../services/config-mgmt/types').SyncStatus | null> {
    const result = await this.pool.query(
      `SELECT * FROM gitops_sync_history
       WHERE gitops_config_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [gitOpsConfigId]
    );
    return result.rows[0] ? this.mapRowToSyncStatus(result.rows[0]) : null;
  }

  // ==================== Mappers ====================

  private mapRowToConfig(row: GitOpsConfigRow): GitOpsConfig {
    return {
      id: row.id,
      repoUrl: row.repo_url,
      branch: row.branch,
      configPath: row.config_path,
      syncInterval: row.sync_interval,
      lastSync: row.last_sync,
      status: row.status as GitOpsStatus,
      syncDirection: row.sync_direction as SyncDirection,
      autoApply: row.auto_apply,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastError: row.last_error || undefined,
    };
  }

  private mapRowToSyncStatus(row: SyncStatusRow): import('../services/config-mgmt/types').SyncStatus {
    return {
      id: row.id,
      gitOpsConfigId: row.gitops_config_id,
      status: row.status as any,
      itemsSynced: row.items_synced,
      itemsFailed: row.items_failed,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      error: row.error || undefined,
      driftDetected: row.drift_detected,
      driftItems: row.drift_items || [],
    };
  }
}