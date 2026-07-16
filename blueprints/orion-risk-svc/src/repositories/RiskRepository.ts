/**
 * Risk Repository - 风险评估数据访问层
 * PostgreSQL Repository pattern implementation
 */

import { query } from '../utils/database.js';
import {
  RiskAssessment,
  RiskScore,
  RiskEvent,
  RiskQuery,
  RiskCategory,
  RiskLevel,
  RiskStatus,
  AssessmentStatus,
} from '../types/risk.js';

// ============================================================
// Row mappers
// ============================================================

function mapRowToRiskAssessment(row: Record<string, unknown>): RiskAssessment {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    status: row.status as AssessmentStatus,
    assessorId: row.assessor_id as string,
    tenantId: row.tenant_id as string,
    metadata: (row.metadata as Record<string, unknown>) || {},
    completedAt: row.completed_at ? (row.completed_at as Date) : undefined,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    events: [],
    overallScore: undefined,
  };
}

function mapRowToRiskEvent(row: Record<string, unknown>): RiskEvent {
  return {
    id: row.id as string,
    assessmentId: row.assessment_id as string,
    category: row.category as RiskCategory,
    level: row.level as RiskLevel,
    title: row.title as string,
    description: row.description as string,
    impact: row.impact as string,
    impactScore: Number(row.impact_score),
    probabilityScore: Number(row.probability_score),
    riskValue: Number(row.risk_value),
    recommendation: (row.recommendation as string) || undefined,
    assigneeId: (row.assignee_id as string) || undefined,
    status: row.status as RiskStatus,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

function mapRowToRiskScore(row: Record<string, unknown>): RiskScore {
  return {
    id: row.id as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    totalScore: Number(row.total_score),
    dimensionScores: (row.dimension_scores as Record<string, number>) || {},
    riskLevel: row.risk_level as RiskLevel,
    assessedAt: row.assessed_at as Date,
    expiresAt: row.expires_at as Date,
    comment: (row.comment as string) || undefined,
  };
}

// ============================================================
// Assessment Repository
// ============================================================

export const AssessmentRepository = {
  async create(data: {
    name: string;
    description?: string;
    entityType: string;
    entityId: string;
    status: AssessmentStatus;
    assessorId: string;
    tenantId: string;
    metadata?: Record<string, unknown>;
  }): Promise<RiskAssessment> {
    const result = await query(`
      INSERT INTO risk_assessments (
        name, description, entity_type, entity_id, status,
        assessor_id, tenant_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.name,
      data.description || null,
      data.entityType,
      data.entityId,
      data.status,
      data.assessorId,
      data.tenantId,
      JSON.stringify(data.metadata || {}),
    ]);
    return mapRowToRiskAssessment(result.rows[0]);
  },

  async findById(id: string): Promise<RiskAssessment | null> {
    const result = await query('SELECT * FROM risk_assessments WHERE id = $1', [id]);
    return result.rows.length > 0 ? mapRowToRiskAssessment(result.rows[0]) : null;
  },

  async findWithEvents(id: string): Promise<RiskAssessment | null> {
    const assessmentResult = await query('SELECT * FROM risk_assessments WHERE id = $1', [id]);
    if (assessmentResult.rows.length === 0) return null;

    const assessment = mapRowToRiskAssessment(assessmentResult.rows[0]);

    // Fetch associated events
    const eventsResult = await query(
      'SELECT * FROM risk_events WHERE assessment_id = $1 ORDER BY created_at DESC',
      [id]
    );
    assessment.events = eventsResult.rows.map(mapRowToRiskEvent);

    // Fetch latest score
    const scoreResult = await query(
      `SELECT * FROM risk_scores
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY assessed_at DESC LIMIT 1`,
      [assessment.entityType, assessment.entityId]
    );
    if (scoreResult.rows.length > 0) {
      assessment.overallScore = mapRowToRiskScore(scoreResult.rows[0]);
    }

    return assessment;
  },

  async update(id: string, updates: Partial<{
    name: string;
    description: string;
    status: AssessmentStatus;
    metadata: Record<string, unknown>;
    completedAt: Date;
  }>): Promise<RiskAssessment | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(updates.metadata));
    }
    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      params.push(updates.completedAt);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE risk_assessments SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows.length > 0 ? mapRowToRiskAssessment(result.rows[0]) : null;
  },

  async findMany(q: RiskQuery): Promise<{ items: RiskAssessment[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (q.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(q.entityType);
    }
    if (q.entityId) {
      conditions.push(`entity_id = $${paramIndex++}`);
      params.push(q.entityId);
    }
    if (q.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(q.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM risk_assessments ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].cnt, 10);

    const sortBy = q.sortBy === 'name' ? 'name' : 'created_at';
    const sortOrder = q.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const pageSize = q.pageSize || 20;
    const page = q.page || 1;
    const offset = (page - 1) * pageSize;

    const dataResult = await query(
      `SELECT * FROM risk_assessments ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    return {
      items: dataResult.rows.map(mapRowToRiskAssessment),
      total,
    };
  },
};

// ============================================================
// Risk Event Repository
// ============================================================

export const RiskEventRepository = {
  async create(data: {
    assessmentId: string;
    category: RiskCategory;
    level: RiskLevel;
    title: string;
    description: string;
    impact: string;
    impactScore: number;
    probabilityScore: number;
    riskValue: number;
    recommendation?: string;
    assigneeId?: string;
    status?: RiskStatus;
  }): Promise<RiskEvent> {
    const result = await query(`
      INSERT INTO risk_events (
        assessment_id, category, level, title, description, impact,
        impact_score, probability_score, risk_value, recommendation, assignee_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      data.assessmentId,
      data.category,
      data.level,
      data.title,
      data.description,
      data.impact,
      data.impactScore,
      data.probabilityScore,
      data.riskValue,
      data.recommendation || null,
      data.assigneeId || null,
      data.status || RiskStatus.IDENTIFIED,
    ]);
    return mapRowToRiskEvent(result.rows[0]);
  },

  async findById(id: string): Promise<RiskEvent | null> {
    const result = await query('SELECT * FROM risk_events WHERE id = $1', [id]);
    return result.rows.length > 0 ? mapRowToRiskEvent(result.rows[0]) : null;
  },

  async findByAssessmentId(assessmentId: string): Promise<RiskEvent[]> {
    const result = await query(
      'SELECT * FROM risk_events WHERE assessment_id = $1 ORDER BY created_at DESC',
      [assessmentId]
    );
    return result.rows.map(mapRowToRiskEvent);
  },

  async updateStatus(id: string, status: RiskStatus): Promise<RiskEvent | null> {
    const result = await query(
      `UPDATE risk_events SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows.length > 0 ? mapRowToRiskEvent(result.rows[0]) : null;
  },

  async findMany(q: RiskQuery): Promise<{ items: RiskEvent[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (q.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(q.category);
    }
    if (q.level) {
      conditions.push(`level = $${paramIndex++}`);
      params.push(q.level);
    }
    if (q.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(q.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM risk_events ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].cnt, 10);

    const sortBy = q.sortBy === 'riskValue' ? 'risk_value' : q.sortBy === 'title' ? 'title' : 'created_at';
    const sortOrder = q.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const pageSize = q.pageSize || 20;
    const page = q.page || 1;
    const offset = (page - 1) * pageSize;

    const dataResult = await query(
      `SELECT * FROM risk_events ${whereClause}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, pageSize, offset]
    );

    return {
      items: dataResult.rows.map(mapRowToRiskEvent),
      total,
    };
  },
};

// ============================================================
// Risk Score Repository
// ============================================================

export const RiskScoreRepository = {
  async upsert(data: {
    entityType: string;
    entityId: string;
    totalScore: number;
    dimensionScores: Record<string, number>;
    riskLevel: RiskLevel;
    comment?: string;
    expiresAt: Date;
  }): Promise<RiskScore> {
    const result = await query(`
      INSERT INTO risk_scores (
        entity_type, entity_id, total_score, dimension_scores,
        risk_level, comment, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      data.entityType,
      data.entityId,
      data.totalScore,
      JSON.stringify(data.dimensionScores),
      data.riskLevel,
      data.comment || null,
      data.expiresAt,
    ]);
    return mapRowToRiskScore(result.rows[0]);
  },

  async findByEntity(entityType: string, entityId: string): Promise<RiskScore | null> {
    const result = await query(
      `SELECT * FROM risk_scores
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY assessed_at DESC LIMIT 1`,
      [entityType, entityId]
    );
    return result.rows.length > 0 ? mapRowToRiskScore(result.rows[0]) : null;
  },
};
