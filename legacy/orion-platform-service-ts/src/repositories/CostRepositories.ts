/**
 * CostRepositories - PostgreSQL data access for cost_records, alert_rules, model_pricing
 * P1-14 Fix: Replace Map-based storage with Repository pattern
 */

export interface CostRecordEntity {
  id: string;
  requestId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  tenantId?: string;
  projectId?: string;
  userId?: string;
  moduleType: string;
  timestamp: Date;
}

export interface AlertRuleEntity {
  id: string;
  name: string;
  budgetId?: string;
  condition: string;
  threshold: number;
  severity: string;
  recipients: string[];
  status: string;
  lastTriggered?: Date;
  createdAt: Date;
}

export interface ModelPricingEntity {
  id: string;
  provider: string;
  model: string;
  inputPricePer1k: number;
  outputPricePer1k: number;
  currency: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  notes?: string;
}

export interface CostRecordFindFilter {
  tenantId?: string;
  projectId?: string;
  userId?: string;
  model?: string;
  provider?: string;
  moduleType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface CostSummaryParams {
  tenantId?: string;
  projectId?: string;
  userId?: string;
  model?: string;
  provider?: string;
  moduleType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export class CostRecordRepository {
  private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.pool = pool;
  }

  async create(data: Omit<CostRecordEntity, 'id' | 'timestamp'>): Promise<CostRecordEntity> {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.pool.query(
      `INSERT INTO cost_records (id, request_id, model, provider, input_tokens, output_tokens, input_cost, output_cost, total_cost, tenant_id, project_id, user_id, module_type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, data.requestId, data.model, data.provider, data.inputTokens, data.outputTokens, data.inputCost, data.outputCost, data.totalCost, data.tenantId, data.projectId, data.userId, data.moduleType, now],
    );

    return { ...data, id, timestamp: now };
  }

  async createWithClient(data: Omit<CostRecordEntity, 'id' | 'timestamp'>, client: any): Promise<CostRecordEntity> {
    const now = new Date();
    const id = crypto.randomUUID();

    await client.query(
      `INSERT INTO cost_records (id, request_id, model, provider, input_tokens, output_tokens, input_cost, output_cost, total_cost, tenant_id, project_id, user_id, module_type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, data.requestId, data.model, data.provider, data.inputTokens, data.outputTokens, data.inputCost, data.outputCost, data.totalCost, data.tenantId, data.projectId, data.userId, data.moduleType, now],
    );

    return { ...data, id, timestamp: now };
  }

  async findAll(filter: CostRecordFindFilter = {}): Promise<CostRecordEntity[]> {
    let query = 'SELECT * FROM cost_records';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filter.tenantId) { params.push(filter.tenantId); conditions.push(`tenant_id = $${params.length}`); }
    if (filter.projectId) { params.push(filter.projectId); conditions.push(`project_id = $${params.length}`); }
    if (filter.userId) { params.push(filter.userId); conditions.push(`user_id = $${params.length}`); }
    if (filter.model) { params.push(filter.model); conditions.push(`model = $${params.length}`); }
    if (filter.provider) { params.push(filter.provider); conditions.push(`provider = $${params.length}`); }
    if (filter.moduleType) { params.push(filter.moduleType); conditions.push(`module_type = $${params.length}`); }
    if (filter.dateFrom) { params.push(filter.dateFrom); conditions.push(`timestamp >= $${params.length}`); }
    if (filter.dateTo) { params.push(filter.dateTo); conditions.push(`timestamp <= $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY timestamp DESC';

    if (filter.limit) {
      params.push(filter.limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows.map(this.rowToEntity);
  }

  async getSummary(params: CostSummaryParams): Promise<{
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalRequests: number;
    costByModel: Record<string, number>;
    costByProvider: Record<string, number>;
    costByTenant: Record<string, number>;
    costByModule: Record<string, number>;
  }> {
    let query = `SELECT
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COUNT(*) as total_requests
    FROM cost_records`;
    const queryParams: unknown[] = [];
    const conditions: string[] = [];

    if (params.tenantId) { queryParams.push(params.tenantId); conditions.push(`tenant_id = $${queryParams.length}`); }
    if (params.projectId) { queryParams.push(params.projectId); conditions.push(`project_id = $${queryParams.length}`); }
    if (params.userId) { queryParams.push(params.userId); conditions.push(`user_id = $${queryParams.length}`); }
    if (params.model) { queryParams.push(params.model); conditions.push(`model = $${queryParams.length}`); }
    if (params.provider) { queryParams.push(params.provider); conditions.push(`provider = $${queryParams.length}`); }
    if (params.moduleType) { queryParams.push(params.moduleType); conditions.push(`module_type = $${queryParams.length}`); }
    if (params.dateFrom) { queryParams.push(params.dateFrom); conditions.push(`timestamp >= $${queryParams.length}`); }
    if (params.dateTo) { queryParams.push(params.dateTo); conditions.push(`timestamp <= $${queryParams.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');

    const result = await this.pool.query(query, queryParams);
    const row = result.rows[0];
    if (!row) {
      return {
        totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0,
        costByModel: {}, costByProvider: {}, costByTenant: {}, costByModule: {},
      };
    }
    const summary = {
      totalCost: parseFloat(row.total_cost),
      totalInputTokens: parseInt(row.total_input_tokens, 10),
      totalOutputTokens: parseInt(row.total_output_tokens, 10),
      totalRequests: parseInt(row.total_requests, 10),
      costByModel: {} as Record<string, number>,
      costByProvider: {} as Record<string, number>,
      costByTenant: {} as Record<string, number>,
      costByModule: {} as Record<string, number>,
    };

    // GROUP BY queries for breakdown
    const groupByFields = [
      { field: 'model', target: summary.costByModel },
      { field: 'provider', target: summary.costByProvider },
      { field: 'tenant_id', target: summary.costByTenant },
      { field: 'module_type', target: summary.costByModule },
    ];

    for (const { field, target } of groupByFields) {
      let groupQuery = `SELECT ${field} as key, SUM(total_cost) as cost FROM cost_records`;
      const groupParams: unknown[] = [];
      const groupConditions: string[] = [];

      if (params.tenantId) { groupParams.push(params.tenantId); groupConditions.push(`tenant_id = $${groupParams.length}`); }
      if (params.projectId) { groupParams.push(params.projectId); groupConditions.push(`project_id = $${groupParams.length}`); }
      if (params.userId) { groupParams.push(params.userId); groupConditions.push(`user_id = $${groupParams.length}`); }
      if (params.model) { groupParams.push(params.model); groupConditions.push(`model = $${groupParams.length}`); }
      if (params.provider) { groupParams.push(params.provider); groupConditions.push(`provider = $${groupParams.length}`); }
      if (params.moduleType) { groupParams.push(params.moduleType); groupConditions.push(`module_type = $${groupParams.length}`); }
      if (params.dateFrom) { groupParams.push(params.dateFrom); groupConditions.push(`timestamp >= $${groupParams.length}`); }
      if (params.dateTo) { groupParams.push(params.dateTo); groupConditions.push(`timestamp <= $${groupParams.length}`); }

      if (groupConditions.length > 0) groupQuery += ' WHERE ' + groupConditions.join(' AND ');
      groupQuery += ` GROUP BY ${field} ORDER BY cost DESC`;

      const groupResult = await this.pool.query(groupQuery, groupParams);
      for (const row of groupResult.rows) {
        if (row.key) target[row.key] = parseFloat(row.cost);
      }
    }

    return summary;
  }

  private rowToEntity(row: any): CostRecordEntity {
    return {
      id: row.id,
      requestId: row.request_id,
      model: row.model,
      provider: row.provider,
      inputTokens: row.input_tokens ? parseInt(row.input_tokens, 10) : 0,
      outputTokens: row.output_tokens ? parseInt(row.output_tokens, 10) : 0,
      inputCost: row.input_cost ? parseFloat(row.input_cost) : 0,
      outputCost: row.output_cost ? parseFloat(row.output_cost) : 0,
      totalCost: row.total_cost ? parseFloat(row.total_cost) : 0,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      userId: row.user_id,
      moduleType: row.module_type,
      timestamp: row.timestamp,
    };
  }
}

export class AlertRuleRepository {
  private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.pool = pool;
  }

  async create(data: Omit<AlertRuleEntity, 'id' | 'createdAt'>): Promise<AlertRuleEntity> {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.pool.query(
      `INSERT INTO alert_rules (id, name, budget_id, condition, threshold, severity, recipients, status, last_triggered, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
      [id, data.name, data.budgetId, data.condition, data.threshold, data.severity, JSON.stringify(data.recipients), data.status, data.lastTriggered, now],
    );

    return { ...data, id, createdAt: now };
  }

  async findAll(status?: string): Promise<AlertRuleEntity[]> {
    let query = 'SELECT * FROM alert_rules';
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      query += ` WHERE status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.pool.query(query, params);
    return result.rows.map(this.rowToEntity);
  }

  async findByBudgetId(budgetId: string): Promise<AlertRuleEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM alert_rules WHERE budget_id = $1 ORDER BY created_at DESC',
      [budgetId],
    );
    return result.rows.map(this.rowToEntity);
  }

  async markTriggered(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE alert_rules SET last_triggered = $1 WHERE id = $2',
      [new Date(), id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async update(id: string, updates: { name?: string; threshold?: number; severity?: string; status?: string; recipients?: string[] }): Promise<AlertRuleEntity | null> {
    const keys = Object.keys(updates) as (keyof typeof updates)[];
    if (keys.length === 0) return null;

    const setClauses = keys.map((key, i) => {
      if (key === 'recipients') return `recipients = $${i + 1}::jsonb`;
      return `${key} = $${i + 1}`;
    }).join(', ');
    const values = keys.map(key => {
      if (key === 'recipients') return JSON.stringify(updates[key]);
      return updates[key];
    });

    const result = await this.pool.query(
      `UPDATE alert_rules SET ${setClauses} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id],
    );
    if (!result.rows[0]) return null;
    return this.rowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private rowToEntity(row: any): AlertRuleEntity {
    return {
      id: row.id,
      name: row.name,
      budgetId: row.budget_id,
      condition: row.condition,
      threshold: parseFloat(row.threshold),
      severity: row.severity,
      recipients: typeof row.recipients === 'string' ? JSON.parse(row.recipients) : (Array.isArray(row.recipients) ? row.recipients : []),
      status: row.status,
      lastTriggered: row.last_triggered,
      createdAt: row.created_at,
    };
  }
}

export class ModelPricingRepository {
  private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.pool = pool;
  }

  async create(data: Omit<ModelPricingEntity, 'id' | 'effectiveFrom'>): Promise<ModelPricingEntity> {
    const now = new Date();
    const id = crypto.randomUUID();

    await this.pool.query(
      `INSERT INTO model_pricing (id, provider, model, input_price_per_1k, output_price_per_1k, currency, effective_from, effective_to, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, data.provider, data.model, data.inputPricePer1k, data.outputPricePer1k, data.currency, now, data.effectiveTo, data.notes],
    );

    return { ...data, id, effectiveFrom: now };
  }

  async findAll(): Promise<ModelPricingEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM model_pricing WHERE effective_to IS NULL OR effective_to > NOW() ORDER BY provider, model',
    );
    return result.rows.map(this.rowToEntity);
  }

  async findByProviderModel(provider: string, model: string): Promise<ModelPricingEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM model_pricing WHERE provider = $1 AND model = $2 AND (effective_to IS NULL OR effective_to > NOW()) ORDER BY effective_from DESC LIMIT 1',
      [provider, model],
    );
    if (!result.rows[0]) return null;
    return this.rowToEntity(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE model_pricing SET effective_to = $1 WHERE id = $2',
      [new Date(), id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private rowToEntity(row: any): ModelPricingEntity {
    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      inputPricePer1k: parseFloat(row.input_price_per_1k),
      outputPricePer1k: parseFloat(row.output_price_per_1k),
      currency: row.currency,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      notes: row.notes,
    };
  }
}
