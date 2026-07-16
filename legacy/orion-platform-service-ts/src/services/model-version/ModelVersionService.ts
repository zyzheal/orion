import { DatabasePool } from '../database';
/**
 * ModelVersionService - Business logic for AI Model Version Management
 *
 * Implements model versioning capabilities including:
 * - Model registration with version, type, features
 * - Model activation and deactivation
 * - A/B test configuration
 * - Model rollback to historical versions
 *
 * Phase 2 P0 Service
 */

// ==================== Types ====================

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface TrainingInfo {
  datasetVersion: string;
  trainingDate: Date | null;
  samplesCount: number;
  framework: string;
}

export interface ABTestConfig {
  trafficPercent: number;
  compareToId: string | null;
  startedAt: Date | null;
  results: Record<string, unknown> | null;
}

export interface AIModelVersion {
  id: string;
  tenant_id: string | null;
  name: string;
  model_type: string;
  version: string;
  status: 'registered' | 'testing' | 'active' | 'archived';
  features: string[];
  metrics: ModelMetrics;
  training_info: TrainingInfo;
  ab_test_config: ABTestConfig;
  created_by: string | null;
  created_at: Date;
}

export interface RegisterModelInput {
  tenant_id?: string;
  name: string;
  model_type: string;
  version: string;
  features?: string[];
  metrics?: Partial<ModelMetrics>;
  training_info?: Partial<TrainingInfo>;
  created_by?: string;
}

export interface ActivateModelInput {
  force?: boolean;
}

export interface ConfigureABTestInput {
  traffic_percent: number;
  compare_to_id: string;
}

export interface ListModelsOptions {
  type?: string;
  status?: string;
  tenant_id?: string;
  page?: number;
  limit?: number;
}

export class ModelVersionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ModelVersionServiceError';
  }
}

// ==================== Repository ====================

export class ModelVersionRepository {

  constructor(private pool: DatabasePool) {}

