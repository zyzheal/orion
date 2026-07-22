import { BaseRepository } from '../db/base-repository';

export interface AlertDeduplicationGroupEntity {
  id: string;
  tenantId: string;
  alerts: Record<string, any>[];
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  suppressed: boolean;
  suppressionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AlertDeduplicationGroupRepository extends BaseRepository<AlertDeduplicationGroupEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_deduplication_groups');
  }

  async findByFingerprint(fingerprint: string): Promise<AlertDeduplicationGroupEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM alert_deduplication_groups WHERE id = $1`,
      [fingerprint],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async findByTenantId(tenantId: string, limit: number = 100): Promise<AlertDeduplicationGroupEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_deduplication_groups WHERE tenant_id = $1 ORDER BY last_occurrence DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActive(minCount?: number, startTime?: Date, endTime?: Date, limit: number = 100, offset: number = 0): Promise<AlertDeduplicationGroupEntity[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (minCount) {
      conditions.push(`count >= $${idx++}`);
      params.push(minCount);
    }
    if (startTime) {
      conditions.push(`last_occurrence >= $${idx++}`);
      params.push(startTime);
    }
    if (endTime) {
      conditions.push(`first_occurrence <= $${idx++}`);
      params.push(endTime);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await this.db.query(
      `SELECT * FROM alert_deduplication_groups ${whereClause}
       ORDER BY last_occurrence DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async incrementCount(fingerprint: string, alert: Record<string, any>, maxGroupSize: number): Promise<void> {
    await this.db.query(
      `UPDATE alert_deduplication_groups
       SET alerts = CASE
             WHEN jsonb_array_length(alerts) >= $2 THEN
               alerts || $3::jsonb
             ELSE
               alerts || $3::jsonb
           END,
           count = count + 1,
           last_occurrence = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [fingerprint, maxGroupSize, JSON.stringify(alert)],
    );
  }

  async deleteExpired(olderThan: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM alert_deduplication_groups WHERE last_occurrence < $1`,
      [olderThan],
    );
    return result.rowCount ?? 0;
  }

  async getStats(): Promise<{ totalGroups: number; totalAlerts: number }> {
    const result = await this.db.query(
      `SELECT COUNT(*) as total_groups, COALESCE(SUM(count), 0) as total_alerts FROM alert_deduplication_groups`,
    );
    const row = result.rows[0];
    return {
      totalGroups: parseInt(row.total_groups, 10),
      totalAlerts: parseInt(row.total_alerts, 10),
    };
  }

  async getTopFingerprints(limit: number = 10): Promise<Array<{ fingerprint: string; count: number }>> {
    const result = await this.db.query(
      `SELECT id as fingerprint, count FROM alert_deduplication_groups ORDER BY count DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row: any) => ({
      fingerprint: row.fingerprint,
      count: row.count,
    }));
  }

  protected mapRowToEntity(row: any): AlertDeduplicationGroupEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      alerts: row.alerts || [],
      count: row.count,
      firstOccurrence: row.first_occurrence,
      lastOccurrence: row.last_occurrence,
      suppressed: row.suppressed,
      suppressionReason: row.suppression_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
