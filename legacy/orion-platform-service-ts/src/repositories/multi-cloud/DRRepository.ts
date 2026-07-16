/**
 * DRRepository - Cross-zone disaster recovery and DR test results
 *
 * Handles CRUD for:
 * - Cross-zone DR configurations (cross_zone_dr table)
 * - DR test results (dr_test_results table)
 */

import { OrionError, ErrorCode } from '../../errors';

// =============================================================================
// Entity Types
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

// =============================================================================
// DRRepository
// =============================================================================

export class DRRepository {
  constructor(
    private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {}

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

  // ==================== Converters ====================

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
}
