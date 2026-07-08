/**
 * SLA Repository - PostgreSQL persistence for SLA definitions, tracking, and breach events
 *
 * Three repositories:
 * - SLADefinitionRepository: CRUD for SLA definitions
 * - SLATrackingRepository: tracking records linked to entities (incidents/requests)
 * - SLABreachEventRepository: breach event history
 *
 * Follows the PostgreSQL Repository pattern with BaseRepository.
 */

import { BaseRepository, FindAllResult } from '../../db/base-repository';

// ==================== Entity Interfaces ====================

export interface SLADefinitionEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  type: string; // response, resolution, availability
  target_value: number;
  target_unit: string; // minutes, hours, percent
  business_hours_only: boolean;
  priority: string | null; // critical, high, medium, low
  category: string | null;
  escalation_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: string; // active, inactive, archived
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SLATrackingEntity {
  id: string;
  tenant_id: string;
  sla_definition_id: string;
  entity_type: string; // incident, request, change
  entity_id: string;
  status: string; // tracking, met, breached, paused
  start_time: Date;
  target_time: Date;
  actual_time: Date | null;
  breach_time: Date | null;
  pause_duration: string; // PostgreSQL interval
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SLABreachEventEntity {
  id: string;
  tenant_id: string;
  sla_tracking_id: string;
  event_type: string; // warning, breach, escalation
  event_time: Date;
  details: Record<string, unknown>;
  notified_users: string[];
  created_at: Date;
}

// ==================== Create/Update Input Interfaces ====================

export interface CreateSLADefinitionInput {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  type?: string;
  targetValue: number;
  targetUnit?: string;
  businessHoursOnly?: boolean;
  priority?: string;
  category?: string;
  escalationRules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  createdBy?: string;
}

export interface UpdateSLADefinitionInput {
  name?: string;
  description?: string;
  type?: string;
  targetValue?: number;
  targetUnit?: string;
  businessHoursOnly?: boolean;
  priority?: string;
  category?: string;
  escalationRules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
}

export interface CreateSLATrackingInput {
  id?: string;
  tenantId: string;
  slaDefinitionId: string;
  entityType: string;
  entityId: string;
  status?: string;
  startTime?: Date;
  targetTime: Date;
  notes?: string;
}

export interface CreateSLABreachEventInput {
  id?: string;
  tenantId: string;
  slaTrackingId: string;
  eventType: string;
  details?: Record<string, unknown>;
  notifiedUsers?: string[];
}

// ==================== SLADefinitionRepository ====================

export class SLADefinitionRepository extends BaseRepository<SLADefinitionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sla_definitions');
  }

  /**
   * Create a new SLA definition
   */
  async createDefinition(input: CreateSLADefinitionInput): Promise<SLADefinitionEntity> {
    const result = await this.db.query(
      `INSERT INTO sla_definitions (id, tenant_id, name, description, type, target_value, target_unit, business_hours_only, priority, category, escalation_rules, metadata, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.tenantId,
        input.name,
        input.description || null,
        input.type || 'response',
        input.targetValue,
        input.targetUnit || 'minutes',
        input.businessHoursOnly ?? false,
        input.priority || null,
        input.category || null,
        JSON.stringify(input.escalationRules || {}),
        JSON.stringify(input.metadata || {}),
        input.status || 'active',
        input.createdBy || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update an SLA definition
   */
  async updateDefinition(id: string, input: UpdateSLADefinitionInput): Promise<SLADefinitionEntity | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(input.type);
    }
    if (input.targetValue !== undefined) {
      fields.push(`target_value = $${paramIndex++}`);
      values.push(input.targetValue);
    }
    if (input.targetUnit !== undefined) {
      fields.push(`target_unit = $${paramIndex++}`);
      values.push(input.targetUnit);
    }
    if (input.businessHoursOnly !== undefined) {
      fields.push(`business_hours_only = $${paramIndex++}`);
      values.push(input.businessHoursOnly);
    }
    if (input.priority !== undefined) {
      fields.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.escalationRules !== undefined) {
      fields.push(`escalation_rules = $${paramIndex++}`);
      values.push(JSON.stringify(input.escalationRules));
    }
    if (input.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (fields.length === 0) {
      const found = await this.findById(id);
      return found ?? null;
    }

    fields.push(`updated_at = NOW()`);
    const tenantId = this.getTenantId();
    values.push(tenantId);

    const result = await this.db.query(
      `UPDATE sla_definitions SET ${fields.join(', ')} WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1} RETURNING *`,
      [...values, id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find definitions by tenant with optional filters
   */
  async findByTenant(
    tenantId: string,
    filters?: { type?: string; status?: string; category?: string; limit?: number; offset?: number },
  ): Promise<FindAllResult<SLADefinitionEntity>> {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    let whereClause = 'WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.type) {
      whereClause += ` AND type = $${paramIndex++}`;
      params.push(filters.type);
    }
    if (filters?.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters?.category) {
      whereClause += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sla_definitions ${whereClause}`,
      params,
    );

    const result = await this.db.query(
      `SELECT * FROM sla_definitions ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Get statistics: count by status and type
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sla_definitions WHERE tenant_id = $1`,
      [tenantId],
    );

    const statusResult = await this.db.query(
      `SELECT status, COUNT(*) as count FROM sla_definitions WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );

    const typeResult = await this.db.query(
      `SELECT type, COUNT(*) as count FROM sla_definitions WHERE tenant_id = $1 GROUP BY type`,
      [tenantId],
    );

    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    const byType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      byType[row.type] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      byStatus,
      byType,
    };
  }

  protected mapRowToEntity(row: any): SLADefinitionEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      type: row.type ?? 'response',
      target_value: parseFloat(row.target_value),
      target_unit: row.target_unit ?? 'minutes',
      business_hours_only: row.business_hours_only ?? false,
      priority: row.priority,
      category: row.category,
      escalation_rules: typeof row.escalation_rules === 'string' ? JSON.parse(row.escalation_rules) : (row.escalation_rules ?? {}),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      status: row.status ?? 'active',
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== SLATrackingRepository ====================

export class SLATrackingRepository extends BaseRepository<SLATrackingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sla_tracking');
  }

  /**
   * Create a new tracking record
   */
  async createTracking(input: CreateSLATrackingInput): Promise<SLATrackingEntity> {
    const result = await this.db.query(
      `INSERT INTO sla_tracking (id, tenant_id, sla_definition_id, entity_type, entity_id, status, start_time, target_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.tenantId,
        input.slaDefinitionId,
        input.entityType,
        input.entityId,
        input.status || 'tracking',
        input.startTime || new Date(),
        input.targetTime,
        input.notes || null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Update tracking status
   */
  async updateStatus(id: string, status: string, tenantId: string): Promise<SLATrackingEntity | null> {
    const updateFields: Record<string, unknown> = { status };

    // Set actual_time for met/breached
    if (status === 'met' || status === 'breached') {
      const result = await this.db.query(
        `UPDATE sla_tracking SET status = $1, actual_time = NOW(), updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [status, id, tenantId],
      );
      if (result.rows.length === 0) return null;
      return this.mapRowToEntity(result.rows[0]);
    }

    // Set breach_time for breached
    if (status === 'breached') {
      const result = await this.db.query(
        `UPDATE sla_tracking SET status = $1, breach_time = NOW(), actual_time = NOW(), updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        [status, id, tenantId],
      );
      if (result.rows.length === 0) return null;
      return this.mapRowToEntity(result.rows[0]);
    }

    const result = await this.db.query(
      `UPDATE sla_tracking SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, id, tenantId],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find tracking records by tenant with optional filters
   */
  async findByTenant(
    tenantId: string,
    filters?: { status?: string; entityType?: string; entityId?: string; limit?: number; offset?: number },
  ): Promise<FindAllResult<SLATrackingEntity>> {
    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    let whereClause = 'WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters?.entityType) {
      whereClause += ` AND entity_type = $${paramIndex++}`;
      params.push(filters.entityType);
    }
    if (filters?.entityId) {
      whereClause += ` AND entity_id = $${paramIndex++}`;
      params.push(filters.entityId);
    }

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sla_tracking ${whereClause}`,
      params,
    );

    const result = await this.db.query(
      `SELECT * FROM sla_tracking ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Find tracking records by entity
   */
  async findByEntity(entityType: string, entityId: string, tenantId: string): Promise<SLATrackingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sla_tracking WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at DESC`,
      [tenantId, entityType, entityId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find all breached or actively tracking records (for breach detection)
   */
  async findActiveBreaches(tenantId: string): Promise<SLATrackingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sla_tracking
       WHERE tenant_id = $1
         AND status = 'tracking'
         AND target_time < NOW()
       ORDER BY target_time ASC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Get tracking statistics
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    breachRate: number;
  }> {
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sla_tracking WHERE tenant_id = $1`,
      [tenantId],
    );

    const statusResult = await this.db.query(
      `SELECT status, COUNT(*) as count FROM sla_tracking WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );

    const byStatus: Record<string, number> = {};
    for (const row of statusResult.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
    }

    const total = parseInt(totalResult.rows[0].count, 10);
    const breached = byStatus['breached'] || 0;
    const breachRate = total > 0 ? parseFloat(((breached / total) * 100).toFixed(2)) : 0;

    return { total, byStatus, breachRate };
  }

  protected mapRowToEntity(row: any): SLATrackingEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      sla_definition_id: row.sla_definition_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      status: row.status ?? 'tracking',
      start_time: row.start_time,
      target_time: row.target_time,
      actual_time: row.actual_time,
      breach_time: row.breach_time,
      pause_duration: row.pause_duration ?? '0',
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ==================== SLABreachEventRepository ====================

export class SLABreachEventRepository extends BaseRepository<SLABreachEventEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'sla_breach_events');
  }

  /**
   * Create a breach event
   */
  async createEvent(input: CreateSLABreachEventInput): Promise<SLABreachEventEntity> {
    const result = await this.db.query(
      `INSERT INTO sla_breach_events (id, tenant_id, sla_tracking_id, event_type, details, notified_users)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.id || crypto.randomUUID(),
        input.tenantId,
        input.slaTrackingId,
        input.eventType,
        JSON.stringify(input.details || {}),
        input.notifiedUsers || [],
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find breach events by tracking ID
   */
  async findByTrackingId(trackingId: string): Promise<SLABreachEventEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM sla_breach_events WHERE sla_tracking_id = $1 ORDER BY event_time DESC`,
      [trackingId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find breach events by tenant
   */
  async findByTenant(
    tenantId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<FindAllResult<SLABreachEventEntity>> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM sla_breach_events WHERE tenant_id = $1`,
      [tenantId],
    );

    const result = await this.db.query(
      `SELECT * FROM sla_breach_events WHERE tenant_id = $1 ORDER BY event_time DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );

    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  protected mapRowToEntity(row: any): SLABreachEventEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      sla_tracking_id: row.sla_tracking_id,
      event_type: row.event_type,
      event_time: row.event_time,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : (row.details ?? {}),
      notified_users: row.notified_users ?? [],
      created_at: row.created_at,
    };
  }
}
