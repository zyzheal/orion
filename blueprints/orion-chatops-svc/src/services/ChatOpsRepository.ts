/**
 * ChatOps Repositories — PostgreSQL Repository Pattern
 *
 * All repositories use DatabasePool for database access.
 */

import { DatabasePool } from '../types/database';

// ==================== Entity Types ====================

export interface ChatOpsCommandEntity {
  id: string;
  name: string;
  subcommand: string;
  schema: Record<string, any>;
  aliases: string[];
  permissionLevel: string;
  examples: string[];
}

export interface ChatOpsExecutionEntity {
  id: string;
  commandId: string;
  userId: string;
  platform: string;
  channel: string;
  params: Record<string, any>;
  status: string;
  startTime: Date;
  endTime: Date | null;
  result: Record<string, any>;
  milestones: Record<string, string>;
}

export interface ChatOpsSessionEntity {
  id: string;
  key: string;
  userId: string;
  channelId: string;
  history: Record<string, any>[];
  state: Record<string, any>;
}

export interface ChatOpsAuditLogEntity {
  id: string;
  traceId: string;
  actor: Record<string, any>;
  timestamp: Date;
  action: Record<string, any>;
  result: string;
  context: Record<string, any>;
}

export interface ChatOpsMessageEntity {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  role: string;
  createdAt: Date;
}

