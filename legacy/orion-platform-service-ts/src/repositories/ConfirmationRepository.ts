/**
 * Confirmation Repository — PostgreSQL data access for confirmation requests,
 * audit logs, and notification settings.
 *
 * D7 Fix: Replaces in-memory Map storage with persistent PostgreSQL tables.
 */

export interface ConfirmationEntity {
  id: string;
  scene_type: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  ai_suggestion: string;
  ai_confidence: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  push_time: Date;
  response_time?: Date | null;
  responder?: string | null;
  comment?: string | null;
  context?: Record<string, unknown> | null;
  tenant_id?: string | null;
  created_at: Date;
}

export interface ConfirmationAuditEntity {
  id: string;
  confirmation_id: string;
  action: string;
  user: string;
  timestamp: Date;
  details?: string | null;
}

export interface NotificationSettingsEntity {
  id: string;
  user_id: string;
  channels: string[];
  dnd_start: string;
  dnd_end: string;
  auto_approve_p3: boolean;
  auto_approve_after_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface FindAllResult<T> {
  entities: T[];
  total: number;
}

export class ConfirmationRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  // ==================== Confirmation Requests ====================

  async insert(data: {
    id?: string;
    sceneType: string;
    priority: string;
    aiSuggestion: string;
    aiConfidence: number;
    context?: Record<string, unknown>;
    tenantId?: string;
  }): Promise<ConfirmationEntity> {
    const now = new Date();
    const id = data.id || `conf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO confirmation_requests
        (id, scene_type, priority, ai_suggestion, ai_confidence, status, push_time, context, tenant_id, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        data.sceneType,
        data.priority,
        data.aiSuggestion,
        data.aiConfidence,
        now,
        data.context ? JSON.stringify(data.context) : null,
        data.tenantId || null,
        now,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<ConfirmationEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM confirmation_requests WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findAll(params: {
    sceneType?: string;
    priority?: string;
    status?: string;
    tenantId?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<FindAllResult<ConfirmationEntity>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.sceneType) {
      conditions.push(`scene_type = $${paramIndex++}`);
      values.push(params.sceneType);
    }
    if (params.priority) {
      conditions.push(`priority = $${paramIndex++}`);
      values.push(params.priority);
    }
    if (params.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      values.push(params.tenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM confirmation_requests ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM confirmation_requests ${whereClause}
       ORDER BY push_time DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      entities: result.rows.map((row) => this.mapRow(row)),
      total,
    };
  }

  async updateStatus(id: string, status: string, responder?: string, comment?: string, responseTime?: Date): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE confirmation_requests
       SET status = $1, responder = $2, comment = $3, response_time = $4, updated_at = NOW()
       WHERE id = $5`,
      [status, responder || null, comment || null, responseTime || new Date(), id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM confirmation_requests WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Audit Logs ====================

  async insertAudit(data: {
    confirmationId: string;
    action: string;
    user: string;
    details?: string;
  }): Promise<ConfirmationAuditEntity> {
    const result = await this.db.query(
      `INSERT INTO confirmation_audit_logs
        (id, confirmation_id, action, "user", timestamp, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        data.confirmationId,
        data.action,
        data.user,
        new Date(),
        data.details || null,
      ]
    );
    return this.mapAuditRow(result.rows[0]);
  }

  async findAuditsByConfirmation(confirmationId: string): Promise<ConfirmationAuditEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM confirmation_audit_logs WHERE confirmation_id = $1 ORDER BY timestamp DESC',
      [confirmationId]
    );
    return result.rows.map((row) => this.mapAuditRow(row));
  }

  async findAllAudits(params: {
    user?: string;
    tenantId?: string;
    startDate?: string;
    endDate?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<FindAllResult<ConfirmationAuditEntity>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.user) {
      conditions.push(`a."user" = $${paramIndex++}`);
      values.push(params.user);
    }
    if (params.startDate) {
      conditions.push(`a.timestamp >= $${paramIndex++}`);
      values.push(params.startDate);
    }
    if (params.endDate) {
      conditions.push(`a.timestamp <= $${paramIndex++}`);
      values.push(params.endDate);
    }
    if (params.tenantId) {
      conditions.push(`c.tenant_id = $${paramIndex++}`);
      values.push(params.tenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;

    const tenantJoin = params.tenantId ? 'JOIN confirmation_requests c ON a.confirmation_id = c.id' : '';

    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM confirmation_audit_logs a ${tenantJoin} ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT a.* FROM confirmation_audit_logs a
       ${tenantJoin}
       ${whereClause}
       ORDER BY a.timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      entities: result.rows.map((row) => this.mapAuditRow(row)),
      total,
    };
  }

  // ==================== Notification Settings ====================

  async findNotificationSettings(userId: string): Promise<NotificationSettingsEntity | null> {
    const result = await this.db.query(
      'SELECT * FROM notification_settings WHERE user_id = $1',
      [userId]
    );
    return result.rows.length > 0 ? this.mapNotificationRow(result.rows[0]) : null;
  }

  async upsertNotificationSettings(data: {
    userId: string;
    channels: string[];
    dndStart: string;
    dndEnd: string;
    autoApproveP3: boolean;
    autoApproveAfterMinutes: number;
  }): Promise<NotificationSettingsEntity> {
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO notification_settings
        (id, user_id, channels, dnd_start, dnd_end, auto_approve_p3, auto_approve_after_minutes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         channels = EXCLUDED.channels,
         dnd_start = EXCLUDED.dnd_start,
         dnd_end = EXCLUDED.dnd_end,
         auto_approve_p3 = EXCLUDED.auto_approve_p3,
         auto_approve_after_minutes = EXCLUDED.auto_approve_after_minutes,
         updated_at = NOW()
       RETURNING *`,
      [
        `ns_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        data.userId,
        JSON.stringify(data.channels),
        data.dndStart,
        data.dndEnd,
        data.autoApproveP3,
        data.autoApproveAfterMinutes,
        now,
      ]
    );
    return this.mapNotificationRow(result.rows[0]);
  }

  // ==================== Stats ====================

  async getStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    expired: number;
  }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (tenantId) {
      conditions.push(`tenant_id = $1`);
      values.push(tenantId);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'expired') as expired
       FROM confirmation_requests ${whereClause}`,
      values
    );

    const row = result.rows[0];
    return {
      total: parseInt(row.total, 10),
      pending: parseInt(row.pending, 10),
      confirmed: parseInt(row.confirmed, 10),
      rejected: parseInt(row.rejected, 10),
      expired: parseInt(row.expired, 10),
    };
  }

  // ==================== Row Mappers ====================

  private mapRow(row: any): ConfirmationEntity {
    return {
      id: row.id,
      scene_type: row.scene_type,
      priority: row.priority,
      ai_suggestion: row.ai_suggestion,
      ai_confidence: parseFloat(row.ai_confidence),
      status: row.status,
      push_time: new Date(row.push_time),
      response_time: row.response_time ? new Date(row.response_time) : null,
      responder: row.responder,
      comment: row.comment,
      context: row.context ? (typeof row.context === 'string' ? JSON.parse(row.context) : row.context) : null,
      tenant_id: row.tenant_id,
      created_at: new Date(row.created_at),
    };
  }

  private mapAuditRow(row: any): ConfirmationAuditEntity {
    return {
      id: row.id,
      confirmation_id: row.confirmation_id,
      action: row.action,
      user: row.user,
      timestamp: new Date(row.timestamp),
      details: row.details,
    };
  }

  private mapNotificationRow(row: any): NotificationSettingsEntity {
    return {
      id: row.id,
      user_id: row.user_id,
      channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels,
      dnd_start: row.dnd_start,
      dnd_end: row.dnd_end,
      auto_approve_p3: row.auto_approve_p3,
      auto_approve_after_minutes: row.auto_approve_after_minutes,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
