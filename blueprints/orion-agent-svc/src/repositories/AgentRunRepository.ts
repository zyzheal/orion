/**
 * AgentRunRepository - PostgreSQL data access for AgentRun
 */

export interface AgentRunEntity {
  id: string;
  agent_profile_id: string;
  trigger_payload: Record<string, unknown>;
  status: string;
  current_step: number;
  total_steps: number;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: Date;
  completed_at: Date | null;
  timeout_at: Date;
  tenant_id: string | null;
}

export interface AgentDecisionEntity {
  id: string;
  run_id: string;
  agent_id: string;
  step_number: number;
  action: string;
  action_input: Record<string, unknown>;
  action_output: Record<string, unknown> | null;
  reasoning: string;
  tool_result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
}

export class AgentRunRepository {
  private db: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async createRun(
    agentProfileId: string,
    triggerPayload: Record<string, unknown>,
    totalSteps: number,
    timeoutAt: Date,
    tenantId?: string,
  ): Promise<AgentRunEntity> {
    const result = await this.db.query(
      `INSERT INTO agent_runs (agent_profile_id, trigger_payload, status, current_step, total_steps, timeout_at, tenant_id, started_at)
       VALUES ($1, $2, 'running', 0, $3, $4, $5, NOW())
       RETURNING *`,
      [agentProfileId, JSON.stringify(triggerPayload), totalSteps, timeoutAt, tenantId || null],
    );
    return this.mapRunRow(result.rows[0]);
  }

  async findRunById(id: string): Promise<AgentRunEntity | null> {
    const result = await this.db.query('SELECT * FROM agent_runs WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRunRow(result.rows[0]);
  }

  async listRuns(options?: { agentProfileId?: string; statusFilter?: string }): Promise<AgentRunEntity[]> {
    let query = 'SELECT * FROM agent_runs';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options?.agentProfileId) {
      conditions.push(`agent_profile_id = $${params.length + 1}`);
      params.push(options.agentProfileId);
    }
    if (options?.statusFilter) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.statusFilter);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY started_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRunRow(row));
  }

  async cancelRun(id: string): Promise<AgentRunEntity | null> {
    const result = await this.db.query(
      "UPDATE agent_runs SET status = 'cancelled', completed_at = NOW() WHERE id = $1 AND status = 'running' RETURNING *",
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRunRow(result.rows[0]);
  }

  async completeRun(id: string, result: Record<string, unknown>): Promise<AgentRunEntity | null> {
    const res = await this.db.query(
      "UPDATE agent_runs SET status = 'completed', result = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [JSON.stringify(result), id],
    );
    if (res.rows.length === 0) return null;
    return this.mapRunRow(res.rows[0]);
  }

  async failRun(id: string, error: string): Promise<AgentRunEntity | null> {
    const result = await this.db.query(
      "UPDATE agent_runs SET status = 'failed', error = $1, completed_at = NOW() WHERE id = $2 RETURNING *",
      [error, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRunRow(result.rows[0]);
  }

  async updateStep(id: string, stepNumber: number): Promise<void> {
    await this.db.query(
      'UPDATE agent_runs SET current_step = $1 WHERE id = $2',
      [stepNumber, id],
    );
  }

  async createDecision(
    runId: string,
    agentId: string,
    stepNumber: number,
    action: string,
    actionInput: Record<string, unknown>,
    reasoning: string,
  ): Promise<AgentDecisionEntity> {
    const result = await this.db.query(
      `INSERT INTO agent_decisions (run_id, agent_id, step_number, action, action_input, reasoning, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [runId, agentId, stepNumber, action, JSON.stringify(actionInput), reasoning],
    );
    return this.mapDecisionRow(result.rows[0]);
  }

  async updateDecision(id: string, updates: { toolResult?: Record<string, unknown>; actionOutput?: Record<string, unknown>; error?: string }): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.toolResult !== undefined) {
      sets.push(`tool_result = $${idx}`);
      values.push(JSON.stringify(updates.toolResult));
      idx++;
    }
    if (updates.actionOutput !== undefined) {
      sets.push(`action_output = $${idx}`);
      values.push(JSON.stringify(updates.actionOutput));
      idx++;
    }
    if (updates.error !== undefined) {
      sets.push(`error = $${idx}`);
      values.push(updates.error);
      idx++;
    }

    if (sets.length > 0) {
      await this.db.query(
        `UPDATE agent_decisions SET ${sets.join(', ')} WHERE id = $${idx}`,
        [...values, id],
      );
    }
  }

  async getDecisionsByRunId(runId: string): Promise<AgentDecisionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM agent_decisions WHERE run_id = $1 ORDER BY step_number ASC',
      [runId],
    );
    return result.rows.map((row: any) => this.mapDecisionRow(row));
  }

  private mapRunRow(row: any): AgentRunEntity {
    return {
      id: row.id,
      agent_profile_id: row.agent_profile_id,
      trigger_payload: typeof row.trigger_payload === 'string' ? JSON.parse(row.trigger_payload) : row.trigger_payload || {},
      status: row.status,
      current_step: row.current_step,
      total_steps: row.total_steps,
      result: row.result ? (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) : null,
      error: row.error,
      started_at: new Date(row.started_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : null,
      timeout_at: new Date(row.timeout_at),
      tenant_id: row.tenant_id,
    };
  }

  private mapDecisionRow(row: any): AgentDecisionEntity {
    return {
      id: row.id,
      run_id: row.run_id,
      agent_id: row.agent_id,
      step_number: row.step_number,
      action: row.action,
      action_input: typeof row.action_input === 'string' ? JSON.parse(row.action_input) : row.action_input || {},
      action_output: row.action_output ? (typeof row.action_output === 'string' ? JSON.parse(row.action_output) : row.action_output) : null,
      reasoning: row.reasoning,
      tool_result: row.tool_result ? (typeof row.tool_result === 'string' ? JSON.parse(row.tool_result) : row.tool_result) : null,
      error: row.error,
      created_at: new Date(row.created_at),
    };
  }
}