export interface ChatOpsNotificationPreferenceEntity {
  id: string;
  userId: string;
  alertLevel: string;
  channelChatops: boolean;
  channelEmail: boolean;
  channelSlack: boolean;
  channelFeishu: boolean;
  channelDingtalk: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatOpsDNDSettingsEntity {
  id: string;
  userId: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  repeatDays: number[];
  allowCritical: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatOpsAlertStateEntity {
  id: string;
  userId: string;
  alertId: string;
  state: string;
  readAt: Date | null;
  dismissedAt: Date | null;
  escalationStopped: boolean;
  escalationCurrentLevel: number;
  createdAt: Date;
}

export interface ChatOpsPlatformConfigEntity {
  id: string;
  userId: string;
  platform: string;
  enabled: boolean;
  webhook: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== FindAll Options ====================

interface FindAllOptions {
  limit?: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
}

// ==================== Command Repository ====================

export class ChatOpsCommandRepository {
  constructor(private pool: DatabasePool) {}

  async insert(data: {
    name: string;
    subcommand: string;
    schema: Record<string, any>;
    aliases: string[];
    permissionLevel: string;
    examples: string[];
  }): Promise<ChatOpsCommandEntity> {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.pool.query(
      `INSERT INTO chatops_commands (id, name, subcommand, schema, aliases, permission_level, examples, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [id, data.name, data.subcommand, JSON.stringify(data.schema), JSON.stringify(data.aliases), data.permissionLevel, JSON.stringify(data.examples)],
    );
    return {
      id,
      name: data.name,
      subcommand: data.subcommand,
      schema: data.schema,
      aliases: data.aliases,
      permissionLevel: data.permissionLevel,
      examples: data.examples,
    };
  }

  async findByName(name: string): Promise<ChatOpsCommandEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_commands WHERE name = $1',
      [name],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findByAlias(alias: string): Promise<ChatOpsCommandEntity | null> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_commands WHERE $1 = ANY(aliases)',
      [alias],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findByPermission(level: string): Promise<ChatOpsCommandEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_commands WHERE permission_level <= $1',
      [level],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  async findAll(opts: FindAllOptions = {}): Promise<{ entities: ChatOpsCommandEntity[]; total: number }> {
    const limit = opts.limit ?? 100;
    const orderBy = opts.orderBy ?? 'name';
    const orderDir = opts.orderDir ?? 'ASC';
    const result = await this.pool.query(
      `SELECT * FROM chatops_commands ORDER BY ${orderBy} ${orderDir} LIMIT $1`,
      [limit],
    );
    return { entities: result.rows.map(r => this.mapRow(r)), total: result.rows.length };
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM chatops_commands WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): ChatOpsCommandEntity {
    return {
      id: row.id,
      name: row.name,
      subcommand: row.subcommand,
      schema: typeof row.schema === 'string' ? JSON.parse(row.schema) : row.schema,
      aliases: Array.isArray(row.aliases) ? row.aliases : (typeof row.aliases === 'string' ? JSON.parse(row.aliases) : []),
      permissionLevel: row.permission_level,
      examples: Array.isArray(row.examples) ? row.examples : (typeof row.examples === 'string' ? JSON.parse(row.examples) : []),
    };
  }
}

// ==================== Execution Repository ====================

export class ChatOpsExecutionRepository {
  constructor(private pool: DatabasePool) {}

  async insert(data: {
    command_id: string;
    user_id: string;
    platform: string;
    channel: string;
    params: Record<string, any>;
    status: string;
    start_time: Date;
    end_time: Date | null;
    result: Record<string, any>;
    milestones: Record<string, string>;
  }): Promise<ChatOpsExecutionEntity> {
    const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.pool.query(
      `INSERT INTO chatops_executions (id, command_id, user_id, platform, channel, params, status, start_time, end_time, result, milestones, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [id, data.command_id, data.user_id, data.platform, data.channel, JSON.stringify(data.params), data.status, data.start_time, data.end_time, JSON.stringify(data.result), JSON.stringify(data.milestones)],
    );
    return this.toEntity(id, data);
  }

  async findById(id: string): Promise<ChatOpsExecutionEntity | null> {
    const result = await this.pool.query('SELECT * FROM chatops_executions WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findByCommandId(commandId: string): Promise<ChatOpsExecutionEntity[]> {
    const result = await this.pool.query('SELECT * FROM chatops_executions WHERE command_id = $1 ORDER BY start_time DESC', [commandId]);
    return result.rows.map(r => this.mapRow(r));
  }

  async findByUser(userId: string): Promise<ChatOpsExecutionEntity[]> {
    const result = await this.pool.query('SELECT * FROM chatops_executions WHERE user_id = $1 ORDER BY start_time DESC', [userId]);
    return result.rows.map(r => this.mapRow(r));
  }

  async findByStatus(status: string): Promise<ChatOpsExecutionEntity[]> {
    const result = await this.pool.query('SELECT * FROM chatops_executions WHERE status = $1 ORDER BY start_time DESC', [status]);
    return result.rows.map(r => this.mapRow(r));
  }

  async findAll(opts: FindAllOptions = {}): Promise<{ entities: ChatOpsExecutionEntity[]; total: number }> {
    const limit = opts.limit ?? 100;
    const result = await this.pool.query('SELECT * FROM chatops_executions ORDER BY start_time DESC LIMIT $1', [limit]);
    return { entities: result.rows.map(r => this.mapRow(r)), total: result.rows.length };
  }

  async updateStatus(id: string, status: string, endTime: Date, result: Record<string, any>): Promise<void> {
    await this.pool.query(
      'UPDATE chatops_executions SET status = $2, end_time = $3, result = $4, updated_at = NOW() WHERE id = $1',
      [id, status, endTime, JSON.stringify(result)],
    );
  }

  async update(id: string, data: Partial<ChatOpsExecutionEntity>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (data.milestones) { updates.push(`milestones = $${idx++}`); values.push(JSON.stringify(data.milestones)); }
    if (data.result) { updates.push(`result = $${idx++}`); values.push(JSON.stringify(data.result)); }
    if (updates.length === 0) return;
    updates.push(`updated_at = NOW()`);
    values.push(id);
    await this.pool.query(`UPDATE chatops_executions SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  }

  private toEntity(id: string, data: any): ChatOpsExecutionEntity {
    return {
      id,
      commandId: data.command_id,
      userId: data.user_id,
      platform: data.platform,
      channel: data.channel,
      params: data.params,
      status: data.status,
      startTime: data.start_time,
      endTime: data.end_time,
      result: data.result,
      milestones: data.milestones,
    };
  }

  private mapRow(row: any): ChatOpsExecutionEntity {
    return {
      id: row.id,
      commandId: row.command_id,
      userId: row.user_id,
      platform: row.platform,
      channel: row.channel,
      params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
      milestones: typeof row.milestones === 'string' ? JSON.parse(row.milestones) : row.milestones,
    };
  }
}

// ==================== Session Repository ====================

export class ChatOpsSessionRepository {
  constructor(private pool: DatabasePool) {}

  async insert(data: {
    key: string;
    user_id: string;
    channel_id: string;
    history: Record<string, any>[];
    state: Record<string, any>;
  }): Promise<ChatOpsSessionEntity> {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.pool.query(
      `INSERT INTO chatops_sessions (id, key, user_id, channel_id, history, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [id, data.key, data.user_id, data.channel_id, JSON.stringify(data.history), JSON.stringify(data.state)],
    );
    return {
      id,
      key: data.key,
      userId: data.user_id,
      channelId: data.channel_id,
      history: data.history,
      state: data.state,
    };
  }

  async findByKey(key: string): Promise<ChatOpsSessionEntity | null> {
    const result = await this.pool.query('SELECT * FROM chatops_sessions WHERE key = $1', [key]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async updateState(key: string, state: Record<string, any>, history: Record<string, any>[]): Promise<void> {
    await this.pool.query(
      'UPDATE chatops_sessions SET state = $2, history = $3, updated_at = NOW() WHERE key = $1',
      [key, JSON.stringify(state), JSON.stringify(history)],
    );
  }

  private mapRow(row: any): ChatOpsSessionEntity {
    return {
      id: row.id,
      key: row.key,
      userId: row.user_id,
      channelId: row.channel_id,
      history: typeof row.history === 'string' ? JSON.parse(row.history) : row.history,
      state: typeof row.state === 'string' ? JSON.parse(row.state) : row.state,
    };
  }
}

// ==================== Audit Log Repository ====================

export class ChatOpsAuditLogRepository {
  constructor(private pool: DatabasePool) {}

  async insert(data: {
    trace_id: string;
    actor: Record<string, any>;
    timestamp: Date;
    action: Record<string, any>;
    result: string;
    context?: Record<string, any>;
  }): Promise<ChatOpsAuditLogEntity> {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.pool.query(
      `INSERT INTO chatops_audit_logs (id, trace_id, actor, timestamp, action, result, context, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [id, data.trace_id, JSON.stringify(data.actor), data.timestamp, JSON.stringify(data.action), data.result, JSON.stringify(data.context ?? {})],
    );
    return {
      id,
      traceId: data.trace_id,
      actor: data.actor,
      timestamp: data.timestamp,
      action: data.action,
      result: data.result,
      context: data.context ?? {},
    };
  }

  async findAll(opts: FindAllOptions = {}): Promise<{ entities: ChatOpsAuditLogEntity[]; total: number }> {
    const limit = opts.limit ?? 100;
    const orderBy = opts.orderBy ?? 'timestamp';
    const orderDir = opts.orderDir ?? 'DESC';
    const result = await this.pool.query(
      `SELECT * FROM chatops_audit_logs ORDER BY ${orderBy} ${orderDir} LIMIT $1`,
      [limit],
    );
    return { entities: result.rows.map(r => this.mapRow(r)), total: result.rows.length };
  }

  async countAll(): Promise<number> {
    const result = await this.pool.query('SELECT COUNT(*) FROM chatops_audit_logs');
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async countByResult(result: string): Promise<number> {
    const res = await this.pool.query('SELECT COUNT(*) FROM chatops_audit_logs WHERE result = $1', [result]);
    return parseInt(res.rows[0]?.count ?? '0', 10);
  }

  async findRecent(hours: number): Promise<ChatOpsAuditLogEntity[]> {
    const result = await this.pool.query(
      'SELECT * FROM chatops_audit_logs WHERE timestamp > NOW() - ($1 * interval \'1 hour\') ORDER BY timestamp DESC',
      [hours],
    );
    return result.rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): ChatOpsAuditLogEntity {
    return {
      id: row.id,
      traceId: row.trace_id,
      actor: typeof row.actor === 'string' ? JSON.parse(row.actor) : row.actor,
      timestamp: row.timestamp,
      action: typeof row.action === 'string' ? JSON.parse(row.action) : row.action,
      result: row.result,
      context: typeof row.context === 'string' ? JSON.parse(row.context) : row.context,
    };
  }
}

// ==================== Message Repository ====================

export class ChatOpsMessageRepository {
  constructor(private pool: DatabasePool) {}

  async findBySession(sessionId: string, opts: { limit?: number; cursor?: string } = {}): Promise<{ messages: any[]; hasMore: boolean }> {
    const limit = opts.limit ?? 50;
    let sql = 'SELECT * FROM chatops_messages WHERE session_id = $1';
    const params: any[] = [sessionId];
    if (opts.cursor) {
      params.push(opts.cursor);
      sql += ' AND created_at < $2';
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit + 1}`;
    const result = await this.pool.query(sql, params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    return {
      messages: rows.map(r => this.mapRow(r)),
      hasMore,
    };
  }

  private mapRow(row: any): any {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      content: row.content,
      role: row.role,
      createdAt: row.created_at,
    };
  }
}

// ==================== Notification Preference Repository ====================

export class ChatOpsNotificationPreferenceRepository {
  constructor(private pool: DatabasePool) {}

  async findByUserId(userId: string): Promise<ChatOpsNotificationPreferenceEntity[]> {
    const result = await this.pool.query('SELECT * FROM chatops_notification_preferences WHERE user_id = $1', [userId]);
    return result.rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): ChatOpsNotificationPreferenceEntity {
    return {
      id: row.id,
      userId: row.user_id,
      alertLevel: row.alert_level,
      channelChatops: row.channel_chatops,
      channelEmail: row.channel_email,
      channelSlack: row.channel_slack,
      channelFeishu: row.channel_feishu,
      channelDingtalk: row.channel_dingtalk,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== DND Settings Repository ====================

export class ChatOpsDNDSettingsRepository {
  constructor(private pool: DatabasePool) {}

  async findByUserId(userId: string): Promise<ChatOpsDNDSettingsEntity | null> {
    const result = await this.pool.query('SELECT * FROM chatops_dnd_settings WHERE user_id = $1', [userId]);
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: any): ChatOpsDNDSettingsEntity {
    return {
      id: row.id,
      userId: row.user_id,
      enabled: row.enabled,
      startTime: row.start_time,
      endTime: row.end_time,
      repeatDays: Array.isArray(row.repeat_days) ? row.repeat_days : (typeof row.repeat_days === 'string' ? JSON.parse(row.repeat_days) : []),
      allowCritical: row.allow_critical,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== Alert State Repository ====================

export class ChatOpsAlertStateRepository {
  constructor(private pool: DatabasePool) {}

  async findByUserId(userId: string): Promise<ChatOpsAlertStateEntity[]> {
    const result = await this.pool.query('SELECT * FROM chatops_alert_states WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): ChatOpsAlertStateEntity {
    return {
      id: row.id,
      userId: row.user_id,
      alertId: row.alert_id,
      state: row.state,
      readAt: row.read_at,
      dismissedAt: row.dismissed_at,
      escalationStopped: row.escalation_stopped ?? false,
      escalationCurrentLevel: row.escalation_current_level ?? 0,
      createdAt: row.created_at,
    };
  }
}

// ==================== Platform Config Repository ====================

export class ChatOpsPlatformConfigRepository {
  constructor(private pool: DatabasePool) {}

  async findByUserId(userId: string): Promise<ChatOpsPlatformConfigEntity[]> {
    const result = await this.pool.query('SELECT * FROM chatops_platform_configs WHERE user_id = $1', [userId]);
    return result.rows.map(r => this.mapRow(r));
  }

  async upsert(data: {
    userId: string;
    platform: string;
    enabled: boolean;
    webhook: string;
    token: string;
  }): Promise<ChatOpsPlatformConfigEntity> {
    const result = await this.pool.query(
      `INSERT INTO chatops_platform_configs (user_id, platform, enabled, webhook, token, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id, platform) DO UPDATE SET
         enabled = $3, webhook = $4, token = $5, updated_at = NOW()
       RETURNING *`,
      [data.userId, data.platform, data.enabled, data.webhook, data.token],
    );
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): ChatOpsPlatformConfigEntity {
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      enabled: row.enabled,
      webhook: row.webhook,
      token: row.token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
