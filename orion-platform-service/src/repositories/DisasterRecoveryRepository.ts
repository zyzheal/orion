import { OrionError, ErrorCode } from '../errors';
/**
 * DisasterRecoveryRepository - Database layer for Disaster Recovery operations
 *
 * Provides PostgreSQL persistence for disaster recovery configurations,
 * failover events, and drill records.
 */

export interface DRPlanRow {
  id: string;
  tenant_id: string;
  plan_name: string;
  rto_target: number;
  rpo_target: number;
  priority: string;
  status: string;
  services: Record<string, unknown>[];
  failover_strategy: string;
  backup_regions: string[];
  last_tested_at: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DRFailoverTestRow {
  id: string;
  tenant_id: string;
  plan_id: string;
  test_name: string;
  test_type: string;
  started_at: Date;
  completed_at: Date | null;
  actual_rto: number | null;
  actual_rpo: number | null;
  result: string;
  affected_services: string[];
  findings: string | null;
  created_by: string;
  created_at: Date;
}

export interface DRBackupConfigRow {
  id: string;
  tenant_id: string;
  source_type: string;
  source_id: string;
  backup_schedule: string;
  retention_days: number;
  storage_location: string;
  encryption: boolean;
  compression: string;
  last_backup_at: Date | null;
  last_backup_size: number;
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export class DisasterRecoveryRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    this.db = db;
  }

  // ==================== DR Plans (configurations) ====================

