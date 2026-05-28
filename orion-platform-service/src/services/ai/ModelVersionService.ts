/**
 * Model Version Service — 模型版本管理服务
 *
 * 功能：
 * 1. 模型注册/版本管理/激活
 * 2. A/B 测试支持
 * 3. 模型性能监控
 *
 * Uses PostgreSQL Repository pattern for persistence.
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import {
  ModelVersionRepository,
  ModelVersionEntity,
  ABTestRepository,
  ABTestEntity,
  ABTestMetricRepository,
  ABTestMetricEntity,
} from '../../repositories/ModelVersionRepository';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== 类型定义 ====================

export type ModelStatus = 'registered' | 'active' | 'deprecated' | 'archived';
export type ModelFramework = 'openai' | 'anthropic' | 'custom' | 'rule-based' | 'transformer';

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  avgLatency?: number;
  p95Latency?: number;
  p99Latency?: number;
  throughput?: number;
  errorRate?: number;
  totalPredictions?: number;
  totalCost?: number;
}

export interface ModelVersion {
  id: string;
  name: string;
  version: string;
  status: ModelStatus;
  framework: ModelFramework;
  description?: string;
  metadata?: Record<string, unknown>;
  trainingDate?: Date;
  trainingDataSize?: number;
  hyperparameters?: Record<string, unknown>;
  metrics: ModelMetrics;
  registeredAt: Date;
  registeredBy?: string;
  activatedAt?: Date;
  deprecatedAt?: Date;
  tags?: string[];
}

export interface ABTestConfig {
  modelName: string;
  variants: ABTestVariant[];
  trafficSplit: Record<string, number>;
  startDate: Date;
  endDate?: Date;
  targetMetrics: string[];
  status: 'running' | 'completed' | 'paused';
}

export interface ABTestVariant {
  modelId: string;
  name: string;
  description?: string;
}

export interface ABTestResult {
  config: ABTestConfig;
  results: ABTestVariantResult[];
  winner?: string;
  statisticalSignificance?: number;
  conclusion?: string;
  generatedAt: Date;
}

export interface ABTestVariantResult {
  modelId: string;
  name: string;
  metrics: ModelMetrics;
  requestCount: number;
  successRate: number;
  userFeedbackScore?: number;
}

export interface ModelRegistrationInput {
  name: string;
  version: string;
  framework: ModelFramework;
  description?: string;
  metadata?: Record<string, unknown>;
  trainingDate?: Date;
  trainingDataSize?: number;
  hyperparameters?: Record<string, unknown>;
  metrics?: Partial<ModelMetrics>;
  registeredBy?: string;
  tags?: string[];
}

// ==================== 核心服务类 ====================

export class ModelVersionService {
  private modelRepo: ModelVersionRepository;
  private abTestRepo: ABTestRepository;
  private abTestMetricRepo: ABTestMetricRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.modelRepo = new ModelVersionRepository(db);
    this.abTestRepo = new ABTestRepository(db);
    this.abTestMetricRepo = new ABTestMetricRepository(db);
  }

  /**
   * 注册模型版本
   */
  async registerModel(input: ModelRegistrationInput): Promise<ModelVersion> {
    // 检查是否已存在相同名称+版本的模型
    const existing = await this.modelRepo.findByNameAndVersion(input.name, input.version);
    if (existing) {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'Invalid model version');
    }

    const now = new Date();
    const id = `model-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const entity = await this.modelRepo.create({
      id,
      name: input.name,
      version: input.version,
      status: 'registered',
      framework: input.framework,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      training_date: input.trainingDate ?? null,
      training_data_size: input.trainingDataSize ?? null,
      hyperparameters: input.hyperparameters ?? null,
      metrics: {
        accuracy: input.metrics?.accuracy,
        precision: input.metrics?.precision,
        recall: input.metrics?.recall,
        f1Score: input.metrics?.f1Score,
        avgLatency: input.metrics?.avgLatency,
        p95Latency: input.metrics?.p95Latency,
        p99Latency: input.metrics?.p99Latency,
        throughput: input.metrics?.throughput,
        errorRate: input.metrics?.errorRate,
        totalPredictions: input.metrics?.totalPredictions ?? 0,
        totalCost: input.metrics?.totalCost ?? 0,
      },
      registered_at: now,
      registered_by: input.registeredBy ?? null,
      activated_at: null,
      deprecated_at: null,
      tags: input.tags ?? null,
    });

    logger.info({ msg: 'Model registered', modelId: id, name: input.name, version: input.version });
    return this.mapEntityToModel(entity);
  }

  /**
   * 激活模型
   */
  async activateModel(modelId: string): Promise<ModelVersion> {
    const entity = await this.modelRepo.findById(modelId);
    if (!entity) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found: ${modelId}`);
    }

    if (entity.status === 'deprecated' || entity.status === 'archived') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cannot activate ${entity.status} model: ${modelId}`);
    }

    // 将同名模型的旧活跃版本设为非活跃
    const existingActive = await this.modelRepo.findActiveByName(entity.name);
    if (existingActive && existingActive.id !== modelId) {
      await this.modelRepo.update(existingActive.id, {
        status: 'registered',
        activated_at: null,
      });
      logger.info({
        msg: 'Previous active model deactivated',
        modelId: existingActive.id,
        name: entity.name,
      });
    }

    const updated = await this.modelRepo.update(modelId, {
      status: 'active',
      activated_at: new Date(),
    });

    logger.info({ msg: 'Model activated', modelId, name: entity.name, version: entity.version });
    return this.mapEntityToModel(updated);
  }

  /**
   * 获取模型的版本列表
   */
  async getModelVersions(modelName: string, includeDeprecated = false): Promise<ModelVersion[]> {
    const entities = await this.modelRepo.findByName(modelName, includeDeprecated);
    return entities.map(e => this.mapEntityToModel(e));
  }

  /**
   * 获取当前活跃模型
   */
  async getActiveModel(modelName: string): Promise<ModelVersion | undefined> {
    const entity = await this.modelRepo.findActiveByName(modelName);
    if (!entity || entity.status !== 'active') return undefined;
    return this.mapEntityToModel(entity);
  }

  /**
   * 获取所有活跃模型
   */
  async getAllActiveModels(): Promise<ModelVersion[]> {
    const entities = await this.modelRepo.findAllActive();
    return entities.map(e => this.mapEntityToModel(e));
  }

  /**
   * 废弃模型
   */
  async deprecateModel(modelId: string): Promise<ModelVersion> {
    const entity = await this.modelRepo.findById(modelId);
    if (!entity) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found: ${modelId}`);
    }

    if (entity.status === 'archived') {
      throw new OrionError(ErrorCode.NOT_FOUND, `Cannot deprecate archived model: ${modelId}`);
    }

    // 如果是当前活跃模型，清除活跃标记
    const activeEntity = await this.modelRepo.findActiveByName(entity.name);
    if (activeEntity?.id === modelId) {
      logger.info({
        msg: 'Active model deprecated, cleared active status',
        modelId,
        name: entity.name,
      });
    }

    const updated = await this.modelRepo.update(modelId, {
      status: 'deprecated',
      deprecated_at: new Date(),
    });

    logger.info({ msg: 'Model deprecated', modelId, name: entity.name, version: entity.version });
    return this.mapEntityToModel(updated);
  }

  /**
   * 获取模型详情
   */
  async getModelById(modelId: string): Promise<ModelVersion | undefined> {
    const entity = await this.modelRepo.findById(modelId);
    return entity ? this.mapEntityToModel(entity) : undefined;
  }

  /**
   * 更新模型指标
   */
  async updateModelMetrics(modelId: string, metrics: Partial<ModelMetrics>): Promise<ModelVersion> {
    const entity = await this.modelRepo.findById(modelId);
    if (!entity) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found: ${modelId}`);
    }

    const updatedMetrics = { ...entity.metrics, ...metrics };
    const updated = await this.modelRepo.updateMetrics(modelId, updatedMetrics);
    return this.mapEntityToModel(updated);
  }

  // ==================== A/B 测试 ====================

  /**
   * 创建 A/B 测试
   */
  async createABTest(config: {
    modelName: string;
    variants: ABTestVariant[];
    trafficSplit: Record<string, number>;
    targetMetrics: string[];
    durationHours?: number;
  }): Promise<ABTestConfig> {
    // 验证参与 A/B 测试的模型都存在
    for (const variant of config.variants) {
      const model = await this.modelRepo.findById(variant.modelId);
      if (!model) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Variant model not found: ${variant.modelId}`);
      }
    }

    // 验证流量分配总和为 100
    const totalTraffic = Object.values(config.trafficSplit).reduce((sum, v) => sum + v, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Traffic split must sum to 100, got ${totalTraffic}`);
    }

    const now = new Date();
    const id = uuidv4();

    const entity = await this.abTestRepo.create({
      id,
      model_name: config.modelName,
      variants: config.variants,
      traffic_split: config.trafficSplit,
      start_date: now,
      end_date: config.durationHours
        ? new Date(now.getTime() + config.durationHours * 60 * 60 * 1000)
        : null,
      target_metrics: config.targetMetrics,
      status: 'running',
    });

    // 初始化指标跟踪
    for (const variant of config.variants) {
      await this.abTestMetricRepo.create({
        id: `metric-${id}-${variant.modelId}`,
        ab_test_id: id,
        model_id: variant.modelId,
        metrics: {
          totalPredictions: 0,
          errorRate: 0,
          avgLatency: 0,
        },
        request_count: 0,
      });
    }

    logger.info({
      msg: 'AB test created',
      modelName: config.modelName,
      variants: config.variants.map((v) => v.modelId),
      trafficSplit: config.trafficSplit,
    });

    return this.mapEntityToABTest(entity);
  }

  /**
   * 记录 A/B 测试请求结果
   */
  async recordABTestResult(modelName: string, modelId: string, metrics: {
    success: boolean;
    latency?: number;
    score?: number;
  }): Promise<void> {
    const abTest = await this.abTestRepo.findByName(modelName);
    if (!abTest || abTest.status !== 'running') return;

    const metricEntity = await this.abTestMetricRepo.findByABTestAndModel(abTest.id, modelId);
    if (!metricEntity) return;

    // 更新累积指标
    const existing = metricEntity.metrics;
    const prevPredictions = existing.totalPredictions ?? 0;
    const prevErrorRate = existing.errorRate ?? 0;
    const prevAvgLatency = existing.avgLatency ?? 0;

    const totalPredictions = prevPredictions + 1;
    const errorRate = ((prevErrorRate * (totalPredictions - 1)) + (metrics.success ? 0 : 1)) / totalPredictions;

    const newMetrics: Record<string, any> = {
      ...existing,
      totalPredictions,
      errorRate,
    };

    if (metrics.latency !== undefined) {
      newMetrics.avgLatency =
        (prevAvgLatency * (totalPredictions - 1) + metrics.latency) / totalPredictions;
    }

    await this.abTestMetricRepo.incrementRequestCount(metricEntity.id);
    await this.abTestMetricRepo.updateMetrics(metricEntity.id, newMetrics);
  }

  /**
   * 暂停 A/B 测试
   */
  async pauseABTest(modelName: string): Promise<ABTestConfig> {
    const abTest = await this.abTestRepo.findByName(modelName);
    if (!abTest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `AB test not found for model: ${modelName}`);
    }
    if (abTest.status === 'completed') {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'AB test is already completed');
    }

    const updated = await this.abTestRepo.updateStatus(abTest.id, 'paused');
    logger.info({ msg: 'AB test paused', modelName });

    return this.mapEntityToABTest(updated);
  }

  /**
   * 完成 A/B 测试并生成结果
   */
  async completeABTest(modelName: string, winner?: string): Promise<ABTestResult> {
    const abTest = await this.abTestRepo.findByName(modelName);
    if (!abTest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `AB test not found for model: ${modelName}`);
    }

    await this.abTestRepo.updateStatus(abTest.id, 'completed');

    const metricEntities = await this.abTestMetricRepo.findByABTest(abTest.id);

    const results: ABTestVariantResult[] = (abTest.variants as ABTestVariant[]).map((variant) => {
      const metric = metricEntities.find(m => m.model_id === variant.modelId);
      const m = metric ? metric.metrics : { totalPredictions: 0, errorRate: 0, avgLatency: 0 };
      const requestCount = metric ? metric.request_count : 0;

      return {
        modelId: variant.modelId,
        name: variant.name,
        metrics: m as ModelMetrics,
        requestCount,
        successRate: 1 - (m.errorRate || 0),
      };
    });

    // 自动选择获胜者
    let determinedWinner = winner;
    let conclusion: string | undefined;

    if (!determinedWinner && results.length > 0) {
      const sorted = [...results].sort(
        (a, b) => (b.successRate - (b.metrics.errorRate ?? 0)) - (a.successRate - (a.metrics.errorRate ?? 0))
      );
      determinedWinner = sorted[0].modelId;
      const winnerModel = await this.modelRepo.findById(determinedWinner);
      conclusion = `Based on success rate analysis, ${sorted[0].name} (${winnerModel?.version || 'unknown'}) is the winner with ${(sorted[0].successRate * 100).toFixed(1)}% success rate`;
    }

    const result: ABTestResult = {
      config: this.mapEntityToABTest(abTest),
      results,
      winner: determinedWinner,
      conclusion,
      generatedAt: new Date(),
    };

    logger.info({
      msg: 'AB test completed',
      modelName,
      winner: determinedWinner,
      conclusion,
    });

    return result;
  }

  /**
   * 获取 A/B 测试结果
   */
  async getABTestResults(modelName: string): Promise<ABTestResult | undefined> {
    const abTest = await this.abTestRepo.findByName(modelName);
    if (!abTest) return undefined;

    const metricEntities = await this.abTestMetricRepo.findByABTest(abTest.id);

    const results: ABTestVariantResult[] = (abTest.variants as ABTestVariant[]).map((variant) => {
      const metric = metricEntities.find(m => m.model_id === variant.modelId);
      const m = metric ? metric.metrics : { totalPredictions: 0, errorRate: 0, avgLatency: 0 };
      const requestCount = metric ? metric.request_count : 0;

      return {
        modelId: variant.modelId,
        name: variant.name,
        metrics: m as ModelMetrics,
        requestCount,
        successRate: 1 - (m.errorRate || 0),
      };
    });

    return {
      config: this.mapEntityToABTest(abTest),
      results,
      generatedAt: new Date(),
    };
  }

  /**
   * 获取 A/B 测试配置
   */
  async getABTestConfig(modelName: string): Promise<ABTestConfig | undefined> {
    const abTest = await this.abTestRepo.findByName(modelName);
    return abTest ? this.mapEntityToABTest(abTest) : undefined;
  }

  // ==================== 模型性能监控 ====================

  /**
   * 获取模型性能概览
   */
  async getModelPerformanceOverview(modelName: string): Promise<{
    versions: number;
    activeVersion?: string;
    allMetrics: Array<{ version: string; status: ModelStatus; metrics: ModelMetrics }>;
  }> {
    const versions = await this.getModelVersions(modelName, true);
    const active = await this.getActiveModel(modelName);

    return {
      versions: versions.length,
      activeVersion: active?.version,
      allMetrics: versions.map((v) => ({
        version: v.version,
        status: v.status,
        metrics: v.metrics,
      })),
    };
  }

  /**
   * 获取所有模型列表
   */
  async listModels(options?: {
    status?: ModelStatus;
    framework?: ModelFramework;
    name?: string;
  }): Promise<ModelVersion[]> {
    const entities = await this.modelRepo.listAll(options);
    return entities.map(e => this.mapEntityToModel(e));
  }

  /**
   * 归档模型
   */
  async archiveModel(modelId: string): Promise<ModelVersion> {
    const entity = await this.modelRepo.findById(modelId);
    if (!entity) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found: ${modelId}`);
    }

    if (entity.status === 'active') {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Cannot archive an active model. Deactivate it first.');
    }

    const updated = await this.modelRepo.update(modelId, { status: 'archived' });
    logger.info({ msg: 'Model archived', modelId, name: entity.name, version: entity.version });
    return this.mapEntityToModel(updated);
  }

  /**
   * 回滚模型
   */
  async rollbackModel(modelId: string, targetVersion?: string): Promise<ModelVersion> {
    const entity = await this.modelRepo.findById(modelId);
    if (!entity) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found: ${modelId}`);
    }

    if (targetVersion) {
      // 回滚到指定版本
      const versions = await this.modelRepo.findByName(entity.name, false);
      const target = versions.find(m => m.version === targetVersion);
      if (!target) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Target version ${targetVersion} not found for model ${entity.name}`);
      }
      if (target.status === 'deprecated' || target.status === 'archived') {
        throw new OrionError('OPERATION_FAILED', `Cannot rollback to ${target.status} version: ${targetVersion}`)
      }
      return this.activateModel(target.id);
    }

    // 自动回滚到上一个活跃版本
    const allVersions = await this.modelRepo.findByName(entity.name, true);
    const previousVersions = allVersions
      .filter(m => m.id !== modelId && m.status !== 'deprecated' && m.status !== 'archived')
      .sort((a, b) => (b.activated_at?.getTime() || 0) - (a.activated_at?.getTime() || 0));

    if (previousVersions.length === 0) {
      throw new OrionError('OPERATION_FAILED', `No previous version available for rollback: ${entity.name}`)
    }

    logger.info({
      msg: 'Rolling back model',
      modelId,
      name: entity.name,
      fromVersion: entity.version,
      toVersion: previousVersions[0].version,
    });

    return this.activateModel(previousVersions[0].id);
  }

  // ==================== Entity Mapping ====================

  private mapEntityToModel(entity: ModelVersionEntity): ModelVersion {
    return {
      id: entity.id,
      name: entity.name,
      version: entity.version,
      status: entity.status as ModelStatus,
      framework: entity.framework as ModelFramework,
      description: entity.description ?? undefined,
      metadata: entity.metadata ?? undefined,
      trainingDate: entity.training_date ?? undefined,
      trainingDataSize: entity.training_data_size ?? undefined,
      hyperparameters: entity.hyperparameters ?? undefined,
      metrics: entity.metrics as ModelMetrics,
      registeredAt: entity.registered_at,
      registeredBy: entity.registered_by ?? undefined,
      activatedAt: entity.activated_at ?? undefined,
      deprecatedAt: entity.deprecated_at ?? undefined,
      tags: entity.tags ?? undefined,
    };
  }

  private mapEntityToABTest(entity: ABTestEntity): ABTestConfig {
    return {
      modelName: entity.model_name,
      variants: entity.variants as ABTestVariant[],
      trafficSplit: entity.traffic_split,
      startDate: entity.start_date,
      endDate: entity.end_date ?? undefined,
      targetMetrics: entity.target_metrics,
      status: entity.status as 'running' | 'completed' | 'paused',
    };
  }
}
