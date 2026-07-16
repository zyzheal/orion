import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface AlertBreakerRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  ruleType: 'dedup' | 'suppress' | 'throttle';
  matchConditions: Record<string, unknown>;
  config: BreakerConfig;
  enabled: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BreakerConfig {
  /** For dedup: window in minutes to consider alerts as duplicates */
  dedupWindowMinutes?: number;
  /** For suppress: start time (HH:mm) for suppression window */
  suppressStart?: string;
  /** For suppress: end time (HH:mm) for suppression window */
  suppressEnd?: string;
  /** For suppress: timezone */
  suppressTimezone?: string;
  /** For throttle: max alerts per interval */
  throttleMaxCount?: number;
  /** For throttle: interval in minutes */
  throttleIntervalMinutes?: number;
}

export interface AlertBreakerStateEntity {
  id: string;
  tenantId: string;
  ruleId: string;
  alertFingerprint: string;
  state: 'open' | 'half-open' | 'closed';
  suppressedUntil: Date | null;
  hitCount: number;
  lastHitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AlertBreakerRuleRepository extends BaseRepository<AlertBreakerRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_breaker_rules');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<AlertBreakerRuleEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findEnabled(tenantId: string): Promise<AlertBreakerRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_breaker_rules WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByType(tenantId: string, ruleType: AlertBreakerRuleEntity['ruleType']): Promise<AlertBreakerRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_breaker_rules WHERE tenant_id = $1 AND rule_type = $2 ORDER BY created_at DESC`,
      [tenantId, ruleType],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AlertBreakerRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      ruleType: row.rule_type,
      matchConditions: typeof row.match_conditions === 'string' ? JSON.parse(row.match_conditions) : (row.match_conditions ?? {}),
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config ?? {}),
      enabled: row.enabled,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class AlertBreakerStateRepository extends BaseRepository<AlertBreakerStateEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'alert_breaker_states');
  }

  async findByRuleAndFingerprint(ruleId: string, fingerprint: string): Promise<AlertBreakerStateEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM alert_breaker_states WHERE rule_id = $1 AND alert_fingerprint = $2`,
      [ruleId, fingerprint],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findActiveByTenant(tenantId: string): Promise<AlertBreakerStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_breaker_states WHERE tenant_id = $1 AND state IN ('open', 'half-open') ORDER BY last_hit_at DESC`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByRuleId(ruleId: string): Promise<AlertBreakerStateEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM alert_breaker_states WHERE rule_id = $1 ORDER BY last_hit_at DESC`,
      [ruleId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): AlertBreakerStateEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ruleId: row.rule_id,
      alertFingerprint: row.alert_fingerprint,
      state: row.state,
      suppressedUntil: row.suppressed_until ?? null,
      hitCount: row.hit_count ?? 0,
      lastHitAt: row.last_hit_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
