import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

// Entity types
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
  milestones: Record<string, any>;
}

export interface ChatOpsSessionEntity {
  id: string;
  key: string;
  userId: string;
  channelId: string;
  history: any[];
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

// ==================== Command Repository ====================

export class ChatOpsCommandRepository extends BaseRepository<ChatOpsCommandEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_commands');
  }

  async findByName(name: string): Promise<ChatOpsCommandEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM chatops_commands WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByAlias(alias: string): Promise<ChatOpsCommandEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM chatops_commands WHERE $1 = ANY(aliases)`,
      [alias],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByPermission(permissionLevel: string): Promise<ChatOpsCommandEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_commands WHERE permission_level = $1`,
      [permissionLevel],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Insert with explicit snake_case column mapping */
  async insert(data: {
    name: string; subcommand: string; schema: Record<string, any>;
    aliases: string[]; permissionLevel: string; examples: string[];
  }): Promise<ChatOpsCommandEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_commands (name, subcommand, schema, aliases, permission_level, examples) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, data.subcommand, data.schema, data.aliases, data.permissionLevel, data.examples],
    );
    if (result.rows.length === 0) throw new Error('INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsCommandEntity {
    return {
      id: row.id,
      name: row.name,
      subcommand: row.subcommand ?? '',
      schema: row.schema ?? {},
      aliases: row.aliases ?? [],
      permissionLevel: row.permission_level ?? 'user',
      examples: row.examples ?? [],
    };
  }
}

// ==================== Execution Repository ====================

