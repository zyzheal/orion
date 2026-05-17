import type { LLMTrace } from '../services/llm-trace/LLMTraceService.js';

export interface DailyStatsRow {
  total_requests: number;
  total_tokens: number;
  total_cost: string;
  avg_duration_ms: number;
  success_rate: string;
}

export class LLMTraceRepository {
  constructor(
    private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }> },
  ) {}

  async create(trace: Omit<LLMTrace, 'requestStartedAt'> & { requestStartedAt: Date }): Promise<LLMTrace> {
    const result = await this.pool.query(
      `INSERT INTO llm_traces
       (trace_id, tenant_id, user_id, scenario_id, provider_id, model_id,
        prompt_content, prompt_hash, input_tokens, output_tokens, total_tokens,
        input_cost, output_cost, total_cost, currency, status,
        request_started_at, parent_trace_id, request_context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        trace.traceId, trace.tenantId, trace.userId ?? null, trace.scenarioId ?? null,
        trace.providerId ?? null, trace.modelId, trace.promptContent ?? null,
        trace.promptHash ?? null, trace.inputTokens, trace.outputTokens, trace.totalTokens,
        trace.inputCost, trace.outputCost, trace.totalCost, trace.currency,
        trace.status, trace.requestStartedAt, trace.parentTraceId ?? null,
        trace.requestContext ? JSON.stringify(trace.requestContext) : '{}',
      ],
    );
    return this.rowToTrace(result.rows[0]);
  }

  async update(traceId: string, updates: Partial<LLMTrace>): Promise<LLMTrace | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    const exclude = new Set(['traceId', 'tenantId', 'createdAt']);

    for (const key of Object.keys(updates)) {
      if (exclude.has(key)) continue;
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      values.push((updates as any)[key]);
      setClauses.push(`${col} = $${values.length}`);
    }

    if (setClauses.length === 0) return null;
    values.push(traceId);

    const result = await this.pool.query(
      `UPDATE llm_traces SET ${setClauses.join(', ')} WHERE trace_id = $${values.length} RETURNING *`,
      values,
    );
    return result.rows[0] ? this.rowToTrace(result.rows[0]) : null;
  }

  async findByTraceId(traceId: string): Promise<LLMTrace | null> {
    const result = await this.pool.query('SELECT * FROM llm_traces WHERE trace_id = $1', [traceId]);
    return result.rows[0] ? this.rowToTrace(result.rows[0]) : null;
  }

  async findByTenant(tenantId: number): Promise<LLMTrace[]> {
    const result = await this.pool.query('SELECT * FROM llm_traces WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
    return result.rows.map(r => this.rowToTrace(r));
  }

  async findByScenario(scenarioId: string): Promise<LLMTrace[]> {
    const result = await this.pool.query('SELECT * FROM llm_traces WHERE scenario_id = $1 ORDER BY created_at DESC', [scenarioId]);
    return result.rows.map(r => this.rowToTrace(r));
  }

  async getDailyStats(tenantId: number, dateStr: string): Promise<DailyStatsRow> {
    const result = await this.pool.query(
      `SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
        CASE WHEN COUNT(*) > 0
          THEN SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::decimal / COUNT(*)
          ELSE 1 END as success_rate
       FROM llm_traces
       WHERE tenant_id = $1
         AND DATE(request_started_at) = $2
         AND status != 'pending'`,
      [tenantId, dateStr],
    );
    return result.rows[0];
  }

  private rowToTrace(row: any): LLMTrace {
    return {
      traceId: row.trace_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      scenarioId: row.scenario_id,
      providerId: row.provider_id,
      modelId: row.model_id,
      promptContent: row.prompt_content,
      promptHash: row.prompt_hash,
      outputContent: row.output_content,
      outputHash: row.output_hash,
      inputTokens: row.input_tokens ?? 0,
      outputTokens: row.output_tokens ?? 0,
      totalTokens: row.total_tokens ?? 0,
      inputCost: Number(row.input_cost ?? 0),
      outputCost: Number(row.output_cost ?? 0),
      totalCost: Number(row.total_cost ?? 0),
      currency: row.currency ?? 'CNY',
      status: row.status ?? 'pending',
      requestStartedAt: new Date(row.request_started_at),
      requestCompletedAt: row.request_completed_at ? new Date(row.request_completed_at) : undefined,
      durationMs: row.duration_ms,
      parentTraceId: row.parent_trace_id,
      errorMessage: row.error_message,
      requestContext: row.request_context ? (typeof row.request_context === 'string' ? JSON.parse(row.request_context) : row.request_context) : undefined,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : undefined,
    };
  }
}
