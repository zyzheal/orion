/**
 * AgentAuditLogRepository - Database layer for agent audit log persistence
 *
 * Persists agent execution audit logs to PostgreSQL.
 * Used by BaseAgent for fire-and-forget audit log writes
 * and load-based reads with in-memory fallback.
 */

export interface AgentAuditLogEntity {
  id: string;
  agent_id: string;
  agent_type: string | null;
  action: string;
  status: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number;
  tenant_id: string | null;
  user_id: string | null;
  trace_id: string | null;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  created_at: Date;
}

export class AgentAuditLogRepository {
  private db: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  };

  constructor(db: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
  }) {
    this.db = db;
  }

  /**
   * Insert a single audit log entry (fire-and-forget, errors swallowed).
   */
  async append(log: {
    agentId: string;
    agentType?: string;
    action?: string;
    status: string;
    inputData?: unknown;
    outputData?: unknown;
    errorMessage?: string;
    durationMs: number;
    tenantId?: string;
    userId?: string;
    traceId?: string;
    tokensInput?: number;
    tokensOutput?: number;
    tokensTotal?: number;
  }): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO agent_audit_logs
          (agent_id, agent_type, action, status, input_data, output_data, error_message,
           duration_ms, tenant_id, user_id, trace_id, tokens_input, tokens_output, tokens_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid, $10, $11, $12, $13, $14)`,
        [
          log.agentId,
          log.agentType || null,
          log.action || 'execute',
          log.status,
          log.inputData != null ? JSON.stringify(log.inputData) : null,
          log.outputData != null ? JSON.stringify(log.outputData) : null,
          log.errorMessage || null,
          log.durationMs,
          log.tenantId || null,
          log.userId || null,
          log.traceId || null,
          log.tokensInput ?? 0,
          log.tokensOutput ?? 0,
          log.tokensTotal ?? 0,
        ],
      );
    } catch (_err) {
      // Fire-and-forget: audit log failures must never break the agent execution.
    }
  }

  /**
   * Get recent audit logs for an agent, ordered newest first.
   * Returns raw entities without in-memory filtering.
   */
  async findRecent(
    agentId: string,
    limit: number,
  ): Promise<AgentAuditLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_audit_logs
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [agentId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get the last N audit logs overall (cross-agent).
   */
  async findLast(limit: number): Promise<AgentAuditLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_audit_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  private mapRowToEntity(row: any): AgentAuditLogEntity {
    return {
      id: row.id,
      agent_id: row.agent_id,
      agent_type: row.agent_type,
      action: row.action,
      status: row.status,
      input_data: row.input_data ? JSON.parse(row.input_data) : null,
      output_data: row.output_data ? JSON.parse(row.output_data) : null,
      error_message: row.error_message,
      duration_ms: Number(row.duration_ms) || 0,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      trace_id: row.trace_id,
      tokens_input: Number(row.tokens_input) || 0,
      tokens_output: Number(row.tokens_output) || 0,
      tokens_total: Number(row.tokens_total) || 0,
      created_at: row.created_at,
    };
  }
}