export class ChatOpsExecutionRepository extends BaseRepository<ChatOpsExecutionEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_executions');
  }

  async findByUser(userId: string, options?: { limit?: number }): Promise<ChatOpsExecutionEntity[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM chatops_executions WHERE user_id = $1 ORDER BY start_time DESC LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<ChatOpsExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_executions WHERE status = $1 ORDER BY start_time DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByCommandId(commandId: string): Promise<ChatOpsExecutionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_executions WHERE command_id = $1 ORDER BY start_time DESC`,
      [commandId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string, endTime: Date, result: Record<string, any>): Promise<ChatOpsExecutionEntity | null> {
    const dbResult = await this.db.query(
      `UPDATE chatops_executions SET status = $1, end_time = $2, result = $3 WHERE id = $4 RETURNING *`,
      [status, endTime, result, id],
    );
    if (dbResult.rows.length === 0) return null;
    return this.mapRowToEntity(dbResult.rows[0]);
  }

  /** Insert with explicit column names (no dynamic concatenation) */
  async insert(data: {
    command_id: string; user_id: string; platform: string; channel: string;
    params: Record<string, any>; status: string; start_time: Date;
    end_time: Date | null; result: Record<string, any>; milestones: Record<string, any>;
  }): Promise<ChatOpsExecutionEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_executions
        (command_id, user_id, platform, channel, params, status, start_time, end_time, result, milestones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.command_id,
        data.user_id,
        data.platform,
        data.channel,
        data.params,
        data.status,
        data.start_time,
        data.end_time,
        data.result,
        data.milestones,
      ],
    );
    if (result.rows.length === 0) throw new Error('INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsExecutionEntity {
    return {
      id: row.id,
      commandId: row.command_id,
      userId: row.user_id,
      platform: row.platform,
      channel: row.channel,
      params: row.params ?? {},
      status: row.status ?? 'pending',
      startTime: row.start_time,
      endTime: row.end_time,
      result: row.result ?? {},
      milestones: row.milestones ?? {},
    };
  }
}

// ==================== Session Repository ====================

export class ChatOpsSessionRepository extends BaseRepository<ChatOpsSessionEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_sessions');
  }

  async findByKey(key: string): Promise<ChatOpsSessionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM chatops_sessions WHERE key = $1`,
      [key],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByUser(userId: string): Promise<ChatOpsSessionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_sessions WHERE user_id = $1`,
      [userId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateState(key: string, state: Record<string, any>, history: any[]): Promise<ChatOpsSessionEntity | null> {
    const result = await this.db.query(
      `UPDATE chatops_sessions SET state = $1, history = $2 WHERE key = $3 RETURNING *`,
      [state, history, key],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /** Insert with explicit snake_case column mapping */
  async insert(data: {
    key: string; user_id: string; channel_id: string;
    history: any[]; state: Record<string, any>;
  }): Promise<ChatOpsSessionEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_sessions (key, user_id, channel_id, history, state) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.key, data.user_id, data.channel_id, data.history, data.state],
    );
    if (result.rows.length === 0) throw new Error('INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsSessionEntity {
    return {
      id: row.id ?? '',
      key: row.key,
      userId: row.user_id,
      channelId: row.channel_id,
      history: row.history ?? [],
      state: row.state ?? {},
    };
  }
}

// ==================== Audit Log Repository ====================

export class ChatOpsAuditLogRepository extends BaseRepository<ChatOpsAuditLogEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_audit_logs');
  }

  async findByTraceId(traceId: string): Promise<ChatOpsAuditLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_audit_logs WHERE trace_id = $1 ORDER BY timestamp`,
      [traceId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByResult(resultType: string, options?: { limit?: number }): Promise<ChatOpsAuditLogEntity[]> {
    const limit = options?.limit ?? 100;
    const result = await this.db.query(
      `SELECT * FROM chatops_audit_logs WHERE result = $1 ORDER BY timestamp DESC LIMIT $2`,
      [resultType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(hours: number): Promise<ChatOpsAuditLogEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM chatops_audit_logs WHERE timestamp >= NOW() - INTERVAL '1 hour' * $1 ORDER BY timestamp DESC`,
      [hours],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /** Insert with explicit snake_case column mapping */
  async insert(data: {
    trace_id: string; actor: Record<string, any>; timestamp: Date;
    action: Record<string, any>; result: string; context: Record<string, any>;
  }): Promise<ChatOpsAuditLogEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_audit_logs (trace_id, actor, timestamp, action, result, context) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.trace_id, data.actor, data.timestamp, data.action, data.result, data.context],
    );
    if (result.rows.length === 0) throw new Error('INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  // Stats and aggregation helpers
  async countByResult(resultType: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM chatops_audit_logs WHERE result = $1`,
      [resultType],
    );
    return parseInt((result.rows[0] as any).count, 10);
  }

  async countAll(): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM chatops_audit_logs`,
    );
    return parseInt((result.rows[0] as any).count, 10);
  }

  async countByAction(command: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM chatops_audit_logs WHERE action->>'command' = $1`,
      [command],
    );
    return parseInt((result.rows[0] as any).count, 10);
  }

  async countByPlatform(platform: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM chatops_audit_logs WHERE actor->>'platform' = $1`,
      [platform],
    );
    return parseInt((result.rows[0] as any).count, 10);
  }

  protected mapRowToEntity(row: any): ChatOpsAuditLogEntity {
    return {
      id: row.id,
      traceId: row.trace_id,
      actor: row.actor ?? {},
      timestamp: row.timestamp,
      action: row.action ?? {},
      result: row.result ?? 'unknown',
      context: row.context ?? {},
    };
  }
}

// ==================== ChatOpsMessage Repository (Phase 1a) ====================

export interface ChatOpsMessageEntity {
  id: string;
  sessionKey: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parsedCommand: Record<string, unknown> | null;
  parsedCommandSanitized: boolean;
  createdAt: Date;
}

export class ChatOpsMessageRepository extends BaseRepository<ChatOpsMessageEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_messages');
  }

  async findBySession(sessionKey: string, options?: { limit?: number; cursor?: string }): Promise<{ messages: ChatOpsMessageEntity[]; hasMore: boolean }> {
    const limit = options?.limit ?? 50;
    let query: string;
    let params: unknown[];

    if (options?.cursor) {
      query = `SELECT * FROM chatops_messages WHERE session_key = $1 AND created_at < $2::timestamptz ORDER BY created_at DESC LIMIT $3`;
      params = [sessionKey, options.cursor, limit + 1];
    } else {
      query = `SELECT * FROM chatops_messages WHERE session_key = $1 ORDER BY created_at DESC LIMIT $2`;
      params = [sessionKey, limit + 1];
    }

    const result = await this.db.query(query, params);
    const hasMore = result.rows.length > limit;
    if (hasMore) result.rows.pop();

    return {
      messages: result.rows.map(row => this.mapRowToEntity(row)),
      hasMore,
    };
  }

  async insert(data: { session_key: string; role: string; content: string; parsed_command: Record<string, unknown> | null; parsed_command_sanitized?: boolean }): Promise<ChatOpsMessageEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_messages (session_key, role, content, parsed_command, parsed_command_sanitized) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.session_key, data.role, data.content, data.parsed_command, data.parsed_command_sanitized ?? true],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsMessageEntity {
    return {
      id: row.id,
      sessionKey: row.session_key,
      role: row.role,
      content: row.content,
      parsedCommand: row.parsed_command,
      parsedCommandSanitized: row.parsed_command_sanitized ?? true,
      createdAt: row.created_at,
    };
  }
}

// ==================== ChatOpsNotificationPreference Repository ====================

export interface ChatOpsNotificationPreferenceEntity {
  id: string;
  userId: string;
  alertLevel: 'critical' | 'warning' | 'info';
  channelChatops: boolean;
  channelEmail: boolean;
  channelSlack: boolean;
  channelFeishu: boolean;
  channelDingtalk: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatOpsNotificationPreferenceRepository extends BaseRepository<ChatOpsNotificationPreferenceEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_notification_preferences');
  }

  async findByUserId(userId: string): Promise<ChatOpsNotificationPreferenceEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM chatops_notification_preferences WHERE user_id = $1 ORDER BY alert_level',
      [userId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ChatOpsNotificationPreferenceEntity {
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

// ==================== ChatOpsDNDSettings Repository ====================

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

export class ChatOpsDNDSettingsRepository extends BaseRepository<ChatOpsDNDSettingsEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_dnd_settings');
  }

  async findByUserId(userId: string): Promise<ChatOpsDNDSettingsEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM chatops_dnd_settings WHERE user_id = $1',
      [userId],
    );
    if (result.rowCount === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsDNDSettingsEntity {
    return {
      id: row.id,
      userId: row.user_id,
      enabled: row.enabled,
      startTime: row.start_time,
      endTime: row.end_time,
      repeatDays: row.repeat_days || [1, 2, 3, 4, 5],
      allowCritical: row.allow_critical,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== ChatOpsAlertState Repository ====================

export interface ChatOpsAlertStateEntity {
  id: string;
  userId: string;
  alertId: string;
  state: 'unread' | 'read' | 'acknowledged' | 'dismissed';
  readAt: Date | null;
  dismissedAt: Date | null;
  escalationStopped: boolean;
  escalationCurrentLevel: number;
  createdAt: Date;
}

export class ChatOpsAlertStateRepository extends BaseRepository<ChatOpsAlertStateEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_alert_states');
  }

  async countByState(userId: string, state: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) FROM chatops_alert_states WHERE user_id = $1 AND state = $2`,
      [userId, state],
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  protected mapRowToEntity(row: any): ChatOpsAlertStateEntity {
    return {
      id: row.id,
      userId: row.user_id,
      alertId: row.alert_id,
      state: row.state,
      readAt: row.read_at,
      dismissedAt: row.dismissed_at,
      escalationStopped: row.escalation_stopped || false,
      escalationCurrentLevel: row.escalation_current_level || 0,
      createdAt: row.created_at,
    };
  }
}

// ==================== ChatOpsPlatformConfig Repository ====================

export interface ChatOpsPlatformConfigEntity {
  id: string;
  userId: string;
  platform: 'dingtalk' | 'wecom' | 'feishu' | 'slack';
  enabled: boolean;
  webhook: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatOpsPlatformConfigRepository extends BaseRepository<ChatOpsPlatformConfigEntity> {
  constructor(db: DatabasePool) {
    super(db, 'chatops_platform_configs');
  }

  async findByUserId(userId: string): Promise<ChatOpsPlatformConfigEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM chatops_platform_configs WHERE user_id = $1',
      [userId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByUserAndPlatform(userId: string, platform: string): Promise<ChatOpsPlatformConfigEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM chatops_platform_configs WHERE user_id = $1 AND platform = $2',
      [userId, platform],
    );
    if (result.rowCount === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsert(data: {
    userId: string;
    platform: string;
    enabled: boolean;
    webhook: string;
    token: string;
  }): Promise<ChatOpsPlatformConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO chatops_platform_configs (user_id, platform, enabled, webhook, token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, platform) DO UPDATE SET
         enabled = $3, webhook = $4, token = $5, updated_at = NOW()
       RETURNING *`,
      [data.userId, data.platform, data.enabled, data.webhook, data.token],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ChatOpsPlatformConfigEntity {
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      enabled: row.enabled,
      webhook: row.webhook || '',
      token: row.token || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
