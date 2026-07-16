/**
 * AIDegradationConfig Repository
 *
 * PostgreSQL persistence for AI Degradation Router per-scenario configs and result cache.
 */
import { BaseRepository } from '../db/base-repository';

export interface AIDegradationConfigEntity {
  id: string;
  scenario: string;
  strategy: string;
  fallback_strategies: string[];
  rule_set: string | null;
  template_name: string | null;
  cache_ttl: number;
  notify_on_degradation: boolean;
  default_response: Record<string, unknown> | null;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class AIDegradationConfigRepository extends BaseRepository<AIDegradationConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_degradation_configs');
  }

  async findByScenario(scenario: string): Promise<AIDegradationConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_degradation_configs WHERE scenario = $1 LIMIT 1`,
      [scenario],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async listAll(): Promise<AIDegradationConfigEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_degradation_configs ORDER BY scenario`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByScenario(data: {
    id: string;
    scenario: string;
    strategy: string;
    fallbackStrategies: string[];
    ruleSet?: string;
    templateName?: string;
    cacheTtl: number;
    notifyOnDegradation: boolean;
    defaultResponse?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<AIDegradationConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_degradation_configs (id, scenario, strategy, fallback_strategies, rule_set, template_name, cache_ttl, notify_on_degradation, default_response, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (scenario) DO UPDATE SET
         strategy = EXCLUDED.strategy,
         fallback_strategies = EXCLUDED.fallback_strategies,
         rule_set = EXCLUDED.rule_set,
         template_name = EXCLUDED.template_name,
         cache_ttl = EXCLUDED.cache_ttl,
         notify_on_degradation = EXCLUDED.notify_on_degradation,
         default_response = EXCLUDED.default_response,
         updated_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.scenario,
        data.strategy,
        JSON.stringify(data.fallbackStrategies),
        data.ruleSet || null,
        data.templateName || null,
        data.cacheTtl,
        data.notifyOnDegradation,
        data.defaultResponse ? JSON.stringify(data.defaultResponse) : null,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByScenario(scenario: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM ai_degradation_configs WHERE scenario = $1`,
      [scenario],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): AIDegradationConfigEntity {
    return {
      id: row.id,
      scenario: row.scenario,
      strategy: row.strategy || 'default',
      fallback_strategies: typeof row.fallback_strategies === 'string' ? JSON.parse(row.fallback_strategies) : (row.fallback_strategies ?? []),
      rule_set: row.rule_set,
      template_name: row.template_name,
      cache_ttl: parseInt(row.cache_ttl) || 300000,
      notify_on_degradation: row.notify_on_degradation === true || row.notify_on_degradation === 'true',
      default_response: typeof row.default_response === 'string' ? JSON.parse(row.default_response) : row.default_response,
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}

/**
 * AIDegradationResultCache Entity
 */
export interface AIDegradationResultCacheEntity {
  id: string;
  cache_key: string;
  scenario: string;
  result_json: Record<string, unknown>;
  expires_at: Date;
  tenant_id: string | null;
  created_at: Date;
}

export class AIDegradationResultCacheRepository extends BaseRepository<AIDegradationResultCacheEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ai_degradation_result_cache');
  }

  async findByCacheKey(cacheKey: string): Promise<AIDegradationResultCacheEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ai_degradation_result_cache WHERE cache_key = $1 AND expires_at > NOW() LIMIT 1`,
      [cacheKey],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByScenario(scenario: string): Promise<AIDegradationResultCacheEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ai_degradation_result_cache WHERE scenario = $1 AND expires_at > NOW() ORDER BY created_at DESC`,
      [scenario],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByCacheKey(data: {
    id: string;
    cacheKey: string;
    scenario: string;
    resultJson: Record<string, unknown>;
    expiresAt: Date;
    tenantId?: string;
  }): Promise<AIDegradationResultCacheEntity> {
    const result = await this.db.query(
      `INSERT INTO ai_degradation_result_cache (id, cache_key, scenario, result_json, expires_at, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cache_key) DO UPDATE SET
         result_json = EXCLUDED.result_json,
         expires_at = EXCLUDED.expires_at,
         created_at = NOW()
       RETURNING *`,
      [
        data.id,
        data.cacheKey,
        data.scenario,
        JSON.stringify(data.resultJson),
        data.expiresAt,
        data.tenantId || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteByScenario(scenario: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_degradation_result_cache WHERE scenario = $1`,
      [scenario],
    );
    return result.rowCount ?? 0;
  }

  async pruneExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM ai_degradation_result_cache WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  protected mapRowToEntity(row: any): AIDegradationResultCacheEntity {
    return {
      id: row.id,
      cache_key: row.cache_key,
      scenario: row.scenario,
      result_json: typeof row.result_json === 'string' ? JSON.parse(row.result_json) : (row.result_json ?? {}),
      expires_at: row.expires_at ? new Date(row.expires_at) : new Date(),
      tenant_id: row.tenant_id,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
