/**
 * ScmTriggerRuleRepository - PostgreSQL persistence for SCM pipeline trigger rules.
 *
 * Trigger rules define which SCM events (push, pull_request) match which pipelines.
 * Unlike the ephemeral webhook events, these rules are long-lived configuration
 * that must survive service restarts.
 *
 * Persistence strategy:
 * - On setTriggerRules(): truncate existing DB rows and bulk-insert fresh set
 * - On addTriggerRule(): fire-and-forget INSERT (non-blocking)
 * - On startup/loadTriggerRulesFromDb(): hydrate in-memory rules from DB
 * - Writes are fire-and-forget with .catch() — DB unavailable means in-memory-only
 * - Reads try memory first (instant), then fall back to DB on load
 */

import { BaseRepository } from '../db/base-repository';

export interface ScmTriggerRuleEntity {
  id: string;
  pipelineId: string;
  repositoryPattern: string;
  branchPattern: string;
  events: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class ScmTriggerRuleRepository extends BaseRepository<ScmTriggerRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'scm_trigger_rules');
  }

  /**
   * Find all trigger rules in the database.
   */
  async findAllRules(): Promise<ScmTriggerRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scm_trigger_rules ORDER BY created_at ASC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find rules by pipeline ID.
   */
  async findByPipelineId(pipelineId: string): Promise<ScmTriggerRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM scm_trigger_rules WHERE pipeline_id = $1 ORDER BY created_at ASC`,
      [pipelineId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Bulk upsert: delete all existing rules and insert fresh set.
   * Used by setTriggerRules() for atomic replacement.
   */
  async bulkUpsert(rules: Omit<ScmTriggerRuleEntity, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    // Delete all existing
    await this.db.query(`DELETE FROM scm_trigger_rules`);

    // Insert fresh set
    for (const rule of rules) {
      const events = rule.events || [];
      await this.db.query(
        `INSERT INTO scm_trigger_rules (pipeline_id, repository_pattern, branch_pattern, events)
         VALUES ($1, $2, $3, $4)`,
        [rule.pipelineId, rule.repositoryPattern, rule.branchPattern, events],
      );
    }
  }

  /**
   * Add a single trigger rule (fire-and-forget in service layer).
   */
  async addRule(rule: Omit<ScmTriggerRuleEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const events = rule.events || [];
    await this.db.query(
      `INSERT INTO scm_trigger_rules (pipeline_id, repository_pattern, branch_pattern, events)
       VALUES ($1, $2, $3, $4)`,
      [rule.pipelineId, rule.repositoryPattern, rule.branchPattern, events],
    );
  }

  protected mapRowToEntity(row: any): ScmTriggerRuleEntity {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      repositoryPattern: row.repository_pattern,
      branchPattern: row.branch_pattern,
      events: row.events || [],
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
