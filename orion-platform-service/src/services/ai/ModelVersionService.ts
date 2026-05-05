/**
 * Model Version Service — 模型版本管理服务
 *
 * 功能：
 * 1. 模型注册/版本管理/激活
 * 2. A/B 测试支持
 * 3. 模型性能监控
 */

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== 类型定义 ====================

export type ModelStatus = 'registered' | 'active' | 'deprecated' | 'archived';
export type ModelFramework = 'openai' | 'anthropic' | 'custom' | 'rule-based' | 'transformer';

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  avgLatency?: number; // ms
  p95Latency?: number; // ms
  p99Latency?: number; // ms
  throughput?: number; // requests per second
  errorRate?: number; // 0-1
  totalPredictions?: number;
  totalCost?: number; // 累计成本
}

export interface ModelVersion {
  id: string;
  name: string; // 模型名称 (e.g., "code-review-model")
  version: string; // 版本号 (e.g., "v1.2.3")
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
  trafficSplit: Record<string, number>; // modelId -> percentage (0-100)
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
  winner?: string; // winning modelId
  statisticalSignificance?: number; // p-value
  conclusion?: string;
  generatedAt: Date;
}

export interface ABTestVariantResult {
  modelId: string;
  name: string;
  metrics: ModelMetrics;
  requestCount: number;
  successRate: number;
  userFeedbackScore?: number; // 1-5
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
  private models: Map<string, ModelVersion>; // id -> model
  private activeModels: Map<string, string>; // modelName -> modelId
  private abTests: Map<string, ABTestConfig>; // modelName -> config
  private abTestMetrics: Map<string, Map<string, ModelMetrics>>; // modelName -> modelId -> metrics
  private abTestRequestCounts: Map<string, Map<string, number>>; // modelName -> modelId -> count

  constructor() {
    this.models = new Map();
    this.activeModels = new Map();
    this.abTests = new Map();
    this.abTestMetrics = new Map();
    this.abTestRequestCounts = new Map();
  }

