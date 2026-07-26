// orion-ai-svc/src/services/ThreatMonitor.ts

import { getPool } from '../utils/database';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type ThreatType = 'prompt_injection' | 'data_leak' | 'model_dos' | 'unauthorized_access' | 'hallucination';

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  level: ThreatLevel;
  type: ThreatType;
  description: string;
  source: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export class ThreatMonitor {
  async recordThreat(event: Omit<ThreatEvent, 'id' | 'timestamp'>): Promise<ThreatEvent> {
    const pool = getPool();
    const id = crypto.randomUUID();
    const timestamp = new Date();

    await pool.query(
      `INSERT INTO ai_security_events (id, timestamp, level, type, description, source, details, resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, timestamp, event.level, event.type, event.description, event.source, JSON.stringify(event.details), false]
    );

    return { ...event, id, timestamp };
  }

  async getThreats(
    startDate: Date,
    endDate: Date,
    level?: ThreatLevel,
    resolved?: boolean
  ): Promise<ThreatEvent[]> {
    const pool = getPool();
    let query = 'SELECT * FROM ai_security_events WHERE timestamp >= $1 AND timestamp <= $2';
    const params: unknown[] = [startDate, endDate];
    let paramIndex = 3;

    if (level) {
      query += ` AND level = $${paramIndex++}`;
      params.push(level);
    }
    if (resolved !== undefined) {
      query += ` AND resolved = $${paramIndex++}`;
      params.push(resolved);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, params);
    return result.rows.map((row) => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      timestamp: new Date(row.timestamp),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    }));
  }

  async resolveThreat(id: string, resolvedBy: string): Promise<boolean> {
    const pool = getPool();
    await pool.query(
      'UPDATE ai_security_events SET resolved = true, resolved_at = $1, resolved_by = $2 WHERE id = $3',
      [new Date(), resolvedBy, id]
    );
    return true;
  }

  async getThreatStats(startDate: Date, endDate: Date): Promise<{
    total: number;
    byLevel: Record<ThreatLevel, number>;
    byType: Record<ThreatType, number>;
    resolved: number;
  }> {
    const pool = getPool();

    const totalResult = await pool.query(
      'SELECT COUNT(*) as count FROM ai_security_events WHERE timestamp >= $1 AND timestamp <= $2',
      [startDate, endDate]
    );

    const levelResult = await pool.query(
      `SELECT level, COUNT(*) as count FROM ai_security_events
       WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY level`,
      [startDate, endDate]
    );

    const typeResult = await pool.query(
      `SELECT type, COUNT(*) as count FROM ai_security_events
       WHERE timestamp >= $1 AND timestamp <= $2 GROUP BY type`,
      [startDate, endDate]
    );

    const resolvedResult = await pool.query(
      `SELECT COUNT(*) as count FROM ai_security_events
       WHERE timestamp >= $1 AND timestamp <= $2 AND resolved = true`,
      [startDate, endDate]
    );

    const byLevel: Record<ThreatLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const row of levelResult.rows) {
      const level = row.level as ThreatLevel;
      if (level in byLevel) {
        byLevel[level] = parseInt(row.count);
      }
    }

    const byType: Record<ThreatType, number> = {
      prompt_injection: 0,
      data_leak: 0,
      model_dos: 0,
      unauthorized_access: 0,
      hallucination: 0,
    };
    for (const row of typeResult.rows) {
      const type = row.type as ThreatType;
      if (type in byType) {
        byType[type] = parseInt(row.count);
      }
    }

    return {
      total: parseInt(totalResult.rows[0].count),
      byLevel,
      byType,
      resolved: parseInt(resolvedResult.rows[0].count),
    };
  }

  async getRecentThreats(limit = 20): Promise<ThreatEvent[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM ai_security_events ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    return result.rows.map((row) => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      timestamp: new Date(row.timestamp),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    }));
  }
}

export const threatMonitor = new ThreatMonitor();
