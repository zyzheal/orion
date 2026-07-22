import { BaseRepository, FindAllOptions, FindAllResult } from '../../db/base-repository';

export interface EventTriggerRuleEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  eventType: string;
  matchConditions: Record<string, unknown>;
  actions: TriggerAction[];
  enabled: boolean;
  cooldownSeconds: number;
  lastTriggeredAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TriggerAction {
  id: string;
  type: 'webhook' | 'notification' | 'runbook' | 'script' | 'escalation';
  config: Record<string, unknown>;
  order: number;
}

export interface EventTriggerLogEntity {
  id: string;
  tenantId: string;
  ruleId: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  actionResults: ActionResult[];
  status: 'success' | 'partial' | 'failed';
  triggeredAt: Date;
  createdAt: Date;
}

export interface ActionResult {
  actionId: string;
  actionType: string;
  status: 'success' | 'failed' | 'skipped';
  output: string | null;
  error: string | null;
}

export class EventTriggerRuleRepository extends BaseRepository<EventTriggerRuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'event_trigger_rules');
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<EventTriggerRuleEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  async findEnabled(tenantId: string): Promise<EventTriggerRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_trigger_rules WHERE tenant_id = $1 AND enabled = true ORDER BY name`,
      [tenantId],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByEventType(tenantId: string, eventType: string): Promise<EventTriggerRuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_trigger_rules WHERE tenant_id = $1 AND event_type = $2 ORDER BY created_at DESC`,
      [tenantId, eventType],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): EventTriggerRuleEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description ?? null,
      eventType: row.event_type,
      matchConditions: typeof row.match_conditions === 'string' ? JSON.parse(row.match_conditions) : (row.match_conditions ?? {}),
      actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions ?? []),
      enabled: row.enabled,
      cooldownSeconds: row.cooldown_seconds ?? 0,
      lastTriggeredAt: row.last_triggered_at ?? null,
      createdBy: row.created_by ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class EventTriggerLogRepository extends BaseRepository<EventTriggerLogEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'event_trigger_logs');
  }

  async findByRuleId(ruleId: string, limit: number = 20): Promise<EventTriggerLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_trigger_logs WHERE rule_id = $1 ORDER BY triggered_at DESC LIMIT $2`,
      [ruleId, limit],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options: FindAllOptions = {}): Promise<FindAllResult<EventTriggerLogEntity>> {
    return this.findAll({ ...options, where: { ...options.where, tenantId } });
  }

  protected mapRowToEntity(row: any): EventTriggerLogEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      ruleId: row.rule_id,
      eventType: row.event_type,
      eventPayload: typeof row.event_payload === 'string' ? JSON.parse(row.event_payload) : (row.event_payload ?? {}),
      actionResults: typeof row.action_results === 'string' ? JSON.parse(row.action_results) : (row.action_results ?? []),
      status: row.status,
      triggeredAt: row.triggered_at,
      createdAt: row.created_at,
    };
  }
}
