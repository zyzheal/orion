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

// Command Repository
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

// Execution Repository
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

  async updateStatus(id: string, status: string, endTime: Date, result: Record<string, any>): Promise<ChatOpsExecutionEntity | null> {
    const dbResult = await this.db.query(
      `UPDATE chatops_executions SET status = $1, end_time = $2, result = $3 WHERE id = $4 RETURNING *`,
      [status, endTime, result, id],
    );
    if (dbResult.rows.length === 0) return null;
    return this.mapRowToEntity(dbResult.rows[0]);
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

// Session Repository
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

  protected mapRowToEntity(row: any): ChatOpsSessionEntity {
    return {
      key: row.key,
      userId: row.user_id,
      channelId: row.channel_id,
      history: row.history ?? [],
      state: row.state ?? {},
    };
  }
}

// Audit Log Repository
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