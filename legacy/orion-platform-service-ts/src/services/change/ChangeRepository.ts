/**
 * Change Management Repositories
 *
 * ChangeRequestRepository: ITIL change request lifecycle management
 * CABMeetingRepository: Change Advisory Board meeting management
 * ChangeTimelineRepository: Change request timeline events
 * RFCRepository: Request for Change linked to change requests
 */

import { BaseRepository } from '../../db/base-repository';

// ==================== Entity Types ====================

export interface ChangeRequestEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  type: string; // standard, normal, emergency
  category: string | null;
  priority: string; // critical, high, medium, low
  riskLevel: string; // high, medium, low
  status: string; // draft, submitted, approved, rejected, in_progress, completed, cancelled, closed
  impactDescription: string | null;
  rollbackPlan: string | null;
  implementationPlan: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  requesterId: string | null;
  assignedTo: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  relatedIncidents: string[];
  relatedProblems: string[];
  affectedServices: string[];
  metadata: Record<string, any>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CABMeetingEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  location: string | null;
  attendees: string[];
  status: string; // scheduled, in_progress, completed, cancelled
  minutes: string | null;
  decisions: CABDecision[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CABDecision {
  changeRequestId: string;
  decision: string; // approved, rejected, deferred
  notes?: string;
}

export interface ChangeTimelineEntity {
  id: string;
  tenantId: string;
  changeRequestId: string;
  eventType: string; // status_change, comment, approval, rejection, assignment
  description: string;
  createdBy: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface RFCEntity {
  id: string;
  tenantId: string;
  changeRequestId: string;
  rfcNumber: string;
  justification: string | null;
  riskAssessment: string | null;
  testPlan: string | null;
  communicationPlan: string | null;
  backoutPlan: string | null;
  cabMeetingId: string | null;
  status: string; // draft, pending_review, approved, rejected
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Filter Types ====================

export interface ChangeRequestFilters {
  status?: string;
  type?: string;
  priority?: string;
  riskLevel?: string;
  assignedTo?: string;
  requesterId?: string;
  limit?: number;
  offset?: number;
}

export interface CABMeetingFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ChangeStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

// ==================== ChangeRequestRepository ====================

export class ChangeRequestRepository extends BaseRepository<ChangeRequestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_requests');
  }

  async findByTenant(tenantId: string, filters: ChangeRequestFilters = {}): Promise<{ entities: ChangeRequestEntity[]; total: number }> {
    const { status, type, priority, riskLevel, assignedTo, requesterId, limit = 20, offset = 0 } = filters;

    let query = `SELECT * FROM change_requests WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    if (priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }
    if (riskLevel) {
      query += ` AND risk_level = $${paramIndex}`;
      params.push(riskLevel);
      paramIndex++;
    }
    if (assignedTo) {
      query += ` AND assigned_to = $${paramIndex}`;
      params.push(assignedTo);
      paramIndex++;
    }
    if (requesterId) {
      query += ` AND requester_id = $${paramIndex}`;
      params.push(requesterId);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<ChangeRequestEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM change_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string, tenantId: string, extraFields: Record<string, any> = {}): Promise<ChangeRequestEntity | null> {
    const setClauses = [`status = $1`, `updated_at = NOW()`];
    const params: any[] = [status];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(extraFields)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      setClauses.push(`${snakeKey} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    params.push(id, tenantId);
    const query = `
      UPDATE change_requests
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;
    const result = await this.db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async getStats(tenantId: string): Promise<ChangeStats> {
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count FROM change_requests WHERE tenant_id = $1`,
      [tenantId],
    );

    const statusResult = await this.db.query(
      `SELECT status, COUNT(*) as count FROM change_requests WHERE tenant_id = $1 GROUP BY status`,
      [tenantId],
    );

    const typeResult = await this.db.query(
      `SELECT type, COUNT(*) as count FROM change_requests WHERE tenant_id = $1 GROUP BY type`,
      [tenantId],
    );

    const priorityResult = await this.db.query(
      `SELECT priority, COUNT(*) as count FROM change_requests WHERE tenant_id = $1 GROUP BY priority`,
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

    const byPriority: Record<string, number> = {};
    for (const row of priorityResult.rows) {
      byPriority[row.priority] = parseInt(row.count, 10);
    }

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      byStatus,
      byType,
      byPriority,
    };
  }

  protected mapRowToEntity(row: any): ChangeRequestEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      type: row.type,
      category: row.category,
      priority: row.priority,
      riskLevel: row.risk_level,
      status: row.status,
      impactDescription: row.impact_description,
      rollbackPlan: row.rollback_plan,
      implementationPlan: row.implementation_plan,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      actualStart: row.actual_start,
      actualEnd: row.actual_end,
      requesterId: row.requester_id,
      assignedTo: row.assigned_to,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectedBy: row.rejected_by,
      rejectedAt: row.rejected_at,
      rejectionReason: row.rejection_reason,
      relatedIncidents: row.related_incidents ?? [],
      relatedProblems: row.related_problems ?? [],
      affectedServices: row.affected_services ?? [],
      metadata: row.metadata ?? {},
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== CABMeetingRepository ====================

export class CABMeetingRepository extends BaseRepository<CABMeetingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cab_meetings');
  }

  async findByTenant(tenantId: string, filters: CABMeetingFilters = {}): Promise<{ entities: CABMeetingEntity[]; total: number }> {
    const { status, limit = 20, offset = 0 } = filters;

    let query = `SELECT * FROM cab_meetings WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY scheduled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<CABMeetingEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM cab_meetings WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async addDecision(meetingId: string, decision: CABDecision, tenantId: string): Promise<CABMeetingEntity | null> {
    const query = `
      UPDATE cab_meetings
      SET decisions = COALESCE(decisions, '[]'::jsonb) || $1::jsonb,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await this.db.query(query, [JSON.stringify(decision), meetingId, tenantId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): CABMeetingEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      scheduledAt: row.scheduled_at,
      location: row.location,
      attendees: row.attendees ?? [],
      status: row.status,
      minutes: row.minutes,
      decisions: row.decisions ?? [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ==================== ChangeTimelineRepository ====================

export class ChangeTimelineRepository extends BaseRepository<ChangeTimelineEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'change_timeline');
  }

  async findByChangeId(changeRequestId: string, limit = 50, offset = 0): Promise<ChangeTimelineEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM change_timeline WHERE change_request_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [changeRequestId, limit, offset],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ChangeTimelineEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      changeRequestId: row.change_request_id,
      eventType: row.event_type,
      description: row.description,
      createdBy: row.created_by,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  }
}

// ==================== RFCRepository ====================

export class RFCRepository extends BaseRepository<RFCEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'rfcs');
  }

  async findByChangeId(changeRequestId: string): Promise<RFCEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM rfcs WHERE change_request_id = $1 ORDER BY created_at DESC`,
      [changeRequestId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<RFCEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM rfcs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string, limit = 20, offset = 0): Promise<{ entities: RFCEntity[]; total: number }> {
    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM rfcs WHERE tenant_id = $1`,
      [tenantId],
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM rfcs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );
    return {
      entities: result.rows.map(row => this.mapRowToEntity(row)),
      total,
    };
  }

  async updateStatus(id: string, status: string, tenantId: string): Promise<RFCEntity | null> {
    const query = `
      UPDATE rfcs
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await this.db.query(query, [status, id, tenantId]);
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): RFCEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      changeRequestId: row.change_request_id,
      rfcNumber: row.rfc_number,
      justification: row.justification,
      riskAssessment: row.risk_assessment,
      testPlan: row.test_plan,
      communicationPlan: row.communication_plan,
      backoutPlan: row.backout_plan,
      cabMeetingId: row.cab_meeting_id,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
