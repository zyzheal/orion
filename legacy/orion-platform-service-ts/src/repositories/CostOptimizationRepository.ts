/**
 * CostOptimizationRepository - PostgreSQL Repository for Cost Optimization
 */

import { DatabasePool } from '../services/database';
import { BaseRepository } from '../db/base-repository';

export interface CostRecommendationEntity {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  opportunities: Record<string, unknown>[];
  totalEstimatedSavings: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'applied' | 'rejected' | 'completed';
  createdAt: Date;
  appliedAt: Date | null;
}

export interface SavingsTrackingEntity {
  id: string;
  tenantId: string;
  recommendationId: string;
  month: string;
  actualSavings: number;
  estimatedSavings: number;
  achievementRate: number;
  recordedAt: Date;
}

export interface CreateRecommendationInput {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  opportunities: Record<string, unknown>[];
  totalEstimatedSavings: number;
  priority: 'high' | 'medium' | 'low';
}

export interface UpdateRecommendationInput {
  title?: string;
  description?: string;
  opportunities?: Record<string, unknown>[];
  totalEstimatedSavings?: number;
  priority?: 'high' | 'medium' | 'low';
  status?: 'pending' | 'applied' | 'rejected' | 'completed';
}

export class CostRecommendationRepository extends BaseRepository<CostRecommendationEntity> {
  constructor(db: DatabasePool) {
    super(db, 'cost_recommendations');
  }

  async findByTenant(tenantId: string): Promise<CostRecommendationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cost_recommendations WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string, tenantId: string): Promise<CostRecommendationEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cost_recommendations WHERE status = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [status, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createRecommendation(input: CreateRecommendationInput): Promise<CostRecommendationEntity> {
    const result = await this.db.query(
      `INSERT INTO cost_recommendations (id, tenant_id, title, description, opportunities, total_estimated_savings, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [
        input.id,
        input.tenantId,
        input.title,
        input.description || null,
        JSON.stringify(input.opportunities),
        input.totalEstimatedSavings,
        input.priority,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateRecommendation(id: string, input: UpdateRecommendationInput): Promise<CostRecommendationEntity | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      sets.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.opportunities !== undefined) {
      sets.push(`opportunities = $${paramIndex++}`);
      values.push(JSON.stringify(input.opportunities));
    }
    if (input.totalEstimatedSavings !== undefined) {
      sets.push(`total_estimated_savings = $${paramIndex++}`);
      values.push(input.totalEstimatedSavings);
    }
    if (input.priority !== undefined) {
      sets.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.status !== undefined) {
      sets.push(`status = $${paramIndex++}`);
      values.push(input.status);
      if (input.status === 'applied') {
        sets.push(`applied_at = NOW()`);
      }
    }

    if (sets.length === 0) {
      const result = await this.findById(id);
      return result ?? null;
    }

    values.push(id);
    const result = await this.db.query(
      `UPDATE cost_recommendations SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async deleteRecommendation(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM cost_recommendations WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): CostRecommendationEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      opportunities: row.opportunities || [],
      totalEstimatedSavings: parseFloat(row.total_estimated_savings) || 0,
      priority: row.priority || 'medium',
      status: row.status || 'pending',
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      appliedAt: row.applied_at ? new Date(row.applied_at) : null,
    };
  }
}

export class SavingsTrackingRepository extends BaseRepository<SavingsTrackingEntity> {
  constructor(db: DatabasePool) {
    super(db, 'savings_tracking');
  }

  async findByTenant(tenantId: string): Promise<SavingsTrackingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM savings_tracking WHERE tenant_id = $1 ORDER BY recorded_at DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByRecommendation(recommendationId: string): Promise<SavingsTrackingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM savings_tracking WHERE recommendation_id = $1 ORDER BY recorded_at DESC`,
      [recommendationId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenantAndMonth(tenantId: string, month: string): Promise<SavingsTrackingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM savings_tracking WHERE tenant_id = $1 AND month = $2 ORDER BY recorded_at DESC`,
      [tenantId, month],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async createRecord(input: Omit<SavingsTrackingEntity, 'id' | 'recordedAt'>): Promise<SavingsTrackingEntity> {
    const id = crypto.randomUUID();
    const result = await this.db.query(
      `INSERT INTO savings_tracking (id, tenant_id, recommendation_id, month, actual_savings, estimated_savings, achievement_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        input.tenantId,
        input.recommendationId,
        input.month,
        input.actualSavings,
        input.estimatedSavings,
        input.achievementRate,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): SavingsTrackingEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      recommendationId: row.recommendation_id,
      month: row.month,
      actualSavings: parseFloat(row.actual_savings) || 0,
      estimatedSavings: parseFloat(row.estimated_savings) || 0,
      achievementRate: parseInt(row.achievement_rate) || 0,
      recordedAt: row.recorded_at ? new Date(row.recorded_at) : new Date(),
    };
  }
}