  async findAllPlans(tenantId: string): Promise<DRPlanRow[]> {
    const result = await this.db.query(
      `SELECT * FROM disaster_recovery_plans WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async findPlanById(tenantId: string, id: string): Promise<DRPlanRow | undefined> {
    const result = await this.db.query(
      `SELECT * FROM disaster_recovery_plans WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return result.rows[0];
  }

  async createPlan(input: {
    tenantId: string;
    planName: string;
    rtoTarget: number;
    rpoTarget: number;
    priority: string;
    status: string;
    services: Record<string, unknown>[];
    failoverStrategy: string;
    backupRegions: string[];
    createdBy: string;
  }): Promise<DRPlanRow> {
    const result = await this.db.query(
      `INSERT INTO disaster_recovery_plans
       (tenant_id, plan_name, rto_target, rpo_target, priority, status,
        services, failover_strategy, backup_regions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.tenantId,
        input.planName,
        input.rtoTarget,
        input.rpoTarget,
        input.priority,
        input.status,
        JSON.stringify(input.services),
        input.failoverStrategy,
        JSON.stringify(input.backupRegions),
        input.createdBy,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into disaster_recovery_plans returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return result.rows[0];
  }

  async updatePlan(
    tenantId: string,
    id: string,
    updates: Partial<{
      planName: string;
      rtoTarget: number;
      rpoTarget: number;
      priority: string;
      status: string;
      services: Record<string, unknown>[];
      failoverStrategy: string;
      backupRegions: string[];
    }>,
  ): Promise<DRPlanRow> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, { col: string; json: boolean }> = {
      planName: { col: 'plan_name', json: false },
      rtoTarget: { col: 'rto_target', json: false },
      rpoTarget: { col: 'rpo_target', json: false },
      priority: { col: 'priority', json: false },
      status: { col: 'status', json: false },
      services: { col: 'services', json: true },
      failoverStrategy: { col: 'failover_strategy', json: false },
      backupRegions: { col: 'backup_regions', json: true },
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const mapping = fieldMap[key];
      if (!mapping) continue;
      setClauses.push(`${mapping.col} = $${paramIndex}`);
      params.push(mapping.json ? JSON.stringify(value) : value);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new OrionError('Update requires at least one column', ErrorCode.OPERATION_FAILED);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const idParam = paramIndex;
    const tenantParam = paramIndex + 1;

    const query = `UPDATE disaster_recovery_plans SET ${setClauses.join(', ')} WHERE id = $${idParam} AND tenant_id = $${tenantParam} RETURNING *`;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new OrionError(`UPDATE on disaster_recovery_plans affected no rows (id: ${id})`, 'OPERATION_FAILED')
    }
    return result.rows[0];
  }

  async updateLastTested(tenantId: string, id: string, testedAt: Date): Promise<void> {
    await this.db.query(
      `UPDATE disaster_recovery_plans SET last_tested_at = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [testedAt, id, tenantId],
    );
  }

  async deletePlan(tenantId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM disaster_recovery_plans WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Failover Tests (events/drills) ====================

  async findAllFailoverTests(tenantId: string, planId?: string): Promise<DRFailoverTestRow[]> {
    let query = `SELECT * FROM dr_failover_tests WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];

    if (planId) {
      query += ` AND plan_id = $2`;
      params.push(planId);
    }

    query += ` ORDER BY started_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows;
  }

  async findFailoverTestById(tenantId: string, id: string): Promise<DRFailoverTestRow | undefined> {
    const result = await this.db.query(
      `SELECT * FROM dr_failover_tests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return result.rows[0];
  }

  async createFailoverTest(input: {
    tenantId: string;
    planId: string;
    testName: string;
    testType: string;
    affectedServices: string[];
    createdBy: string;
  }): Promise<DRFailoverTestRow> {
    const result = await this.db.query(
      `INSERT INTO dr_failover_tests
       (tenant_id, plan_id, test_name, test_type, affected_services, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.tenantId,
        input.planId,
        input.testName,
        input.testType,
        JSON.stringify(input.affectedServices),
        input.createdBy,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into dr_failover_tests returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return result.rows[0];
  }

  async completeFailoverTest(input: {
    tenantId: string;
    id: string;
    completedAt: Date;
    actualRto: number;
    actualRpo: number;
    result: string;
    findings?: string;
  }): Promise<DRFailoverTestRow> {
    const result = await this.db.query(
      `UPDATE dr_failover_tests
       SET completed_at = $1, actual_rto = $2, actual_rpo = $3, result = $4, findings = $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [
        input.completedAt,
        input.actualRto,
        input.actualRpo,
        input.result,
        input.findings || null,
        input.id,
        input.tenantId,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError(`UPDATE on dr_failover_tests affected no rows (id: ${input.id})`, 'OPERATION_FAILED')
    }
    return result.rows[0];
  }

  async deleteFailoverTest(tenantId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM dr_failover_tests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Backup Configs ====================

  async findAllBackupConfigs(tenantId: string): Promise<DRBackupConfigRow[]> {
    const result = await this.db.query(
      `SELECT * FROM backup_configs WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async findBackupConfigById(tenantId: string, id: string): Promise<DRBackupConfigRow | undefined> {
    const result = await this.db.query(
      `SELECT * FROM backup_configs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return result.rows[0];
  }

  async createBackupConfig(input: {
    tenantId: string;
    sourceType: string;
    sourceId: string;
    backupSchedule: string;
    retentionDays: number;
    storageLocation: string;
    encryption: boolean;
    compression: string;
    createdBy: string;
  }): Promise<DRBackupConfigRow> {
    const result = await this.db.query(
      `INSERT INTO backup_configs
       (tenant_id, source_type, source_id, backup_schedule, retention_days,
        storage_location, encryption, compression, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.tenantId,
        input.sourceType,
        input.sourceId,
        input.backupSchedule,
        input.retentionDays,
        input.storageLocation,
        input.encryption,
        input.compression,
        input.createdBy,
      ],
    );
    if (result.rows.length === 0) {
      throw new OrionError('INSERT into backup_configs returned no rows', ErrorCode.OPERATION_FAILED);
    }
    return result.rows[0];
  }

  async updateBackupConfig(
    tenantId: string,
    id: string,
    updates: Partial<{
      backupSchedule: string;
      retentionDays: number;
      storageLocation: string;
      encryption: boolean;
      compression: string;
      enabled: boolean;
    }>,
  ): Promise<DRBackupConfigRow> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      backupSchedule: 'backup_schedule',
      retentionDays: 'retention_days',
      storageLocation: 'storage_location',
      encryption: 'encryption',
      compression: 'compression',
      enabled: 'enabled',
    };

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const col = fieldMap[key];
      if (!col) continue;
      setClauses.push(`${col} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      throw new OrionError('Update requires at least one column', ErrorCode.OPERATION_FAILED);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const idParam = paramIndex;
    const tenantParam = paramIndex + 1;

    const query = `UPDATE backup_configs SET ${setClauses.join(', ')} WHERE id = $${idParam} AND tenant_id = $${tenantParam} RETURNING *`;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) {
      throw new OrionError(`UPDATE on backup_configs affected no rows (id: ${id})`, 'OPERATION_FAILED')
    }
    return result.rows[0];
  }

  async recordBackupComplete(
    tenantId: string,
    id: string,
    backupAt: Date,
    backupSize: number,
  ): Promise<void> {
    await this.db.query(
      `UPDATE backup_configs
       SET last_backup_at = $1, last_backup_size = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [backupAt, backupSize, id, tenantId],
    );
  }

  async deleteBackupConfig(tenantId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM backup_configs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
