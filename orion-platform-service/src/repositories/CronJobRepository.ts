/**
 * CronJobRepository
 * 定时任务数据访问层
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';

export interface CronJobEntity {
  id: string;
  name: string;
  schedule: string;
  handler: string;
  payload: Record<string, any>;
  enabled: boolean;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  nextRunAt: Date | null;
  createdAt: Date;
}

export class CronJobRepository extends BaseRepository<CronJobEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cron_jobs');
  }

  async findByName(name: string): Promise<CronJobEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cron_jobs WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findEnabled(): Promise<CronJobEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cron_jobs WHERE enabled = true ORDER BY next_run_at ASC NULLS LAST`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateLastRun(
    id: string,
    lastRunAt: Date,
    status: string,
    nextRunAt: Date,
  ): Promise<CronJobEntity> {
    const result = await this.db.query(
      `UPDATE cron_jobs SET last_run_at = $1, last_run_status = $2, next_run_at = $3, updated_at = NOW() WHERE id = $4 RETURNING *`,
      [lastRunAt, status, nextRunAt, id],
    );
    if (result.rows.length === 0) {
      throw new Error(`CronJob with id ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async list(options: FindAllOptions = {}): Promise<FindAllResult<CronJobEntity>> {
    return this.findAll(options);
  }

  protected mapRowToEntity(row: any): CronJobEntity {
    return {
      id: row.id,
      name: row.name,
      schedule: row.schedule,
      handler: row.handler,
      payload: row.payload ?? {},
      enabled: row.enabled ?? false,
      lastRunAt: row.last_run_at ?? null,
      lastRunStatus: row.last_run_status ?? null,
      nextRunAt: row.next_run_at ?? null,
      createdAt: row.created_at,
    };
  }
}