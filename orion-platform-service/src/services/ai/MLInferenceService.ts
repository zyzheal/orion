import { OrionError, ErrorCode } from '../../../errors';
/**
 * ML 模型推理集成服务
 *
 * 提供模型加载、推理预测、置信度评估、批量预测能力
 * 支持模型注册表、版本追踪、A/B 测试和回滚
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
  /** 已加载的模型 */
  private models: Map<string, MLModel> = new Map();
  /** 预测历史记录 */
  private predictionHistory: Map<string, PredictionResult[]> = new Map();
  /** 模型注册表 */
  private modelRegistry: Map<string, ModelRegistryEntry> = new Map();
  /** A/B 测试配置 */
  private abTests: Map<string, ABTestConfig> = new Map();

  constructor() {
    // 预置模拟模型
    this.registerDefaultModels();
  }

  // ==================== 模型注册表 ====================

  /**
   * 注册模型到注册表
   */
  registerModelToRegistry(modelId: string, name: string, version: string, options?: {
    featureNames?: string[];
    featureCount?: number;
    modelType?: 'classification' | 'regression' | 'anomaly_detection';
    modelPath?: string;
    metrics?: ModelVersionEntry['metrics'];
  }): ModelRegistryEntry {
    const now = new Date();
    let registry = this.modelRegistry.get(modelId);

    if (!registry) {
      registry = {
        modelId,
        name,
        versions: [],
        createdAt: now,
        updatedAt: now,
      };
      this.modelRegistry.set(modelId, registry);
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

    return registry;
  }

  /**
   * 获取模型注册表信息
   */
  getModelRegistry(modelId: string): ModelRegistryEntry | undefined {
    return this.modelRegistry.get(modelId);
  }

  /**
   * 列出所有注册的模型
   */
  listRegistry(): ModelRegistryEntry[] {
    return Array.from(this.modelRegistry.values());
  }

  /**
   * 激活模型版本
   */
  activateModelVersion(modelId: string, version: string): ModelRegistryEntry {
    const registry = this.modelRegistry.get(modelId);
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

    return registry;
  }

  /**
   * 回滚到上一个模型版本
   */
  rollbackModelVersion(modelId: string, targetVersion?: string): ModelRegistryEntry {
    const registry = this.modelRegistry.get(modelId);
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

    return registry;
  }

  // ==================== A/B 测试 ====================

  /**
   * 创建 A/B 测试
   */
  createABTest(config: {
    id: string;
    name: string;
    modelId: string;
    variantA: { version: string; trafficPercent: number };
    variantB: { version: string; trafficPercent: number };
  }): ABTestConfig {
    const registry = this.modelRegistry.get(config.modelId);
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

    this.abTests.set(config.id, abTest);
    return abTest;
  }

  /**
   * 获取 A/B 测试配置
   */
  getABTest(testId: string): ABTestConfig | undefined {
    return this.abTests.get(testId);
  }

  /**
   * 完成 A/B 测试并选出获胜者
   */
  completeABTest(testId: string): ABTestConfig {
    const abTest = this.abTests.get(testId);
    if (!abTest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `AB test not found: ${testId}`);
    }

    const { variantA, variantB } = abTest.metrics;
    const scoreA = variantA.successRate * 0.6 + variantA.avgConfidence * 0.4;
    const scoreB = variantB.successRate * 0.6 + variantB.avgConfidence * 0.4;

    abTest.winner = scoreA >= scoreB ? abTest.variantA.version : abTest.variantB.version;
    abTest.status = 'completed';
    abTest.completedAt = new Date();

    return abTest;
  }

  /**
   * 暂停 A/B 测试
   */
  pauseABTest(testId: string): ABTestConfig {
    const abTest = this.abTests.get(testId);
    if (!abTest) {
      throw new OrionError(ErrorCode.NOT_FOUND, `AB test not found: ${testId}`);
    }
    if (abTest.status === 'completed') {
      throw new OrionError(ErrorCode.VALIDATION_ERROR, 'AB test is already completed');
    }

    abTest.status = 'paused';
    return abTest;
  }

  /**
   * 记录 A/B 测试请求结果
   */
  recordABTestRequest(testId: string, variant: 'A' | 'B', success: boolean, confidence: number): void {
    const abTest = this.abTests.get(testId);
    if (!abTest || abTest.status !== 'running') return;

    const metrics = abTest.metrics[variant === 'A' ? 'variantA' : 'variantB'];
    const totalPredictions = metrics.predictions + 1;
    metrics.predictions = totalPredictions;
    metrics.avgConfidence =
      (metrics.avgConfidence * (totalPredictions - 1) + confidence) / totalPredictions;
    metrics.successRate =
      (metrics.successRate * (totalPredictions - 1) + (success ? 1 : 0)) / totalPredictions;
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
  predict(features: Record<string, number>, modelId: string): PredictionResult {
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
    this.savePredictionHistory(modelId, result);

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
  batchPredict(
    featureSets: Array<Record<string, number>>,
    modelId: string
  ): BatchPredictionResult {
    const startTime = Date.now();
    const predictions: PredictionResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const features of featureSets) {
      try {
        const result = this.predict(features, modelId);
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
  getPredictionHistory(modelId: string, limit: number = 50): PredictionResult[] {
    const history = this.predictionHistory.get(modelId) ?? [];
    return history.slice(-limit);
  }

  /**
   * 获取模型性能统计
   */
  getModelPerformance(modelId: string): ModelPerformance | null {
    const model = this.models.get(modelId);
    if (!model) {
      return null;
    }

    const history = this.predictionHistory.get(modelId) ?? [];

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
      totalPredictions: history.length,
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
  private savePredictionHistory(modelId: string, result: PredictionResult): void {
    const history = this.predictionHistory.get(modelId) ?? [];
    history.push(result);
    // 保留最近 500 条
    if (history.length > 500) {
      history.splice(0, history.length - 500);
    }
    this.predictionHistory.set(modelId, history);
  }
}
