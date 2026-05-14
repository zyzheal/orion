/**
 * ConfigApprovalRepository - PostgreSQL persistence for config change requests
 *
 * Part of Sub-project F: Data Persistence (Task 2)
 * Maps config_change_requests table rows to ConfigChangeRequest domain objects.
 * Approval records are stored as JSONB within the parent row.
 */

import { DatabasePool } from '../services/database';
import {
  ConfigChangeRequest,
  ApprovalRecord,
  ConfigEnvironment,
  ConfigChangeStatus,
  ApprovalStatus,
} from '../services/config-mgmt/types';

export interface CreateConfigChangeInput {
  id: string;
  configId: string;
  configKey: string;
  environment: ConfigEnvironment;
  oldValue: string;
  newValue: string;
  reason: string;
  requester: string;
  requiredApprovals?: number;
}

export interface UpdateConfigChangeInput {
  status?: ConfigChangeStatus;
  approvals?: ApprovalRecord[];
  appliedAt?: Date;
  appliedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
}

export class ConfigApprovalRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Insert a new config change request.
   */
  async create(input: CreateConfigChangeInput): Promise<ConfigChangeRequest> {
    const now = new Date();
    const result = await this.pool.query(
      `INSERT INTO config_change_requests (
        id, config_id, config_key, environment, old_value, new_value,
        reason, requester, status, approvals, required_approvals,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        input.id,
        input.configId,
        input.configKey,
        input.environment,
        input.oldValue,
        input.newValue,
        input.reason,
        input.requester,
        'pending',
        JSON.stringify([]),
        input.requiredApprovals ?? 1,
        now,
        now,
      ]
    );
    return this.rowToChangeRequest(result.rows[0]);
  }

  /**
   * Find a change request by ID.
   */
  async findById(id: string): Promise<ConfigChangeRequest | null> {
    const row = (await this.pool.query(
      'SELECT * FROM config_change_requests WHERE id = $1',
      [id]
    )).rows[0];
    return row ? this.rowToChangeRequest(row) : null;
  }

  /**
   * Find change requests filtered by various criteria.
   */
  async findMany(options?: {
    status?: string;
    configId?: string;
    requester?: string;
    environment?: string;
  }): Promise<ConfigChangeRequest[]> {
    let query = 'SELECT * FROM config_change_requests WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (options?.status) {
      query += ` AND status = $${idx++}`;
      params.push(options.status);
    }
    if (options?.configId) {
      query += ` AND config_id = $${idx++}`;
      params.push(options.configId);
    }
    if (options?.requester) {
      query += ` AND requester = $${idx++}`;
      params.push(options.requester);
    }
    if (options?.environment) {
      query += ` AND environment = $${idx++}`;
      params.push(options.environment);
    }

    query += ' ORDER BY created_at DESC';

    const rows = (await this.pool.query(query, params)).rows;
    return rows.map(r => this.rowToChangeRequest(r));
  }

  /**
   * Find all change requests for a config (audit trail).
   */
  async findByConfig(configId: string): Promise<ConfigChangeRequest[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM config_change_requests WHERE config_id = $1 ORDER BY created_at DESC',
      [configId]
    )).rows;
    return rows.map(r => this.rowToChangeRequest(r));
  }

  /**
   * Update a change request with partial input.
   */
  async update(id: string, input: UpdateConfigChangeInput): Promise<ConfigChangeRequest | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const add = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (input.status !== undefined) add('status', input.status);
    if (input.approvals !== undefined) add('approvals', JSON.stringify(input.approvals));
    if (input.appliedAt !== undefined) add('applied_at', input.appliedAt);
    if (input.appliedBy !== undefined) add('applied_by', input.appliedBy);
    if (input.approvedAt !== undefined) add('approved_at', input.approvedAt);
    if (input.approvedBy !== undefined) add('approved_by', input.approvedBy);

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = NOW()');
    params.push(id);

    const result = await this.pool.query(
      `UPDATE config_change_requests SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ? this.rowToChangeRequest(result.rows[0]) : null;
  }

  /**
   * Delete a change request by ID.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM config_change_requests WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Map a database row to a ConfigChangeRequest domain object.
   */
  private rowToChangeRequest(row: any): ConfigChangeRequest {
    return {
      id: row.id,
      configId: row.config_id,
      configKey: row.config_key,
      environment: row.environment as ConfigEnvironment,
      oldValue: row.old_value,
      newValue: row.new_value,
      reason: row.reason,
      requester: row.requester,
      status: row.status as ConfigChangeStatus,
      approvals: (row.approvals || []) as ApprovalRecord[],
      requiredApprovals: row.required_approvals,
      appliedAt: row.applied_at,
      appliedBy: row.applied_by,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as unknown as ConfigChangeRequest;
  }
}
