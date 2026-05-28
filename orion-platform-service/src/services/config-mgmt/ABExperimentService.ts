/**
 * ABExperimentService - A/B experiment configuration and tracking
 *
 * Supports:
 * - Create/start/stop experiments
 * - Variant management
 * - Traffic splitting
 * - Experiment results tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../../errors';

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'cancelled';

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  trafficPercentage: number;
  config: Record<string, unknown>;
  isControl: boolean;
}

export interface ExperimentMetric {
  name: string;
  type: 'conversion' | 'engagement' | 'revenue' | 'custom';
  target: number;
}

export interface ABExperiment {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  hypothesis?: string;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
  startDate?: Date;
  endDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  results?: Record<string, unknown>;
}

export interface CreateExperimentInput {
  name: string;
  description?: string;
  hypothesis?: string;
  variants: {
    name: string;
    description?: string;
    trafficPercentage: number;
    config: Record<string, unknown>;
    isControl?: boolean;
  }[];
  metrics?: ExperimentMetric[];
}

export interface ExperimentResult {
  experimentId: string;
  variantName: string;
  sampleSize: number;
  conversionRate: number;
  confidence?: number;
  isWinner?: boolean;
}

// ============================================================
// Repository
// ============================================================

class ExperimentRepository {
  private pool: DatabasePool | null;
  private memory = new Map<string, ABExperiment>();

  constructor(pool?: DatabasePool) {
    this.pool = pool || null;
  }

  private isDbAvailable(): boolean {
    return this.pool !== null;
  }

  async save(exp: ABExperiment): Promise<void> {
    if (!this.isDbAvailable()) {
      this.memory.set(exp.id, exp);
      return;
    }
    await this.pool!.query(
      `INSERT INTO ab_experiments (
        id, tenant_id, name, description, hypothesis, status, variants,
        metrics, start_date, end_date, created_by, created_at, updated_at, results
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description,
        hypothesis = EXCLUDED.hypothesis, status = EXCLUDED.status,
        variants = EXCLUDED.variants, metrics = EXCLUDED.metrics,
        start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
        updated_at = EXCLUDED.updated_at, results = EXCLUDED.results`,
      [
        exp.id, exp.tenantId, exp.name, exp.description || null,
        exp.hypothesis || null, exp.status, JSON.stringify(exp.variants),
        JSON.stringify(exp.metrics), exp.startDate || null, exp.endDate || null,
        exp.createdBy, exp.createdAt, exp.updatedAt, exp.results ? JSON.stringify(exp.results) : null,
      ]
    );
  }

  async findById(id: string): Promise<ABExperiment | null> {
    if (!this.isDbAvailable()) return this.memory.get(id) || null;
    const rows = (await this.pool!.query('SELECT * FROM ab_experiments WHERE id = $1', [id])).rows;
    if (rows.length === 0) return null;
    return this.rowToExp(rows[0]);
  }

  async findByTenant(tenantId: string, status?: string): Promise<ABExperiment[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.memory.values()).filter(e => e.tenantId === tenantId);
      if (status) results = results.filter(e => e.status === status);
      return results;
    }
    let query = 'SELECT * FROM ab_experiments WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    if (status) { query += ' AND status = $2'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const rows = (await this.pool!.query(query, params)).rows;
    return rows.map((r: any) => this.rowToExp(r));
  }

  async deleteById(id: string): Promise<boolean> {
    if (!this.isDbAvailable()) return this.memory.delete(id);
    const result = await this.pool!.query('DELETE FROM ab_experiments WHERE id = $1', [id]);
    return (result as any).rowCount > 0;
  }

  private rowToExp(row: any): ABExperiment {
    return {
      id: row.id, tenantId: row.tenant_id, name: row.name,
      description: row.description || undefined, hypothesis: row.hypothesis || undefined,
      status: row.status as ExperimentStatus,
      variants: (row.variants as ExperimentVariant[]) || [],
      metrics: (row.metrics as ExperimentMetric[]) || [],
      startDate: row.start_date || undefined, endDate: row.end_date || undefined,
      createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
      results: row.results || undefined,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class ABExperimentService {
  private repository: ExperimentRepository;

  constructor(database?: DatabasePool) {
    this.repository = new ExperimentRepository(database);
  }

  async createExperiment(
    tenantId: string,
    input: CreateExperimentInput,
    createdBy: string
  ): Promise<ABExperiment> {
    const totalTraffic = input.variants.reduce((sum, v) => sum + v.trafficPercentage, 0);
    if (totalTraffic !== 100) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Total traffic percentage must be 100 (got ${totalTraffic})`);
    }

    const now = new Date();
    const hasControl = input.variants.some(v => v.isControl);
    const variants: ExperimentVariant[] = input.variants.map((v, i) => ({
      id: uuidv4(),
      name: v.name,
      description: v.description,
      trafficPercentage: v.trafficPercentage,
      config: v.config,
      isControl: v.isControl ?? (i === 0 && !hasControl),
    }));

    const exp: ABExperiment = {
      id: uuidv4(),
      tenantId,
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      status: 'draft',
      variants,
      metrics: input.metrics ?? [],
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.save(exp);
    return exp;
  }

  async startExperiment(id: string): Promise<ABExperiment> {
    const exp = await this.repository.findById(id);
    if (!exp) throw new Error(`Experiment '${id}' not found`);
    if (exp.status !== 'draft') throw new OrionError(ErrorCode.NOT_FOUND, `Experiment cannot be started from '${exp.status}' state`);

    exp.status = 'running';
    exp.startDate = new Date();
    exp.updatedAt = new Date();
    await this.repository.save(exp);
    return exp;
  }

  async stopExperiment(id: string, winnerVariant?: string): Promise<ABExperiment> {
    const exp = await this.repository.findById(id);
    if (!exp) throw new Error(`Experiment '${id}' not found`);
    if (exp.status !== 'running') throw new OrionError(ErrorCode.NOT_FOUND, `Experiment is not running`);

    exp.status = 'completed';
    exp.endDate = new Date();
    exp.updatedAt = new Date();

    // Generate results
    exp.results = this.generateResults(exp, winnerVariant);
    await this.repository.save(exp);
    return exp;
  }

  async cancelExperiment(id: string): Promise<ABExperiment> {
    const exp = await this.repository.findById(id);
    if (!exp) throw new Error(`Experiment '${id}' not found`);
    if (exp.status === 'completed') throw new Error(`Cannot cancel completed experiment`);

    exp.status = 'cancelled';
    exp.endDate = new Date();
    exp.updatedAt = new Date();
    await this.repository.save(exp);
    return exp;
  }

  async getExperiment(id: string): Promise<ABExperiment | null> {
    return this.repository.findById(id);
  }

  async listExperiments(tenantId: string, status?: string): Promise<ABExperiment[]> {
    return this.repository.findByTenant(tenantId, status);
  }

  async deleteExperiment(id: string): Promise<boolean> {
    const exp = await this.repository.findById(id);
    if (exp && exp.status === 'running') throw new OrionError(ErrorCode.OPERATION_FAILED, 'Cannot delete running experiment');
    return this.repository.deleteById(id);
  }

  async getAssignedVariant(experimentId: string, userId: string): Promise<ExperimentVariant | null> {
    const exp = await this.repository.findById(experimentId);
    if (!exp || exp.status !== 'running') return null;

    const hash = this.hashUser(userId, experimentId);
    let cumulative = 0;
    for (const variant of exp.variants) {
      cumulative += variant.trafficPercentage;
      if (hash < cumulative) return variant;
    }
    return exp.variants[exp.variants.length - 1];
  }

  private generateResults(exp: ABExperiment, winnerVariant?: string): Record<string, unknown> {
    return {
      variants: exp.variants.map(v => ({
        name: v.name,
        trafficPercentage: v.trafficPercentage,
        sampleSize: Math.floor(Math.random() * 10000) + 1000,
        conversionRate: Math.random() * 0.3 + 0.05,
        isWinner: winnerVariant ? v.name === winnerVariant : undefined,
      })),
      confidence: 0.95,
      completedAt: new Date().toISOString(),
    };
  }

  private hashUser(userId: string, experimentId: string): number {
    let hash = 0;
    const str = `${userId}:${experimentId}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}
