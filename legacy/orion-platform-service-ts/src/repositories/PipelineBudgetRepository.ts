/**
 * PipelineBudgetRepository — Data access layer for pipeline_budgets table
 *
 * Provides CRUD and usage-tracking operations for Pipeline Budget Management.
 */

import { BaseRepository } from '../db/base-repository';

export interface PipelineBudgetEntity {
  id: string;
  pipelineId: string;
  maxCost: number;
  currentCost: number;
  currency: string;
  blocked: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PipelineBudgetRepository extends BaseRepository<PipelineBudgetEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
  ) {
    super(db, 'pipeline_budgets');
  }

  /**
   * Find budget by pipeline_id
   */
  async findByPipelineId(pipelineId: string): Promise<PipelineBudgetEntity | undefined> {
    const result = await this.db.query(
      'SELECT * FROM pipeline_budgets WHERE pipeline_id = $1',
      [pipelineId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update current_cost by pipeline_id
   */
  async updateCost(pipelineId: string, newCost: number): Promise<PipelineBudgetEntity | undefined> {
    const result = await this.db.query(
      'UPDATE pipeline_budgets SET current_cost = $1, updated_at = NOW() WHERE pipeline_id = $2 RETURNING *',
      [newCost, pipelineId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update blocked flag by pipeline_id
   */
  async updateBlocked(pipelineId: string, blocked: boolean): Promise<PipelineBudgetEntity | undefined> {
    const result = await this.db.query(
      'UPDATE pipeline_budgets SET blocked = $1, updated_at = NOW() WHERE pipeline_id = $2 RETURNING *',
      [blocked, pipelineId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Upsert: create or update max_cost and reset blocked
   */
  async upsert(
    pipelineId: string,
    maxCost: number,
    currency: string,
    createdBy: string,
  ): Promise<PipelineBudgetEntity> {
    const result = await this.db.query(
      `INSERT INTO pipeline_budgets (id, pipeline_id, max_cost, current_cost, currency, blocked, created_by)
       VALUES ($1, $2, $3, 0, $4, false, $5)
       ON CONFLICT (pipeline_id)
       DO UPDATE SET max_cost = EXCLUDED.max_cost, blocked = false, updated_at = NOW(), created_by = EXCLUDED.created_by
       RETURNING *`,
      [`budget-${pipelineId}`, pipelineId, maxCost, currency, createdBy],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Delete by pipeline_id
   */
  async deleteByPipelineId(pipelineId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM pipeline_budgets WHERE pipeline_id = $1',
      [pipelineId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): PipelineBudgetEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      maxCost: parseFloat(row.max_cost),
      currentCost: parseFloat(row.current_cost ?? 0),
      currency: row.currency,
      blocked: row.blocked,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
