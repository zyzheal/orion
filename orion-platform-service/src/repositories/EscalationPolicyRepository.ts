import { BaseRepository } from '../db/base-repository';

export interface EscalationPolicyEntity {
  id: string;
  entity_type: string;
  severity?: string;
  level: number;
  timeout_minutes: number;
  notify_users: string[];
  notify_channels: string[];
  auto_action?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class EscalationPolicyRepository extends BaseRepository<EscalationPolicyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'escalation_policies');
  }

  async findActive(): Promise<EscalationPolicyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM escalation_policies WHERE is_active = true ORDER BY entity_type, level`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEntityType(entityType: string, severity?: string): Promise<EscalationPolicyEntity[]> {
    let query = `SELECT * FROM escalation_policies WHERE entity_type = $1 AND is_active = true`;
    const params: any[] = [entityType];

    if (severity) {
      query += ` AND severity = $2`;
      params.push(severity);
    }

    query += ` ORDER BY level ASC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsert(data: {
    entity_type: string;
    severity?: string;
    level: number;
    timeout_minutes: number;
    notify_users: string[];
    notify_channels: string[];
    auto_action?: string;
    is_active: boolean;
  }): Promise<EscalationPolicyEntity> {
    const id = `policy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO escalation_policies
       (id, entity_type, severity, level, timeout_minutes, notify_users, notify_channels, auto_action, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (entity_type, severity, level)
       DO UPDATE SET timeout_minutes = $5, notify_users = $6, notify_channels = $7, auto_action = $8, is_active = $9, updated_at = NOW()
       RETURNING *`,
      [
        id,
        data.entity_type,
        data.severity || null,
        data.level,
        data.timeout_minutes,
        JSON.stringify(data.notify_users),
        JSON.stringify(data.notify_channels),
        data.auto_action || null,
        data.is_active,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): EscalationPolicyEntity {
    return {
      id: row.id,
      entity_type: row.entity_type,
      severity: row.severity,
      level: row.level ?? 1,
      timeout_minutes: row.timeout_minutes,
      notify_users: typeof row.notify_users === 'string' ? JSON.parse(row.notify_users) : (row.notify_users ?? []),
      notify_channels: typeof row.notify_channels === 'string' ? JSON.parse(row.notify_channels) : (row.notify_channels ?? []),
      auto_action: row.auto_action,
      is_active: row.is_active ?? true,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
}
