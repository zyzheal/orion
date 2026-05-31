import { OrionError, ErrorCode } from '../../errors';
import { v4 as uuidv4 } from 'uuid';
import {
  PredictionHistoryRepository,
  PredictionHistoryEntity,
} from '../../repositories/PredictionHistoryRepository';
import {
  AIModelRegistryRepository,
  AIModelRegistryEntity,
} from '../../repositories/AIModelRegistryRepository';
import {
  AIABTestRepository,
  AIABTestEntity,
} from '../../repositories/AIABTestRepository';

/**
 * ML 模型推理集成服务
 *
 * 提供模型加载、推理预测、置信度评估、批量预测能力
 * 支持模型注册表、版本追踪、A/B 测试和回滚
 *
 * 使用 PostgreSQL Repository 模式持久化以下数据：
 * - predictionHistory -> PredictionHistoryRepository
 * - modelRegistry -> AIModelRegistryRepository
 * - abTests -> AIABTestRepository
 */

/**
 * ML 模型版本注册信息
 */
export interface ModelRegistryEntry {
  modelId: string;
  name: string;
  versions: ModelVersionEntry[];
  activeVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelVersionEntry {
  version: string;
  status: 'registered' | 'active' | 'deprecated' | 'archived';
  modelPath?: string;
  featureNames: string[];
  featureCount: number;
  modelType: 'classification' | 'regression' | 'anomaly_detection';
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    avgLatency?: number;
  };
  registeredAt: Date;
  activatedAt?: Date;
  deprecatedAt?: Date;
}

/**
 * A/B 测试配置
 */
export interface ABTestConfig {
  id: string;
  name: string;
  modelId: string;
  variantA: { version: string; trafficPercent: number };
  variantB: { version: string; trafficPercent: number };
  status: 'running' | 'completed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  winner?: string;
  metrics: {
    variantA: { predictions: number; avgConfidence: number; successRate: number };
    variantB: { predictions: number; avgConfidence: number; successRate: number };
  };
}

/**
 * ML 模型元数据
 */
export interface MLModel {
  /** 模型 ID */
  modelId: string;
  /** 模型名称 */
  name: string;
  /** 模型版本 */
  version: string;
  /** 特征名称列表 */
  featureNames: string[];
  /** 特征数量 */
  featureCount: number;
  /** 模型类型 */
  modelType: 'classification' | 'regression' | 'anomaly_detection';
  /** 加载状态 */
  status: 'loaded' | 'unloaded' | 'error';
  /** 加载时间 */
  loadedAt?: Date;
  /** 模型元信息 */
  metadata?: Record<string, unknown>;
}

/**
 * 单次预测结果
 */
export interface PredictionResult {
  /** 预测值 */
  value: number | string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 预测时间 */
  predictedAt: Date;
  /** 模型 ID */
  modelId: string;
  /** 输入特征 */
  inputFeatures: Record<string, number>;
}

/**
 * 批量预测结果
 */
export interface BatchPredictionResult {
  /** 预测结果列表 */
  predictions: PredictionResult[];
  /** 总耗时（毫秒） */
  totalDurationMs: number;
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failureCount: number;
}

/**
 * 模型性能统计
 */
export interface ModelPerformance {
  /** 模型 ID */
  modelId: string;
  /** 模型名称 */
  modelName: string;
  /** 模型类型 */
  modelType: string;
  /** 预测总次数 */
  totalPredictions: number;
  /** 平均置信度 */
  averageConfidence: number;
  /** 最低置信度 */
  minConfidence: number;
  /** 最高置信度 */
  maxConfidence: number;
  /** 最近预测时间 */
  lastPredictionAt?: Date;
  /** 模型状态 */
  status: string;
}

/**
 * ML 模型推理服务（增强版：支持模型注册表、A/B 测试、版本回滚）
 */
export class MLInferenceService {
  /** 已加载的模型 (runtime state, not persisted) */
  private models: Map<string, MLModel> = new Map();

  /** Repositories */
  private predictionRepo: PredictionHistoryRepository | null = null;
  private registryRepo: AIModelRegistryRepository | null = null;
  private abTestRepo: AIABTestRepository | null = null;

