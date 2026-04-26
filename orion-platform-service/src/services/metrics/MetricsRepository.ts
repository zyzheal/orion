/**
 * MetricsRepository - Database layer for Metrics operations
 */
import { DatabasePool } from '../database';

export interface Metric {
  id: string;
  tenant_id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export class MetricsRepository {
  private pool: DatabasePool;
  constructor(pool: DatabasePool) { this.pool = pool; }

  async record(tenantId: string, name: string, value: number, unit: string): Promise<Metric> {
    const result = await this.pool.query(
      'INSERT INTO metrics (tenant_id, name, value, unit, timestamp) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
      [tenantId, name, value, unit]
    );
    return result.rows[0];
  }

  async query(tenantId: string, name: string, startTime: Date, endTime: Date): Promise<Metric[]> {
    return (await this.pool.query(
      'SELECT * FROM metrics WHERE tenant_id = $1 AND name = $2 AND timestamp >= $3 AND timestamp <= $4 ORDER BY timestamp DESC',
      [tenantId, name, startTime, endTime]
    )).rows;
  }

  async aggregate(tenantId: string, name: string, startTime: Date, endTime: Date): Promise<{ avg: number; min: number; max: number; count: number }> {
    const result = await this.pool.query(
      'SELECT AVG(value) as avg, MIN(value) as min, MAX(value) as max, COUNT(*) as count FROM metrics WHERE tenant_id = $1 AND name = $2 AND timestamp >= $3 AND timestamp <= $4',
      [tenantId, name, startTime, endTime]
    );
    return result.rows[0];
  }
}