  async findById(id: string): Promise<AIModelVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM ai_model_versions WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByTypeAndVersion(modelType: string, version: string): Promise<AIModelVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM ai_model_versions WHERE model_type = $1 AND version = $2',
      [modelType, version]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findActiveByType(modelType: string): Promise<AIModelVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM ai_model_versions 
       WHERE model_type = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [modelType]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(options: ListModelsOptions): Promise<{ data: AIModelVersion[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (options.type) {
      conditions.push(`model_type = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    if (options.tenant_id) {
      conditions.push(`tenant_id = $${paramIndex}`);
      params.push(options.tenant_id);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM ai_model_versions ${whereClause}`,
      params
    );

    const dataResult = await this.pool.query(
      `SELECT * FROM ai_model_versions ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows.map(row => this.mapRow(row)),
      total: parseInt(countResult.rows[0].total),
    };
  }

  async create(input: RegisterModelInput): Promise<AIModelVersion> {
    const result = await this.pool.query(
      `INSERT INTO ai_model_versions 
        (tenant_id, name, model_type, version, status, features, metrics, training_info, ab_test_config, created_by)
       VALUES ($1, $2, $3, $4, 'registered', $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.tenant_id || null,
        input.name,
        input.model_type,
        input.version,
        input.features || [],
        JSON.stringify(input.metrics || { accuracy: 0, precision: 0, recall: 0, f1Score: 0 }),
        JSON.stringify(input.training_info || {}),
        JSON.stringify({}),
        input.created_by || null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async updateStatus(id: string, status: string): Promise<AIModelVersion | null> {
    const result = await this.pool.query(
      `UPDATE ai_model_versions 
       SET status = $2
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateABTestConfig(id: string, config: ABTestConfig): Promise<AIModelVersion | null> {
    const result = await this.pool.query(
      `UPDATE ai_model_versions 
       SET ab_test_config = $2
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(config)]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE ai_model_versions 
       SET status = 'archived'
       WHERE id = $1 AND status != 'archived'`,
      [id]
    );
    return result.rowCount > 0;
  }

  private mapRow(row: any): AIModelVersion {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      model_type: row.model_type,
      version: row.version,
      status: row.status,
      features: row.features || [],
      metrics: row.metrics || { accuracy: 0, precision: 0, recall: 0, f1Score: 0 },
      training_info: row.training_info || {},
      ab_test_config: row.ab_test_config || {},
      created_by: row.created_by,
      created_at: row.created_at,
    };
  }
}

// ==================== Service ====================

export class ModelVersionService {
  private repository: ModelVersionRepository;

  constructor(private pool: DatabasePool) {
    this.repository = new ModelVersionRepository(this.pool);
  }

  /**
   * Register a new model version
   */
  async registerModel(input: RegisterModelInput): Promise<AIModelVersion> {
    // Check for duplicate
    const existing = await this.repository.findByTypeAndVersion(input.model_type, input.version);
    if (existing) {
      throw new ModelVersionServiceError(
        `Model ${input.model_type} version ${input.version} already exists`,
        'DUPLICATE_MODEL'
      );
    }

    return this.repository.create(input);
  }

  /**
   * Get model by ID
   */
  async getModel(modelId: string): Promise<AIModelVersion> {
    const model = await this.repository.findById(modelId);
    if (!model) {
      throw new ModelVersionServiceError(
        `Model not found: ${modelId}`,
        'MODEL_NOT_FOUND'
      );
    }
    return model;
  }

  /**
   * List models with filtering
   */
  async listModels(options: ListModelsOptions): Promise<{
    data: AIModelVersion[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const result = await this.repository.list(options);
    return { ...result, page, limit };
  }

  /**
   * Get active model for a type
   */
  async getActiveModel(modelType: string): Promise<AIModelVersion | null> {
    return this.repository.findActiveByType(modelType);
  }

  /**
   * Activate a model (set as active, deactivate previous)
   */
  async activateModel(modelId: string, input: ActivateModelInput): Promise<{
    id: string;
    status: string;
    previousActiveId: string | null;
  }> {
    const model = await this.getModel(modelId);

    // Check model is in valid state for activation
    if (model.status === 'archived') {
      throw new ModelVersionServiceError(
        'Cannot activate archived model',
        'INVALID_STATUS'
      );
    }

    // Find current active model for this type
    const currentActive = await this.repository.findActiveByType(model.model_type);
    const previousActiveId = currentActive?.id || null;

    // If current active exists and not forcing, check if they're different
    if (currentActive && currentActive.id === modelId) {
      return { id: modelId, status: 'active', previousActiveId };
    }

    // Deactivate current active if exists
    if (currentActive && !input.force) {
      // Could add check for running predictions here
    }

    if (currentActive) {
      await this.repository.updateStatus(currentActive.id, 'testing');
    }

    // Activate new model
    await this.repository.updateStatus(modelId, 'active');

    return { id: modelId, status: 'active', previousActiveId };
  }

  /**
   * Configure A/B test between models
   */
  async configureABTest(modelId: string, input: ConfigureABTestInput): Promise<{
    id: string;
    ab_test_config: ABTestConfig;
  }> {
    const model = await this.getModel(modelId);
    const compareModel = await this.getModel(input.compare_to_id);

    // Validate models are same type
    if (model.model_type !== compareModel.model_type) {
      throw new ModelVersionServiceError(
        'A/B test models must be of same type',
        'INVALID_AB_TEST'
      );
    }

    // Validate traffic percent
    if (input.traffic_percent < 1 || input.traffic_percent > 100) {
      throw new ModelVersionServiceError(
        'Traffic percent must be between 1 and 100',
        'INVALID_TRAFFIC_PERCENT'
      );
    }

    const abConfig: ABTestConfig = {
      trafficPercent: input.traffic_percent,
      compareToId: input.compare_to_id,
      startedAt: new Date(),
      results: null,
    };

    const updated = await this.repository.updateABTestConfig(modelId, abConfig);
    return { id: modelId, ab_test_config: updated!.ab_test_config };
  }

  /**
   * Rollback to a historical model version
   */
  async rollback(modelId: string): Promise<AIModelVersion> {
    const model = await this.getModel(modelId);

    if (model.status === 'active') {
      throw new ModelVersionServiceError(
        'Cannot rollback active model',
        'ALREADY_ACTIVE'
      );
    }

    await this.activateModel(modelId, { force: true });
    return this.getModel(modelId);
  }

  /**
   * Archive a model (soft delete)
   */
  async archiveModel(modelId: string): Promise<{ success: boolean }> {
    const model = await this.getModel(modelId);

    if (model.status === 'active') {
      throw new ModelVersionServiceError(
        'Cannot archive active model',
        'MODEL_ACTIVE'
      );
    }

    const deleted = await this.repository.softDelete(modelId);
    return { success: deleted };
  }

  /**
   * Get model metrics history
   */
  async getModelMetricsHistory(modelType: string): Promise<{
    versions: Array<{
      version: string;
      metrics: ModelMetrics;
      status: string;
      created_at: Date;
    }>;
  }> {
    const result = await this.pool.query(
      `SELECT version, metrics, status, created_at 
       FROM ai_model_versions 
       WHERE model_type = $1
       ORDER BY created_at DESC`,
      [modelType]
    );

    return {
      versions: result.rows.map(row => ({
        version: row.version,
        metrics: row.metrics || { accuracy: 0, precision: 0, recall: 0, f1Score: 0 },
        status: row.status,
        created_at: row.created_at,
      })),
    };
  }

  /**
   * Compare two model versions
   */
  async compareModels(modelId1: string, modelId2: string): Promise<{
    model1: AIModelVersion;
    model2: AIModelVersion;
    metricsDiff: Record<string, number>;
    featuresDiff: {
      added: string[];
      removed: string[];
    };
  }> {
    const model1 = await this.getModel(modelId1);
    const model2 = await this.getModel(modelId2);

    const metricsDiff: Record<string, number> = {};
    for (const key of ['accuracy', 'precision', 'recall', 'f1Score'] as const) {
      metricsDiff[key] = model2.metrics[key] - model1.metrics[key];
    }

    const features1 = new Set(model1.features);
    const features2 = new Set(model2.features);
    const added = Array.from(features2).filter(f => !features1.has(f));
    const removed = Array.from(features1).filter(f => !features2.has(f));

    return { model1, model2, metricsDiff, featuresDiff: { added, removed } };
  }
}