  /**
   * 注册模型版本
   */
  registerModel(input: ModelRegistrationInput): ModelVersion {
    const id = `model-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 检查是否已存在相同名称+版本的模型
    const existing = Array.from(this.models.values()).find(
      (m) => m.name === input.name && m.version === input.version
    );
    if (existing) {
      throw new Error(
        `Model version already exists: ${input.name}@${input.version} (id: ${existing.id})`
      );
    }

    const now = new Date();
    const model: ModelVersion = {
      id,
      name: input.name,
      version: input.version,
      status: 'registered',
      framework: input.framework,
      description: input.description,
      metadata: input.metadata,
      trainingDate: input.trainingDate,
      trainingDataSize: input.trainingDataSize,
      hyperparameters: input.hyperparameters,
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
      registeredAt: now,
      registeredBy: input.registeredBy,
      tags: input.tags,
    };

    this.models.set(id, model);
    logger.info({ msg: 'Model registered', modelId: id, name: input.name, version: input.version });

    return model;
  }

  /**
   * 激活模型
   */
  activateModel(modelId: string): ModelVersion {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status === 'deprecated' || model.status === 'archived') {
      throw new Error(`Cannot activate ${model.status} model: ${modelId}`);
    }

    // 将同名模型的旧活跃版本设为非活跃
    const existingActive = this.activeModels.get(model.name);
    if (existingActive && existingActive !== modelId) {
      const oldModel = this.models.get(existingActive);
      if (oldModel && oldModel.status === 'active') {
        oldModel.status = 'registered';
        oldModel.activatedAt = undefined;
        logger.info({
          msg: 'Previous active model deactivated',
          modelId: existingActive,
          name: model.name,
        });
      }
    }

    model.status = 'active';
    model.activatedAt = new Date();
    this.activeModels.set(model.name, modelId);

    logger.info({ msg: 'Model activated', modelId, name: model.name, version: model.version });

    return model;
  }

  /**
   * 获取模型的版本列表
   */
  getModelVersions(modelName: string, includeDeprecated = false): ModelVersion[] {
    const versions = Array.from(this.models.values())
      .filter((m) => m.name === modelName)
      .filter((m) => includeDeprecated || m.status !== 'deprecated' && m.status !== 'archived')
      .sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());

    return versions;
  }

  /**
   * 获取当前活跃模型
   */
  getActiveModel(modelName: string): ModelVersion | undefined {
    const activeId = this.activeModels.get(modelName);
    if (!activeId) return undefined;

    const model = this.models.get(activeId);
    if (!model || model.status !== 'active') {
      this.activeModels.delete(modelName);
      return undefined;
    }

    return model;
  }

  /**
   * 获取所有活跃模型
   */
  getAllActiveModels(): ModelVersion[] {
    return Array.from(this.activeModels.entries())
      .map(([, id]) => this.models.get(id))
      .filter((m): m is ModelVersion => m !== undefined && m.status === 'active');
  }

  /**
   * 废弃模型
   */
  deprecateModel(modelId: string): ModelVersion {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status === 'archived') {
      throw new Error(`Cannot deprecate archived model: ${modelId}`);
    }

    // 如果是当前活跃模型，清除活跃标记
    const activeId = this.activeModels.get(model.name);
    if (activeId === modelId) {
      this.activeModels.delete(model.name);
      logger.info({
        msg: 'Active model deprecated, cleared active status',
        modelId,
        name: model.name,
      });
    }

    model.status = 'deprecated';
    model.deprecatedAt = new Date();

    logger.info({ msg: 'Model deprecated', modelId, name: model.name, version: model.version });

    return model;
  }

  /**
   * 获取模型详情
   */
  getModelById(modelId: string): ModelVersion | undefined {
    return this.models.get(modelId);
  }

  /**
   * 更新模型指标
   */
  updateModelMetrics(modelId: string, metrics: Partial<ModelMetrics>): ModelVersion {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    model.metrics = {
      ...model.metrics,
      ...metrics,
    };

    return model;
  }

  // ==================== A/B 测试 ====================

  /**
   * 创建 A/B 测试
   */
  createABTest(config: {
    modelName: string;
    variants: ABTestVariant[];
    trafficSplit: Record<string, number>;
    targetMetrics: string[];
    durationHours?: number;
  }): ABTestConfig {
    // 验证参与 A/B 测试的模型都存在
    for (const variant of config.variants) {
      const model = this.models.get(variant.modelId);
      if (!model) {
        throw new Error(`Variant model not found: ${variant.modelId}`);
      }
    }

    // 验证流量分配总和为 100
    const totalTraffic = Object.values(config.trafficSplit).reduce((sum, v) => sum + v, 0);
    if (Math.abs(totalTraffic - 100) > 0.01) {
      throw new Error(`Traffic split must sum to 100, got ${totalTraffic}`);
    }

    const now = new Date();
    const abTest: ABTestConfig = {
      modelName: config.modelName,
      variants: config.variants,
      trafficSplit: config.trafficSplit,
      startDate: now,
      endDate: config.durationHours
        ? new Date(now.getTime() + config.durationHours * 60 * 60 * 1000)
        : undefined,
      targetMetrics: config.targetMetrics,
      status: 'running',
    };

    this.abTests.set(config.modelName, abTest);

    // 初始化指标跟踪
    if (!this.abTestMetrics.has(config.modelName)) {
      this.abTestMetrics.set(config.modelName, new Map());
    }
    if (!this.abTestRequestCounts.has(config.modelName)) {
      this.abTestRequestCounts.set(config.modelName, new Map());
    }

    const metricsMap = this.abTestMetrics.get(config.modelName)!;
    const countsMap = this.abTestRequestCounts.get(config.modelName)!;

    for (const variant of config.variants) {
      metricsMap.set(variant.modelId, {
        totalPredictions: 0,
        errorRate: 0,
        avgLatency: 0,
      });
      countsMap.set(variant.modelId, 0);
    }

    logger.info({
      msg: 'AB test created',
      modelName: config.modelName,
      variants: config.variants.map((v) => v.modelId),
      trafficSplit: config.trafficSplit,
    });

    return abTest;
  }

  /**
   * 记录 A/B 测试请求结果
   */
  recordABTestResult(modelName: string, modelId: string, metrics: {
    success: boolean;
    latency?: number;
    score?: number;
  }): void {
    const abTest = this.abTests.get(modelName);
    if (!abTest || abTest.status !== 'running') {
      return; // 不在 A/B 测试期间
    }

    const countsMap = this.abTestRequestCounts.get(modelName);
    const metricsMap = this.abTestMetrics.get(modelName);
    if (!countsMap || !metricsMap) return;

    const count = (countsMap.get(modelId) || 0) + 1;
    countsMap.set(modelId, count);

    // 更新累积指标
    const existing = metricsMap.get(modelId);
    const prevPredictions = existing?.totalPredictions ?? 0;
    const prevErrorRate = existing?.errorRate ?? 0;
    const prevAvgLatency = existing?.avgLatency ?? 0;

    const totalPredictions = prevPredictions + 1;
    const errorRate = ((prevErrorRate * (totalPredictions - 1)) + (metrics.success ? 0 : 1)) / totalPredictions;

    const newMetrics: ModelMetrics = {
      ...existing,
      totalPredictions,
      errorRate,
    };

    if (metrics.latency !== undefined) {
      newMetrics.avgLatency =
        (prevAvgLatency * (totalPredictions - 1) + metrics.latency) / totalPredictions;
    }

    metricsMap.set(modelId, newMetrics);
  }

  /**
   * 暂停 A/B 测试
   */
  pauseABTest(modelName: string): ABTestConfig {
    const abTest = this.abTests.get(modelName);
    if (!abTest) {
      throw new Error(`AB test not found for model: ${modelName}`);
    }
    if (abTest.status === 'completed') {
      throw new Error('AB test is already completed');
    }

    abTest.status = 'paused';
    logger.info({ msg: 'AB test paused', modelName });

    return abTest;
  }

  /**
   * 完成 A/B 测试并生成结果
   */
  completeABTest(modelName: string, winner?: string): ABTestResult {
    const abTest = this.abTests.get(modelName);
    if (!abTest) {
      throw new Error(`AB test not found for model: ${modelName}`);
    }

    abTest.status = 'completed';

    const metricsMap = this.abTestMetrics.get(modelName) || new Map();

    const results: ABTestVariantResult[] = abTest.variants.map((variant) => {
      const metrics = metricsMap.get(variant.modelId) || {
        totalPredictions: 0,
        errorRate: 0,
        avgLatency: 0,
      };
      const requestCount = this.abTestRequestCounts.get(modelName)?.get(variant.modelId) || 0;

      return {
        modelId: variant.modelId,
        name: variant.name,
        metrics,
        requestCount,
        successRate: 1 - (metrics.errorRate || 0),
      };
    });

    // 自动选择获胜者（如果没有手动指定）
    let determinedWinner = winner;
    let conclusion: string | undefined;

    if (!determinedWinner && results.length > 0) {
      const sorted = [...results].sort(
        (a, b) => (b.successRate - (b.metrics.errorRate ?? 0)) - (a.successRate - (a.metrics.errorRate ?? 0))
      );
      determinedWinner = sorted[0].modelId;
      const winnerModel = this.models.get(determinedWinner);
      conclusion = `Based on success rate analysis, ${sorted[0].name} (${winnerModel?.version || 'unknown'}) is the winner with ${(sorted[0].successRate * 100).toFixed(1)}% success rate`;
    }

    const result: ABTestResult = {
      config: abTest,
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
  getABTestResults(modelName: string): ABTestResult | undefined {
    const abTest = this.abTests.get(modelName);
    if (!abTest) {
      return undefined;
    }

    const metricsMap = this.abTestMetrics.get(modelName) || new Map();

    const results: ABTestVariantResult[] = abTest.variants.map((variant) => {
      const metrics = metricsMap.get(variant.modelId) || {
        totalPredictions: 0,
        errorRate: 0,
        avgLatency: 0,
      };
      const requestCount = this.abTestRequestCounts.get(modelName)?.get(variant.modelId) || 0;

      return {
        modelId: variant.modelId,
        name: variant.name,
        metrics,
        requestCount,
        successRate: 1 - (metrics.errorRate || 0),
      };
    });

    return {
      config: abTest,
      results,
      generatedAt: new Date(),
    };
  }

  /**
   * 获取 A/B 测试配置
   */
  getABTestConfig(modelName: string): ABTestConfig | undefined {
    return this.abTests.get(modelName);
  }

  // ==================== 模型性能监控 ====================

  /**
   * 获取模型性能概览
   */
  getModelPerformanceOverview(modelName: string): {
    versions: number;
    activeVersion?: string;
    allMetrics: Array<{ version: string; status: ModelStatus; metrics: ModelMetrics }>;
  } {
    const versions = this.getModelVersions(modelName, true);
    const active = this.getActiveModel(modelName);

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
  listModels(options?: {
    status?: ModelStatus;
    framework?: ModelFramework;
    name?: string;
  }): ModelVersion[] {
    let models = Array.from(this.models.values());

    if (options?.status) {
      models = models.filter((m) => m.status === options.status);
    }
    if (options?.framework) {
      models = models.filter((m) => m.framework === options.framework);
    }
    if (options?.name) {
      models = models.filter((m) => m.name.toLowerCase().includes(options.name!.toLowerCase()));
    }

    return models.sort((a, b) => b.registeredAt.getTime() - a.registeredAt.getTime());
  }

  /**
   * 归档模型（最终状态，不可逆）
   */
  archiveModel(modelId: string): ModelVersion {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (model.status === 'active') {
      throw new Error('Cannot archive an active model. Deactivate it first.');
    }

    model.status = 'archived';
    logger.info({ msg: 'Model archived', modelId, name: model.name, version: model.version });

    return model;
  }

  /**
   * 回滚模型到上一个版本或指定版本
   */
  rollbackModel(modelId: string, targetVersion?: string): ModelVersion {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    if (targetVersion) {
      // 回滚到指定版本
      const target = Array.from(this.models.values()).find(
        (m) => m.name === model.name && m.version === targetVersion
      );
      if (!target) {
        throw new Error(`Target version ${targetVersion} not found for model ${model.name}`);
      }
      if (target.status === 'deprecated' || target.status === 'archived') {
        throw new Error(`Cannot rollback to ${target.status} version: ${targetVersion}`);
      }
      return this.activateModel(target.id);
    }

    // 自动回滚到上一个活跃版本
    const previousVersions = Array.from(this.models.values())
      .filter((m) =>
        m.name === model.name &&
        m.id !== modelId &&
        m.status !== 'deprecated' &&
        m.status !== 'archived'
      )
      .sort((a, b) => (b.activatedAt?.getTime() || 0) - (a.activatedAt?.getTime() || 0));

    if (previousVersions.length === 0) {
      throw new Error(`No previous version available for rollback: ${model.name}`);
    }

    logger.info({
      msg: 'Rolling back model',
      modelId,
      name: model.name,
      fromVersion: model.version,
      toVersion: previousVersions[0].version,
    });

    return this.activateModel(previousVersions[0].id);
  }
}
