import { BaseRepository, FindAllResult } from '../db/base-repository';

export interface SLIMeasurementEntity {
  id: string;
  tenantId: string;
  sloId: string;
  sliValue: number;
  measuredAt: Date;
}

export class SLIMeasurementRepository extends BaseRepository<SLIMeasurementEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sli_measurement');
  }

  async findBySloId(sloId: string, limit: number = 100): Promise<SLIMeasurementEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sli_measurement WHERE slo_id = $1 ORDER BY measured_at DESC LIMIT $2`,
      [sloId, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findBySloIdAndRange(
    sloId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<SLIMeasurementEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sli_measurement WHERE slo_id = $1 AND measured_at BETWEEN $2 AND $3 ORDER BY measured_at ASC`,
      [sloId, startTime, endTime],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findLatestBySloId(sloId: string): Promise<SLIMeasurementEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM sli_measurement WHERE slo_id = $1 ORDER BY measured_at DESC LIMIT 1`,
      [sloId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteBySloId(sloId: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM sli_measurement WHERE slo_id = $1`,
      [sloId],
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): SLIMeasurementEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sloId: row.slo_id,
      sliValue: parseFloat(row.sli_value),
      measuredAt: row.measured_at,
    };
  }
}
