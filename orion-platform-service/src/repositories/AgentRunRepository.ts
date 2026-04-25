/**
 * AgentRunRepository - Database layer for Agent Run, Decision, and Approval operations
 *
 * Persists agent runs, decision logs, and approval records to PostgreSQL.
 */

import { DatabasePool } from '../services/database';
import { AgentRun, AgentRunStatus, AgentDecision, AgentApproval, AgentAction } from '../models/AgentRun';

export interface AgentRunEntity {
  id: string;
  agent_profile_id: string;
  trigger_payload: Record<string, any>;
  status: string;
  current_step: number;
  total_steps: number;
  result: Record<string, any> | null;
  error: string | null;
  started_at: Date;
  completed_at: Date | null;
  timeout_at: Date;
  tenant_id: string | null;
}

export class AgentRunRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Create a new agent run record
   */
  async createRun(
    agentProfileId: string,
    triggerPayload: Record<string, any>,
    totalSteps: number,
    timeoutAt: Date,
    tenantId?: string
  ): Promise<AgentRunEntity> {
    const result = await this.pool.query(
      `INSERT INTO agent_runs (agent_profile_id, trigger_payload, status, total_steps, timeout_at, tenant_id)
       VALUES ($1, $2, 'running', $3, $4, $5)
       RETURNING *`,
      [agentProfileId, JSON.stringify(triggerPayload), totalSteps, timeoutAt, tenantId || null]
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a run by ID
   */
  async findRunById(id: string): Promise<AgentRunEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM agent_runs WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * List runs with optional filters
   */
  async listRuns(options?: {
    agentProfileId?: string;
    statusFilter?: AgentRunStatus;
  }): Promise<AgentRunEntity[]> {
    let query = 'SELECT * FROM agent_runs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.agentProfileId) {
      query += ` AND agent_profile_id = $${paramIndex++}`;
      params.push(options.agentProfileId);
    }
    if (options?.statusFilter) {
      query += ` AND status = $${paramIndex++}`;
      params.push(options.statusFilter);
    }

    query += ' ORDER BY started_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Update run status to completed
   */
  async completeRun(id: string, result: Record<string, any>): Promise<AgentRunEntity | null> {
    const row = await this.pool.query(
      `UPDATE agent_runs SET status = 'completed', result = $1, completed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(result), id]
    );
    return row.rows[0] ? this.mapRowToEntity(row.rows[0]) : null;
  }

  /**
   * Update run status to failed
   */
  async failRun(id: string, error: string): Promise<AgentRunEntity | null> {
    const row = await this.pool.query(
      `UPDATE agent_runs SET status = 'failed', error = $1, completed_at = NOW()
       WHERE id = $2 RETURNING *`,
      [error, id]
    );
    return row.rows[0] ? this.mapRowToEntity(row.rows[0]) : null;
  }

  /**
   * Update run status to cancelled
   */
  async cancelRun(id: string): Promise<AgentRunEntity | null> {
    const row = await this.pool.query(
      `UPDATE agent_runs SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return row.rows[0] ? this.mapRowToEntity(row.rows[0]) : null;
  }

  /**
   * Update current step
   */
  async updateStep(id: string, stepNumber: number): Promise<void> {
    await this.pool.query(
      'UPDATE agent_runs SET current_step = $1 WHERE id = $2',
      [stepNumber, id]
    );
  }

  // ==================== Decision Operations ====================

  async createDecision(
    runId: string,
    agentId: string,
    stepNumber: number,
    action: AgentAction,
    actionInput: Record<string, any>,
    reasoning: string
  ): Promise<{ id: string }> {
    const result = await this.pool.query(
      `INSERT INTO agent_decisions (run_id, agent_id, step_number, action, action_input, reasoning)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [runId, agentId, stepNumber, action, JSON.stringify(actionInput), reasoning]
    );
    return { id: result.rows[0].id };
  }

  async updateDecision(
    decisionId: string,
    updates: {
      toolResult?: Record<string, any>;
      actionOutput?: Record<string, any>;
      error?: string;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.toolResult !== undefined) {
      fields.push(`tool_result = $${idx++}`);
      values.push(JSON.stringify(updates.toolResult));
    }
    if (updates.actionOutput !== undefined) {
      fields.push(`action_output = $${idx++}`);
      values.push(JSON.stringify(updates.actionOutput));
    }
    if (updates.error !== undefined) {
      fields.push(`error = $${idx++}`);
      values.push(updates.error);
    }

    if (fields.length > 0) {
      values.push(decisionId);
      await this.pool.query(
        `UPDATE agent_decisions SET ${fields.join(', ')} WHERE id = $${idx}`,
        values
      );
    }
  }

  async getDecisionsByRunId(runId: string): Promise<Array<{
    id: string;
    run_id: string;
    agent_id: string;
    step_number: number;
    action: string;
    action_input: Record<string, any>;
    action_output: Record<string, any> | null;
    reasoning: string;
    tool_result: Record<string, any> | null;
    error: string | null;
    created_at: Date;
  }>> {
    const result = await this.pool.query(
      'SELECT * FROM agent_decisions WHERE run_id = $1 ORDER BY step_number ASC',
      [runId]
    );
    return result.rows;
  }

  // ==================== Approval Operations ====================

  async createApproval(
    runId: string,
    agentId: string,
    action: AgentAction,
    actionInput: Record<string, any>,
    reason: string
  ): Promise<{ id: string }> {
    const result = await this.pool.query(
      `INSERT INTO agent_approvals (run_id, agent_id, action, action_input, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [runId, agentId, action, JSON.stringify(actionInput), reason]
    );
    return { id: result.rows[0].id };
  }

  private mapRowToEntity(row: any): AgentRunEntity {
    return {
      id: row.id,
      agent_profile_id: row.agent_profile_id,
      trigger_payload: typeof row.trigger_payload === 'string' ? JSON.parse(row.trigger_payload) : (row.trigger_payload || {}),
      status: row.status,
      current_step: row.current_step ?? 0,
      total_steps: row.total_steps,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
      error: row.error,
      started_at: row.started_at,
      completed_at: row.completed_at,
      timeout_at: row.timeout_at,
      tenant_id: row.tenant_id,
    };
  }
}
