/**
 * RBACRuleRepository - Persistent storage for pipeline RBAC rules
 *
 * Stores pipeline-level role assignments in PostgreSQL.
 */

import { BaseRepository, FindAllOptions } from '../db/base-repository';

export interface RBACRuleEntity {
  id: string;
  pipelineId: string;
  userId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export class RBACRuleRepository extends BaseRepository<RBACRuleEntity> {
  constructor(db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'pipeline_rbac_rules');
  }

  /**
   * Find all rules for a specific pipeline
   */
  async findByPipelineId(pipelineId: string): Promise<RBACRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_rbac_rules WHERE pipeline_id = $1 ORDER BY created_at ASC`,
      [pipelineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find a specific rule by pipeline and user
   */
  async findByPipelineAndUser(pipelineId: string, userId: string): Promise<RBACRuleEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM pipeline_rbac_rules WHERE pipeline_id = $1 AND user_id = $2`,
      [pipelineId, userId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Upsert a rule (insert or update)
   */
  async upsert(pipelineId: string, userId: string, role: string): Promise<void> {
    await this.db.query(
      `INSERT INTO pipeline_rbac_rules (id, pipeline_id, user_id, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (pipeline_id, user_id) DO UPDATE
         SET role = $4, updated_at = NOW()`,
      [`${pipelineId}:${userId}`, pipelineId, userId, role],
    );
  }

  /**
   * Delete a rule
   */
  async deleteByPipelineAndUser(pipelineId: string, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM pipeline_rbac_rules WHERE pipeline_id = $1 AND user_id = $2`,
      [pipelineId, userId],
    );
  }

  /**
   * Delete all rules for a pipeline
   */
  async deleteByPipelineId(pipelineId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM pipeline_rbac_rules WHERE pipeline_id = $1`,
      [pipelineId],
    );
  }

  protected mapRowToEntity(row: any): RBACRuleEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
