/**
 * ModelVersion Repository
 *
 * PostgreSQL persistence for model versions and A/B tests.
 */
import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

// ==================== Model Version ====================

export interface ModelVersionEntity {
  id: string;
  name: string;
  version: string;
  status: string;
  framework: string;
  description: string | null;
  metadata: Record<string, any> | null;
  training_date: Date | null;
  training_data_size: number | null;
  hyperparameters: Record<string, any> | null;
  metrics: Record<string, any>;
  registered_at: Date;
  registered_by: string | null;
  activated_at: Date | null;
  deprecated_at: Date | null;
  tags: string[] | null;
}

export class ModelVersionRepository extends BaseRepository<ModelVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'model_versions');
  }

  async findByNameAndVersion(name: string, version: string): Promise<ModelVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM model_versions WHERE name = $1 AND version = $2 LIMIT 1`,
      [name, version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByName(name: string, includeAll = false): Promise<ModelVersionEntity[]> {
    let query = `SELECT * FROM model_versions WHERE name = $1`;
    const params: any[] = [name];
    if (!includeAll) {
      query += ` AND status NOT IN ('deprecated', 'archived')`;
    }
    query += ` ORDER BY registered_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findActiveByName(name: string): Promise<ModelVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM model_versions WHERE name = $1 AND status = 'active' ORDER BY activated_at DESC LIMIT 1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findAllActive(): Promise<ModelVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM model_versions WHERE status = 'active' ORDER BY name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async listAll(options?: { status?: string; framework?: string; name?: string }): Promise<ModelVersionEntity[]> {
    let query = `SELECT * FROM model_versions WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }
    if (options?.framework) {
      query += ` AND framework = $${paramIndex}`;
      params.push(options.framework);
      paramIndex++;
    }
    if (options?.name) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${options.name}%`);
      paramIndex++;
    }

    query += ` ORDER BY registered_at DESC`;
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateMetrics(id: string, metrics: Record<string, any>): Promise<ModelVersionEntity> {
    const result = await this.db.query(
      `UPDATE model_versions SET metrics = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(metrics), id],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.NOT_FOUND, `Model version ${id} not found`);
    return this.mapRowToEntity(result.rows[0]);
  }

  async clearActiveByName(name: string): Promise<void> {
    await this.db.query(
      `UPDATE model_versions SET activated_at = NULL, status = 'registered', updated_at = NOW() WHERE name = $1 AND status = 'active'`,
      [name],
    );
  }

  protected mapRowToEntity(row: any): ModelVersionEntity {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      status: row.status ?? 'registered',
      framework: row.framework,
      description: row.description,
      metadata: row.metadata,
      training_date: row.training_date,
      training_data_size: row.training_data_size,
      hyperparameters: row.hyperparameters,
      metrics: row.metrics ?? {},
      registered_at: row.registered_at,
      registered_by: row.registered_by,
      activated_at: row.activated_at,
      deprecated_at: row.deprecated_at,
      tags: row.tags,
    };
  }
}

// ==================== A/B Test ====================

export interface ABTestEntity {
  id: string;
  model_name: string;
  variants: Record<string, any>[];
  traffic_split: Record<string, number>;
  start_date: Date;
  end_date: Date | null;
  target_metrics: string[];
  status: string;
}

export class ABTestRepository extends BaseRepository<ABTestEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ab_tests');
  }

  async findByName(modelName: string): Promise<ABTestEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ab_tests WHERE model_name = $1 LIMIT 1`,
      [modelName],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateStatus(id: string, status: string): Promise<ABTestEntity> {
    const result = await this.db.query(
      `UPDATE ab_tests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.NOT_FOUND, `AB test ${id} not found`);
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ABTestEntity {
    return {
      id: row.id,
      model_name: row.model_name,
      variants: row.variants ?? [],
      traffic_split: row.traffic_split ?? {},
      start_date: row.start_date,
      end_date: row.end_date,
      target_metrics: row.target_metrics ?? [],
      status: row.status ?? 'running',
    };
  }
}

// ==================== A/B Test Metrics ====================

export interface ABTestMetricEntity {
  id: string;
  ab_test_id: string;
  model_id: string;
  metrics: Record<string, any>;
  request_count: number;
}

export class ABTestMetricRepository extends BaseRepository<ABTestMetricEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'ab_test_metrics');
  }

  async findByABTest(abTestId: string): Promise<ABTestMetricEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ab_test_metrics WHERE ab_test_id = $1`,
      [abTestId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByABTestAndModel(abTestId: string, modelId: string): Promise<ABTestMetricEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM ab_test_metrics WHERE ab_test_id = $1 AND model_id = $2 LIMIT 1`,
      [abTestId, modelId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async incrementRequestCount(id: string): Promise<ABTestMetricEntity> {
    const result = await this.db.query(
      `UPDATE ab_test_metrics SET request_count = request_count + 1 WHERE id = $1 RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.NOT_FOUND, `AB test metric ${id} not found`);
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateMetrics(id: string, metrics: Record<string, any>): Promise<ABTestMetricEntity> {
    const result = await this.db.query(
      `UPDATE ab_test_metrics SET metrics = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(metrics), id],
    );
    if (result.rows.length === 0) throw new OrionError(ErrorCode.NOT_FOUND, `AB test metric ${id} not found`);
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ABTestMetricEntity {
    return {
      id: row.id,
      ab_test_id: row.ab_test_id,
      model_id: row.model_id,
      metrics: row.metrics ?? {},
      request_count: row.request_count ?? 0,
    };
  }
}