  /** In-memory cache for model registry (backed by DB) */
  private registryCache: Map<string, ModelRegistryEntry> = new Map();
  /** In-memory cache for AB tests (backed by DB) */
  private abTestCache: Map<string, ABTestConfig> = new Map();

  constructor(
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    if (db) {
      this.predictionRepo = new PredictionHistoryRepository(db);
      this.registryRepo = new AIModelRegistryRepository(db);
      this.abTestRepo = new AIABTestRepository(db);
    }
    // 预置模拟模型
    this.registerDefaultModels();
  }

  // ==================== 模型注册表 ====================

  /**
   * 注册模型到注册表
   */
  async registerModelToRegistry(modelId: string, name: string, version: string, options?: {
    featureNames?: string[];
    featureCount?: number;
    modelType?: 'classification' | 'regression' | 'anomaly_detection';
    modelPath?: string;
    metrics?: ModelVersionEntry['metrics'];
  }): Promise<ModelRegistryEntry> {
    const now = new Date();
    let registry = this.registryCache.get(modelId);

    if (!registry) {
      // Try loading from DB
      if (this.registryRepo) {
        const entity = await this.registryRepo.findByModelId(modelId);
        if (entity) {
          registry = this.entityToRegistry(entity);
        }
      }
    }

    if (!registry) {
      registry = {
        modelId,
        name,
        versions: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    // 检查版本是否已存在
    const existingVersion = registry.versions.find((v) => v.version === version);
    if (existingVersion) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Version ${version} already exists for model ${modelId}`);
    }

    const versionEntry: ModelVersionEntry = {
      version,
      status: 'registered',
      modelPath: options?.modelPath,
      featureNames: options?.featureNames || ['feature_0', 'feature_1', 'feature_2'],
      featureCount: options?.featureCount || 3,
      modelType: options?.modelType || 'classification',
      metrics: options?.metrics,
      registeredAt: now,
    };

    registry.versions.push(versionEntry);
    registry.updatedAt = now;

    // Persist to DB
    if (this.registryRepo) {
      const existing = await this.registryRepo.findByModelId(modelId);
      if (existing) {
        await this.registryRepo.updateVersions(modelId, registry.versions as unknown as unknown[], registry.activeVersion);
      } else {
        await this.registryRepo.create({
          id: uuidv4(),
          model_id: modelId,
          name,
          active_version: registry.activeVersion ?? null,
          versions_json: registry.versions as unknown as unknown[],
        });
      }
    }

    this.registryCache.set(modelId, registry);
    return registry;
  }

  /**
   * 获取模型注册表信息
   */
  async getModelRegistry(modelId: string): Promise<ModelRegistryEntry | undefined> {
    // Check cache first
    const cached = this.registryCache.get(modelId);
    if (cached) return cached;

    // Load from DB
    if (this.registryRepo) {
      const entity = await this.registryRepo.findByModelId(modelId);
      if (entity) {
        const registry = this.entityToRegistry(entity);
        this.registryCache.set(modelId, registry);
        return registry;
      }
    }
    return undefined;
  }

  /**
   * 列出所有注册的模型
   */
  async listRegistry(): Promise<ModelRegistryEntry[]> {
    if (this.registryRepo) {
      const entities = await this.registryRepo.listAll();
      return entities.map(e => {
        const reg = this.entityToRegistry(e);
        this.registryCache.set(reg.modelId, reg);
        return reg;
      });
    }
    return Array.from(this.registryCache.values());
  }

  /**
   * 激活模型版本
   */
  async activateModelVersion(modelId: string, version: string): Promise<ModelRegistryEntry> {
    const registry = await this.getModelRegistry(modelId);
    if (!registry) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found in registry: ${modelId}`);
    }

    const versionEntry = registry.versions.find((v) => v.version === version);
    if (!versionEntry) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Version ${version} not found for model ${modelId}`);
    }

    // 将旧活跃版本设为 registered
    const oldActive = registry.versions.find((v) => v.status === 'active');
    if (oldActive) {
      oldActive.status = 'registered';
      oldActive.activatedAt = undefined;
    }

    // 激活新版本
    versionEntry.status = 'active';
    versionEntry.activatedAt = new Date();
    registry.activeVersion = version;
    registry.updatedAt = new Date();

    // Persist
    if (this.registryRepo) {
      await this.registryRepo.updateVersions(modelId, registry.versions as unknown as unknown[], registry.activeVersion);
    }
    this.registryCache.set(modelId, registry);

    return registry;
  }

  /**
   * 回滚到上一个模型版本
   */
  async rollbackModelVersion(modelId: string, targetVersion?: string): Promise<ModelRegistryEntry> {
    const registry = await this.getModelRegistry(modelId);
    if (!registry) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found in registry: ${modelId}`);
    }

    let target: ModelVersionEntry | undefined;

    if (targetVersion) {
      // 回滚到指定版本
      target = registry.versions.find((v) => v.version === targetVersion);
      if (!target) {
        throw new OrionError(ErrorCode.NOT_FOUND, `Target version ${targetVersion} not found for model ${modelId}`);
      }
    } else {
      // 自动回滚到上一个活跃版本
      const previousActive = registry.versions
        .filter((v) => v.status !== 'active' && v.status !== 'deprecated' && v.status !== 'archived')
        .sort((a, b) => (b.activatedAt?.getTime() || 0) - (a.activatedAt?.getTime() || 0))[0];

      if (!previousActive) {
        throw new OrionError(ErrorCode.NOT_FOUND, `No previous version available for rollback: ${modelId}`);
      }
      target = previousActive;
    }

    // 取消当前活跃版本
    const currentActive = registry.versions.find((v) => v.status === 'active');
    if (currentActive) {
      currentActive.status = 'registered';
      currentActive.activatedAt = undefined;
    }

    // 激活目标版本
    target.status = 'active';
    target.activatedAt = new Date();
    registry.activeVersion = target.version;
    registry.updatedAt = new Date();

    // Persist
    if (this.registryRepo) {
      await this.registryRepo.updateVersions(modelId, registry.versions as unknown as unknown[], registry.activeVersion);
    }
    this.registryCache.set(modelId, registry);

    return registry;
  }

  // ==================== A/B 测试 ====================

  /**
   * 创建 A/B 测试
   */
  async createABTest(config: {
    id: string;
    name: string;
    modelId: string;
    variantA: { version: string; trafficPercent: number };
    variantB: { version: string; trafficPercent: number };
  }): Promise<ABTestConfig> {
    const registry = await this.getModelRegistry(config.modelId);
    if (!registry) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Model not found in registry: ${config.modelId}`);
    }

    // 验证版本存在
    const versionA = registry.versions.find((v) => v.version === config.variantA.version);
    const versionB = registry.versions.find((v) => v.version === config.variantB.version);
    if (!versionA || !versionB) {
      throw new OrionError(ErrorCode.NOT_FOUND, 'One or both variant versions not found');
    }

    if (Math.abs(config.variantA.trafficPercent + config.variantB.trafficPercent - 100) > 0.01) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Traffic split must sum to 100');
    }

    const abTest: ABTestConfig = {
      id: config.id,
      name: config.name,
      modelId: config.modelId,
      variantA: config.variantA,
      variantB: config.variantB,
      status: 'running',
      startedAt: new Date(),
      metrics: {
        variantA: { predictions: 0, avgConfidence: 0, successRate: 0 },
        variantB: { predictions: 0, avgConfidence: 0, successRate: 0 },
      },
    };

    // Persist to DB
    if (this.abTestRepo) {
      await this.abTestRepo.create({
        id: config.id,
        name: config.name,
        model_id: config.modelId,
        variant_a: config.variantA as unknown as Record<string, unknown>,
        variant_b: config.variantB as unknown as Record<string, unknown>,
        status: 'running',
        started_at: abTest.startedAt,
        metrics: abTest.metrics as unknown as Record<string, unknown>,
      });
    }

    this.abTestCache.set(config.id, abTest);
    return abTest;
  }

  /**
   * 获取 A/B 测试配置
   */
  async getABTest(testId: string): Promise<ABTestConfig | undefined> {
    // Check cache
    const cached = this.abTestCache.get(testId);
    if (cached) return cached;

    // Load from DB
    if (this.abTestRepo) {
      const entity = await this.abTestRepo.findById(testId);
      if (entity) {
        const abTest = this.entityToABTest(entity);
        this.abTestCache.set(testId, abTest);
        return abTest;
      }
    }
    return undefined;
  }

  /**
   * 完成 A/B 测试并选出获胜者
   */
  async completeABTest(testId: string): Promise<ABTestConfig> {
    const abTest = await this.getABTest(testId);
    if (!abTest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `AB test not found: ${testId}`);
    }

    const { variantA, variantB } = abTest.metrics;
    const scoreA = variantA.successRate * 0.6 + variantA.avgConfidence * 0.4;
    const scoreB = variantB.successRate * 0.6 + variantB.avgConfidence * 0.4;

    abTest.winner = scoreA >= scoreB ? abTest.variantA.version : abTest.variantB.version;
    abTest.status = 'completed';
    abTest.completedAt = new Date();

    // Persist
    if (this.abTestRepo) {
      await this.abTestRepo.updateStatus(testId, 'completed', abTest.winner);
    }
    this.abTestCache.set(testId, abTest);

    return abTest;
  }

  /**
   * 暂停 A/B 测试
   */
  async pauseABTest(testId: string): Promise<ABTestConfig> {
    const abTest = await this.getABTest(testId);
    if (!abTest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `AB test not found: ${testId}`);
    }
    if (abTest.status === 'completed') {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'AB test is already completed');
    }

    abTest.status = 'paused';

    // Persist
    if (this.abTestRepo) {
      await this.abTestRepo.updateStatus(testId, 'paused');
    }
    this.abTestCache.set(testId, abTest);

    return abTest;
  }

  /**
   * 记录 A/B 测试请求结果
   */
  async recordABTestRequest(testId: string, variant: 'A' | 'B', success: boolean, confidence: number): Promise<void> {
    const abTest = await this.getABTest(testId);
    if (!abTest || abTest.status !== 'running') return;

    const metrics = abTest.metrics[variant === 'A' ? 'variantA' : 'variantB'];
    const totalPredictions = metrics.predictions + 1;
    metrics.predictions = totalPredictions;
    metrics.avgConfidence =
      (metrics.avgConfidence * (totalPredictions - 1) + confidence) / totalPredictions;
    metrics.successRate =
      (metrics.successRate * (totalPredictions - 1) + (success ? 1 : 0)) / totalPredictions;

    // Persist metrics
    if (this.abTestRepo) {
      await this.abTestRepo.updateMetrics(testId, abTest.metrics as unknown as Record<string, unknown>);
    }
    this.abTestCache.set(testId, abTest);
  }

  /**
   * 根据流量分配选择变体
   */
  selectABTestVariant(abTest: ABTestConfig): 'A' | 'B' {
    return Math.random() * 100 < abTest.variantA.trafficPercent ? 'A' : 'B';
  }

  /**
   * 加载模型
   */
  loadModel(modelId: string): MLModel {
    // 如果已加载，直接返回
    if (this.models.has(modelId)) {
      const existing = this.models.get(modelId)!;
      if (existing.status === 'loaded') {
        return existing;
      }
    }

    // 从预置模型中查找
    const modelTemplate = this.getDefaultModel(modelId);
    if (modelTemplate) {
      const model: MLModel = {
        ...modelTemplate,
        status: 'loaded',
        loadedAt: new Date(),
      };
      this.models.set(modelId, model);
      return model;
    }

    // 模拟加载新模型
    const model: MLModel = {
      modelId,
      name: `model-${modelId}`,
      version: '1.0.0',
      featureNames: ['feature_0', 'feature_1', 'feature_2'],
      featureCount: 3,
      modelType: 'classification',
      status: 'loaded',
      loadedAt: new Date(),
    };
    this.models.set(modelId, model);
    return model;
  }

  /**
   * 卸载模型
   */
  unloadModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (model) {
      model.status = 'unloaded';
      model.loadedAt = undefined;
      return true;
    }
    return false;
  }

  /**
   * 获取模型信息
   */
  getModel(modelId: string): MLModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * 列出所有已加载的模型
   */
  listLoadedModels(): MLModel[] {
    return Array.from(this.models.values()).filter((m) => m.status === 'loaded');
  }

  /**
   * 推理预测
   */
  async predict(features: Record<string, number>, modelId: string): Promise<PredictionResult> {
    const model = this.models.get(modelId);
    if (!model || model.status !== 'loaded') {
      throw new OrionError('OPERATION_FAILED', `Model ${modelId} is not loaded`)
    }

    // 验证特征
    this.validateFeatures(features, model);

    // 模拟推理：基于特征值的加权和
    const featureValues = Object.values(features);
    const weights = this.generateWeights(model.featureCount);
    const weightedSum = featureValues.reduce(
      (sum, val, idx) => sum + val * (weights[idx] ?? 0),
      0
    );

    // 根据模型类型生成预测值
    let value: number | string;
    let confidence: number;

    switch (model.modelType) {
      case 'classification': {
        const probability = this.sigmoid(weightedSum);
        value = probability > 0.5 ? 'positive' : 'negative';
        confidence = probability > 0.5 ? probability : 1 - probability;
        break;
      }
      case 'regression': {
        value = weightedSum;
        confidence = this.calculateRegressionConfidence(featureValues);
        break;
      }
      case 'anomaly_detection': {
        const normalizedScore = Math.abs(weightedSum) / (model.featureCount * 2);
        const isAnomaly = normalizedScore > 0.7;
        value = isAnomaly ? 'anomaly' : 'normal';
        confidence = isAnomaly ? normalizedScore : 1 - normalizedScore;
        break;
      }
      default: {
        value = weightedSum;
        confidence = 0.5;
      }
    }

    const result: PredictionResult = {
      value,
      confidence: Math.round(confidence * 1000) / 1000,
      predictedAt: new Date(),
      modelId,
      inputFeatures: features,
    };

    // 保存预测历史
    await this.savePredictionHistory(modelId, result);

    return result;
  }

  /**
   * 获取预测置信度
   */
  getPredictionConfidence(prediction: PredictionResult): number {
    return prediction.confidence;
  }

  /**
   * 批量预测
   */
  async batchPredict(
    featureSets: Array<Record<string, number>>,
    modelId: string
  ): Promise<BatchPredictionResult> {
    const startTime = Date.now();
    const predictions: PredictionResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const features of featureSets) {
      try {
        const result = await this.predict(features, modelId);
        predictions.push(result);
        successCount++;
      } catch {
        failureCount++;
      }
    }

    return {
      predictions,
      totalDurationMs: Date.now() - startTime,
      successCount,
      failureCount,
    };
  }

  /**
   * 获取租户的预测历史
   */
  async getPredictionHistory(modelId: string, limit: number = 50): Promise<PredictionResult[]> {
    if (this.predictionRepo) {
      const entities = await this.predictionRepo.findByModel(modelId, limit);
      return entities.map(e => this.entityToPrediction(e));
    }
    return [];
  }

  /**
   * 获取模型性能统计
   */
  async getModelPerformance(modelId: string): Promise<ModelPerformance | null> {
    const model = this.models.get(modelId);
    if (!model) {
      return null;
    }

    let history: PredictionResult[];
    let totalCount: number;

    if (this.predictionRepo) {
      const entities = await this.predictionRepo.findByModel(modelId, 1000);
      history = entities.map(e => this.entityToPrediction(e));
      totalCount = await this.predictionRepo.findByModelCount(modelId);
    } else {
      history = [];
      totalCount = 0;
    }

    if (history.length === 0) {
      return {
        modelId,
        modelName: model.name,
        modelType: model.modelType,
        totalPredictions: 0,
        averageConfidence: 0,
        minConfidence: 0,
        maxConfidence: 0,
        status: model.status,
      };
    }

    const confidences = history.map((p) => p.confidence);
    const totalConfidence = confidences.reduce((sum, c) => sum + c, 0);
    const lastPrediction = history[history.length - 1];

    return {
      modelId,
      modelName: model.name,
      modelType: model.modelType,
      totalPredictions: totalCount,
      averageConfidence: Math.round((totalConfidence / history.length) * 1000) / 1000,
      minConfidence: Math.min(...confidences),
      maxConfidence: Math.max(...confidences),
      lastPredictionAt: lastPrediction.predictedAt,
      status: model.status,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 注册预置模拟模型
   */
  private registerDefaultModels(): void {
    const defaultModels: MLModel[] = [
      {
        modelId: 'pipeline-failure-predictor',
        name: 'Pipeline Failure Predictor',
        version: '2.1.0',
        featureNames: ['build_duration', 'test_count', 'code_changes', 'history_failure_rate'],
        featureCount: 4,
        modelType: 'classification',
        status: 'unloaded',
      },
      {
        modelId: 'cost-estimator',
        name: 'Resource Cost Estimator',
        version: '1.5.0',
        featureNames: ['cpu_cores', 'memory_gb', 'disk_gb', 'duration_hours'],
        featureCount: 4,
        modelType: 'regression',
        status: 'unloaded',
      },
      {
        modelId: 'anomaly-detector',
        name: 'Deployment Anomaly Detector',
        version: '3.0.0',
        featureNames: ['error_rate', 'latency_p99', 'cpu_usage', 'memory_usage', 'request_rate'],
        featureCount: 5,
        modelType: 'anomaly_detection',
        status: 'unloaded',
      },
    ];

    for (const model of defaultModels) {
      this.models.set(model.modelId, model);
    }
  }

  /**
   * 获取预置模型模板
   */
  private getDefaultModel(modelId: string): MLModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * 验证特征
   */
  private validateFeatures(features: Record<string, number>, model: MLModel): void {
    const featureCount = Object.keys(features).length;
    if (featureCount === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Features cannot be empty');
    }
  }

  /**
   * 生成模拟权重
   */
  private generateWeights(featureCount: number): number[] {
    // 使用固定的种子值确保可重复性
    const weights: number[] = [];
    for (let i = 0; i < featureCount; i++) {
      weights.push((Math.sin(i * 1.5 + 0.5) + 1) * 0.5); // [0, 1] 范围
    }
    return weights;
  }

  /**
   * Sigmoid 激活函数
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  /**
   * 计算回归置信度（基于特征值的方差）
   */
  private calculateRegressionConfidence(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    // 方差越小，置信度越高
    return Math.max(0.1, Math.min(0.99, 1 - variance / 10));
  }

  /**
   * 保存预测历史
   */
  private async savePredictionHistory(modelId: string, result: PredictionResult): Promise<void> {
    if (this.predictionRepo) {
      await this.predictionRepo.create({
        id: uuidv4(),
        model_id: modelId,
        value_json: result.value,
        confidence: result.confidence,
        predicted_at: result.predictedAt,
        input_features: result.inputFeatures,
      });
      // Prune old records (keep latest 500)
      await this.predictionRepo.pruneOldRecords(modelId, 500);
    }
  }

  // ==================== Entity Conversion ====================

  private entityToPrediction(entity: PredictionHistoryEntity): PredictionResult {
    return {
      value: entity.value_json as number | string,
      confidence: entity.confidence,
      predictedAt: entity.predicted_at,
      modelId: entity.model_id,
      inputFeatures: entity.input_features,
    };
  }

  private entityToRegistry(entity: AIModelRegistryEntity): ModelRegistryEntry {
    return {
      modelId: entity.model_id,
      name: entity.name,
      versions: (entity.versions_json as unknown as ModelVersionEntry[]) ?? [],
      activeVersion: entity.active_version ?? undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  private entityToABTest(entity: AIABTestEntity): ABTestConfig {
    return {
      id: entity.id,
      name: entity.name,
      modelId: entity.model_id,
      variantA: entity.variant_a as unknown as ABTestConfig['variantA'],
      variantB: entity.variant_b as unknown as ABTestConfig['variantB'],
      status: entity.status as ABTestConfig['status'],
      startedAt: entity.started_at ?? new Date(),
      completedAt: entity.completed_at ?? undefined,
      winner: entity.winner ?? undefined,
      metrics: entity.metrics as unknown as ABTestConfig['metrics'],
    };
  }
}
