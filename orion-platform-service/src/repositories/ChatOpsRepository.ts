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
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
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
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
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

  /** Insert with explicit snake_case column mapping */
  async insert(data: {
    command_id: string; user_id: string; platform: string; channel: string;
    params: Record<string, any>; status: string; start_time: Date;
    end_time: Date | null; result: Record<string, any>; milestones: Record<string, any>;
  }): Promise<ChatOpsExecutionEntity> {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO chatops_executions (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, vals);
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
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
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
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
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
