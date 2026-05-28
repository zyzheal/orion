/**
 * EventBus Repository Layer
 *
 * PostgreSQL repositories for event bus persistence:
 * - EventBusConfigRepository: event bus configuration storage
 * - EventSubscriptionRepository: persistent subscription registry
 * - EventBusEventRepository: published event history log
 *
 * Migrated from in-memory Map() to PostgreSQL Repository pattern (M24)
 */

import { BaseRepository, FindAllOptions } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

// ==================== Entity Types ====================

export interface EventBusConfigEntity {
  id: string;
  configKey: string;
  configValue: Record<string, any>;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSubscriptionEntity {
  id: string;
  tenantId: string;
  subjectPattern: string;
  handlerName: string;
  handlerType: string;
  durableName?: string;
  queueGroup?: string;
  filterSubject?: string;
  status: 'active' | 'paused' | 'deleted';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventBusEventEntity {
  id: string;
  tenantId: string;
  eventType: string;
  subject: string;
  source: string;
  payload: Record<string, any>;
  sequenceNum?: number;
  status: 'published' | 'pending_fallback' | 'pending_published' | 'delivered' | 'failed' | 'dead_letter';
  publishedBy?: string;
  publishedAt: Date;
  retryCount?: number;
  lastRetryAt?: Date;
  createdAt: Date;
}

// ==================== Config Repository ====================

export class EventBusConfigRepository extends BaseRepository<EventBusConfigEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'event_bus_config');
  }

  async findByKey(key: string): Promise<EventBusConfigEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM event_bus_config WHERE config_key = $1`,
      [key],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async upsert(key: string, value: Record<string, any>, description?: string): Promise<EventBusConfigEntity> {
    const existing = await this.findByKey(key);
    if (existing) {
      return this.update(existing.id, { configValue: value, description });
    }
    return this.insert({ configKey: key, configValue: value, description });
  }

  async insert(data: { configKey: string; configValue: Record<string, any>; description?: string }): Promise<EventBusConfigEntity> {
    const result = await this.db.query(
      `INSERT INTO event_bus_config (config_key, config_value, description) VALUES ($1, $2, $3) RETURNING *`,
      [data.configKey, JSON.stringify(data.configValue), data.description],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): EventBusConfigEntity {
    return {
      id: row.id,
      configKey: row.config_key,
      configValue: row.config_value ?? {},
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== Subscription Repository ====================

export class EventSubscriptionRepository extends BaseRepository<EventSubscriptionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'event_subscriptions');
  }

  async findBySubject(subjectPattern: string): Promise<EventSubscriptionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_subscriptions WHERE subject_pattern = $1 AND status = 'active' ORDER BY created_at DESC`,
      [subjectPattern],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options?: FindAllOptions): Promise<EventSubscriptionEntity[]> {
    const where = { ...options?.where, tenant_id: tenantId, status: 'active' };
    const result = await this.db.query(
      `SELECT * FROM event_subscriptions WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByHandler(handlerName: string): Promise<EventSubscriptionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_subscriptions WHERE handler_name = $1 AND status = 'active' ORDER BY created_at DESC`,
      [handlerName],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<EventSubscriptionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_subscriptions WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: 'active' | 'paused' | 'deleted'): Promise<EventSubscriptionEntity | null> {
    const result = await this.db.query(
      `UPDATE event_subscriptions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async insert(data: {
    tenant_id: string; subject_pattern: string; handler_name: string;
    handler_type?: string; durable_name?: string; queue_group?: string;
    filter_subject?: string; status?: string; metadata?: Record<string, any>;
  }): Promise<EventSubscriptionEntity> {
    const result = await this.db.query(
      `INSERT INTO event_subscriptions (tenant_id, subject_pattern, handler_name, handler_type, durable_name, queue_group, filter_subject, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.tenant_id,
        data.subject_pattern,
        data.handler_name,
        data.handler_type || 'nats',
        data.durable_name || null,
        data.queue_group || null,
        data.filter_subject || null,
        data.status || 'active',
        JSON.stringify(data.metadata || {}),
      ],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): EventSubscriptionEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      subjectPattern: row.subject_pattern,
      handlerName: row.handler_name,
      handlerType: row.handler_type ?? 'nats',
      durableName: row.durable_name,
      queueGroup: row.queue_group,
      filterSubject: row.filter_subject,
      status: row.status ?? 'active',
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== Event History Repository ====================

export class EventBusEventRepository extends BaseRepository<EventBusEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'event_bus_events');
  }

  async findByType(eventType: string, options?: { limit?: number }): Promise<EventBusEventEntity[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM event_bus_events WHERE event_type = $1 ORDER BY published_at DESC LIMIT $2`,
      [eventType, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findBySubject(subject: string, options?: { limit?: number }): Promise<EventBusEventEntity[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM event_bus_events WHERE subject = $1 ORDER BY published_at DESC LIMIT $2`,
      [subject, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string, options?: { limit?: number }): Promise<EventBusEventEntity[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM event_bus_events WHERE status = $1 ORDER BY published_at DESC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string, options?: { limit?: number }): Promise<EventBusEventEntity[]> {
    const limit = options?.limit ?? 50;
    const result = await this.db.query(
      `SELECT * FROM event_bus_events WHERE tenant_id = $1 ORDER BY published_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: 'published' | 'pending_fallback' | 'pending_published' | 'delivered' | 'failed' | 'dead_letter'): Promise<EventBusEventEntity | null> {
    const result = await this.db.query(
      `UPDATE event_bus_events SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Fetch pending events for retry (both pending_fallback and pending_published)
   * Ordered by age, limited by maxRetryCount
   */
  async findPendingFallbackEvents(limit: number = 100, maxRetryCount: number = 3): Promise<EventBusEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM event_bus_events
       WHERE status IN ('pending_fallback', 'pending_published') AND retry_count < $1
       ORDER BY published_at ASC
       LIMIT $2`,
      [maxRetryCount, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Increment retry count and update last retry timestamp
   */
  async incrementRetryCount(id: string): Promise<EventBusEventEntity | null> {
    const result = await this.db.query(
      `UPDATE event_bus_events
       SET retry_count = retry_count + 1, last_retry_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async insert(data: {
    tenant_id?: string; event_type: string; subject: string;
    source?: string; payload: Record<string, any>;
    sequence_num?: number; status?: string; published_by?: string;
    published_at?: Date;
  }): Promise<EventBusEventEntity> {
    const result = await this.db.query(
      `INSERT INTO event_bus_events (tenant_id, event_type, subject, source, payload, sequence_num, status, published_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.tenant_id || 'default',
        data.event_type,
        data.subject,
        data.source || 'orion-platform-service',
        JSON.stringify(data.payload),
        data.sequence_num || null,
        data.status || 'published',
        data.published_by || null,
      ],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.OPERATION_FAILED, 'INSERT returned no rows');
    return this.mapRowToEntity(result.rows[0]);
  }

  async countByStatus(status: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM event_bus_events WHERE status = $1`,
      [status],
    );
    return parseInt((result.rows[0] as any).count, 10);
  }

  async countByType(eventType: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM event_bus_events WHERE event_type = $1`,
      [eventType],
    );
    return parseInt((result.rows[0] as any).count, 10);
  }

  protected mapRowToEntity(row: any): EventBusEventEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      subject: row.subject,
      source: row.source ?? 'orion-platform-service',
      payload: row.payload ?? {},
      sequenceNum: row.sequence_num,
      status: row.status ?? 'published',
      publishedBy: row.published_by,
      publishedAt: row.published_at,
      retryCount: row.retry_count ?? 0,
      lastRetryAt: row.last_retry_at,
      createdAt: row.created_at,
    };
  }
}
