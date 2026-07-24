/**
 * 数字孪生 API 路由
 *
 * 提供数字孪生管理功能：
 * - GET /api/v1/digital-twin - 获取数字孪生列表
 * - POST /api/v1/digital-twin - 创建数字孪生
 * - GET /api/v1/digital-twin/:id - 获取数字孪生详情
 * - PUT /api/v1/digital-twin/:id - 更新数字孪生配置
 * - DELETE /api/v1/digital-twin/:id - 删除数字孪生
 * - POST /api/v1/digital-twin/:id/sync - 同步真实环境状态
 * - GET /api/v1/digital-twin/:id/state - 获取孪生状态
 * - POST /api/v1/digital-twin/:id/simulate - 执行模拟
 * - GET /api/v1/digital-twin/:id/simulations - 获取模拟历史
 * - GET /api/v1/digital-twin/:id/comparison - 获取真实与孪生对比
 * - POST /api/v1/digital-twin/:id/predict - 执行预测分析
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 数字孪生状态枚举
 */
export enum TwinStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  SYNCING = 'syncing',
  SIMULATING = 'simulating',
  PAUSED = 'paused',
  ERROR = 'error',
  ARCHIVED = 'archived',
}

/**
 * 模拟类型枚举
 */
export enum SimulationType {
  PERFORMANCE = 'performance',
  CAPACITY = 'capacity',
  FAILURE = 'failure',
  MIGRATION = 'migration',
  UPDATE = 'update',
  SCALING = 'scaling',
  SECURITY = 'security',
  COST = 'cost',
  CUSTOM = 'custom',
}

/**
 * 数字孪生实体类型枚举
 */
export enum EntityType {
  PIPELINE = 'pipeline',
  SERVICE = 'service',
  INFRASTRUCTURE = 'infrastructure',
  ENVIRONMENT = 'environment',
  CLUSTER = 'cluster',
  NETWORK = 'network',
  APPLICATION = 'application',
}

/**
 * 数字孪生配置
 */
export interface DigitalTwin {
  id: string;
  name: string;
  description: string;
  entityType: EntityType;
  sourceId: string; // 真实环境实体 ID
  status: TwinStatus;
  config: TwinConfig;
  metadata: Record<string, unknown>;
  syncPolicy: SyncPolicy;
  lastSyncTime?: string;
  syncHealth: 'healthy' | 'warning' | 'critical';
  createdAt: string;
  updatedAt: string;
}

/**
 * 孪生配置
 */
export interface TwinConfig {
  modelType: 'static' | 'dynamic' | 'predictive';
  updateFrequency: number;
  precision: 'high' | 'medium' | 'low';
  components: {
    name: string;
    enabled: boolean;
    weight: number;
  }[];
  dataSource: {
    type: 'real-time' | 'batch' | 'hybrid';
    endpoints: string[];
    metrics: string[];
  };
}

/**
 * 同步策略
 */
export interface SyncPolicy {
  autoSync: boolean;
  interval: number;
  fullSyncInterval: number;
  retryCount: number;
  timeout: number;
}

/**
 * 孪生状态
 */
export interface TwinState {
  twinId: string;
  timestamp: string;
  status: TwinStatus;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  performance: {
    throughput: number;
    latency: number;
    errorRate: number;
    availability: number;
  };
  dependencies: {
    name: string;
    health: 'healthy' | 'degraded' | 'unhealthy';
  }[];
  events: {
    type: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'error';
  }[];
}

/**
 * 模拟配置
 */
export interface Simulation {
  id: string;
  twinId: string;
  type: SimulationType;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  results?: SimulationResult;
  createdAt: string;
}

/**
 * 模拟结果
 */
export interface SimulationResult {
  success: boolean;
  metrics: {
    name: string;
    baseline: number;
    simulated: number;
    delta: number;
    unit: string;
  }[];
  insights: string[];
  risks: {
    description: string;
    probability: number;
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }[];
  recommendations: string[];
  visualizations: {
    type: 'chart' | 'graph' | 'heatmap';
    data: Record<string, unknown>;
  }[];
}

/**
 * 真实与孪生对比
 */
export interface TwinComparison {
  twinId: string;
  timestamp: string;
  metrics: {
    name: string;
    realValue: number;
    twinValue: number;
    deviation: number;
    accuracy: number;
    unit: string;
  }[];
  overallAccuracy: number;
  discrepancies: {
    metric: string;
    deviation: number;
    cause: string;
    recommendation: string;
  }[];
}

/**
 * 预测结果
 */
export interface PredictionResult {
  twinId: string;
  predictionType: string;
  timestamp: string;
  forecastPeriod: string;
  predictions: {
    metric: string;
    values: {
      timestamp: string;
      predicted: number;
      confidence: number;
      lowerBound: number;
      upperBound: number;
    }[];
    trend: 'increasing' | 'decreasing' | 'stable';
    anomalyProbability: number;
  }[];
  confidence: number;
  assumptions: string[];
  warnings: string[];
}

/**
 * 创建孪生请求
 */
export interface CreateTwinRequest {
  name: string;
  description: string;
  entityType: EntityType;
  sourceId: string;
  config?: Partial<TwinConfig>;
  syncPolicy?: Partial<SyncPolicy>;
  metadata?: Record<string, unknown>;
}

/**
 * 更新孪生请求
 */
export interface UpdateTwinRequest {
  name?: string;
  description?: string;
  config?: Partial<TwinConfig>;
  syncPolicy?: Partial<SyncPolicy>;
  metadata?: Record<string, unknown>;
}

/**
 * 模拟请求
 */
export interface SimulateRequest {
  type: SimulationType;
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  duration?: number;
}

/**
 * 预测请求
 */
export interface PredictRequest {
  predictionType: 'capacity' | 'performance' | 'failure' | 'cost';
  forecastPeriod: string;
  metrics?: string[];
}

/**
 * 数字孪生服务类
 */
export class DigitalTwinService {
  private twins: Map<string, DigitalTwin> = new Map();
  private states: Map<string, TwinState[]> = new Map();
  private simulations: Map<string, Simulation[]> = new Map();
  private twinCounter = 0;
  private simulationCounter = 0;

  /**
   * 生成孪生 ID
   */
  private generateTwinId(): string {
    this.twinCounter++;
    return `twin_${Date.now()}_${this.twinCounter}`;
  }

  /**
   * 生成模拟 ID
   */
  private generateSimulationId(): string {
    this.simulationCounter++;
    return `sim_${Date.now()}_${this.simulationCounter}`;
  }

  /**
   * 创建数字孪生
   */
  async createTwin(data: CreateTwinRequest): Promise<DigitalTwin> {
    const id = this.generateTwinId();
    const now = new Date().toISOString();

    const twin: DigitalTwin = {
      id,
      name: data.name,
      description: data.description,
      entityType: data.entityType,
      sourceId: data.sourceId,
      status: TwinStatus.INITIALIZING,
      config: {
        modelType: data.config?.modelType || 'dynamic',
        updateFrequency: data.config?.updateFrequency || 60000,
        precision: data.config?.precision || 'medium',
        components: data.config?.components || [],
        dataSource: data.config?.dataSource || {
          type: 'hybrid',
          endpoints: [],
          metrics: ['cpu', 'memory', 'latency', 'throughput'],
        },
      },
      syncPolicy: {
        autoSync: data.syncPolicy?.autoSync ?? true,
        interval: data.syncPolicy?.interval || 30000,
        fullSyncInterval: data.syncPolicy?.fullSyncInterval || 300000,
        retryCount: data.syncPolicy?.retryCount || 3,
        timeout: data.syncPolicy?.timeout || 10000,
      },
      metadata: data.metadata || {},
      syncHealth: 'healthy',
      createdAt: now,
      updatedAt: now,
    };

    this.twins.set(id, twin);

    // 初始化状态
    await this.initializeState(id);

    return twin;
  }

  /**
   * 获取孪生列表
   */
  async listTwins(
    params: OffsetPaginationParams,
    filters?: {
      entityType?: EntityType;
      status?: TwinStatus;
      sourceId?: string;
    }
  ): Promise<{ data: DigitalTwin[]; total: number }> {
    let twins = Array.from(this.twins.values());

    if (filters?.entityType) {
      twins = twins.filter(t => t.entityType === filters.entityType);
    }
    if (filters?.status) {
      twins = twins.filter(t => t.status === filters.status);
    }
    if (filters?.sourceId) {
      twins = twins.filter(t => t.sourceId === filters.sourceId);
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    twins.sort((a, b) => {
      const aVal = a[sortField as keyof DigitalTwin];
      const bVal = b[sortField as keyof DigitalTwin];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = twins.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    twins = twins.slice(offset, offset + limit);

    return { data: twins, total };
  }

  /**
   * 获取孪生详情
   */
  async getTwin(id: string): Promise<DigitalTwin | null> {
    return this.twins.get(id) || null;
  }

  /**
   * 更新孪生配置
   */
  async updateTwin(id: string, data: UpdateTwinRequest): Promise<DigitalTwin> {
    const twin = await this.getTwin(id);
    if (!twin) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'digital_twin',
        identifier: id,
      });
    }

    const updated: DigitalTwin = {
      ...twin,
      ...data,
      config: data.config ? { ...twin.config, ...data.config } : twin.config,
      syncPolicy: data.syncPolicy ? { ...twin.syncPolicy, ...data.syncPolicy } : twin.syncPolicy,
      updatedAt: new Date().toISOString(),
    };

    this.twins.set(id, updated);
    return updated;
  }

  /**
   * 删除孪生
   */
  async deleteTwin(id: string): Promise<void> {
    const twin = await this.getTwin(id);
    if (!twin) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'digital_twin',
        identifier: id,
      });
    }

    this.twins.delete(id);
    this.states.delete(id);
    this.simulations.delete(id);
  }

  /**
   * 同步真实环境状态
   */
  async syncTwin(id: string): Promise<DigitalTwin> {
    const twin = await this.getTwin(id);
    if (!twin) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'digital_twin',
        identifier: id,
      });
    }

    twin.status = TwinStatus.SYNCING;
    twin.updatedAt = new Date().toISOString();
    this.twins.set(id, twin);

    // 模拟同步
    const state = await this.generateState(id);
    const states = this.states.get(id) || [];
    states.unshift(state);
    this.states.set(id, states);

    twin.status = TwinStatus.ACTIVE;
    twin.lastSyncTime = new Date().toISOString();
    twin.syncHealth = 'healthy';
    twin.updatedAt = new Date().toISOString();
    this.twins.set(id, twin);

    return twin;
  }

  /**
   * 获取孪生状态
   */
  async getState(id: string): Promise<TwinState | null> {
    const states = this.states.get(id) || [];
    return states[0] || null;
  }

  /**
   * 执行模拟
   */
  async simulate(id: string, data: SimulateRequest): Promise<Simulation> {
    const twin = await this.getTwin(id);
    if (!twin) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'digital_twin',
        identifier: id,
      });
    }

    twin.status = TwinStatus.SIMULATING;
    twin.updatedAt = new Date().toISOString();
    this.twins.set(id, twin);

    const simulation: Simulation = {
      id: this.generateSimulationId(),
      twinId: id,
      type: data.type,
      name: data.name,
      description: data.description || '',
      parameters: data.parameters,
      status: 'running',
      startTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const simulations = this.simulations.get(id) || [];
    simulations.unshift(simulation);
    this.simulations.set(id, simulations);

    // 生成模拟结果
    simulation.status = 'completed';
    simulation.endTime = new Date().toISOString();
    simulation.duration = data.duration || 60000;
    simulation.results = this.generateSimulationResults(data.type);

    twin.status = TwinStatus.ACTIVE;
    twin.updatedAt = new Date().toISOString();
    this.twins.set(id, twin);

    return simulation;
  }

  /**
   * 获取模拟历史
   */
  async getSimulations(id: string, params: OffsetPaginationParams): Promise<{ data: Simulation[]; total: number }> {
    const simulations = this.simulations.get(id) || [];
    const total = simulations.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: simulations.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 获取真实与孪生对比
   */
  async getComparison(id: string): Promise<TwinComparison> {
    const twin = await this.getTwin(id);
    if (!twin) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'digital_twin',
        identifier: id,
      });
    }

    const state = await this.getState(id);
    const metrics = [
      { name: 'cpu', realValue: 65, twinValue: state?.resources.cpu || 60, unit: '%' },
      { name: 'memory', realValue: 78, twinValue: state?.resources.memory || 75, unit: '%' },
      { name: 'throughput', realValue: 1200, twinValue: state?.performance.throughput || 1150, unit: 'req/s' },
      { name: 'latency', realValue: 45, twinValue: state?.performance.latency || 50, unit: 'ms' },
    ];

    const comparisonMetrics = metrics.map(m => ({
      ...m,
      deviation: Math.abs(m.realValue - m.twinValue),
      accuracy: 100 - Math.abs((m.realValue - m.twinValue) / m.realValue * 100),
    }));

    const overallAccuracy = comparisonMetrics.reduce((sum, m) => sum + m.accuracy, 0) / comparisonMetrics.length;

    return {
      twinId: id,
      timestamp: new Date().toISOString(),
      metrics: comparisonMetrics,
      overallAccuracy,
      discrepancies: comparisonMetrics
        .filter(m => m.deviation > 5)
        .map(m => ({
          metric: m.name,
          deviation: m.deviation,
          cause: '数据采集延迟或模型精度不足',
          recommendation: '调整更新频率或提高模型精度',
        })),
    };
  }

  /**
   * 执行预测分析
   */
  async predict(id: string, data: PredictRequest): Promise<PredictionResult> {
    const twin = await this.getTwin(id);
    if (!twin) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'digital_twin',
        identifier: id,
      });
    }

    const metrics = data.metrics || ['cpu', 'memory', 'throughput', 'latency'];
    const now = Date.now();

    const predictions = metrics.map(metric => {
      const values = [];
      const baseValue = 50 + Math.random() * 30;

      for (let i = 1; i <= 7; i++) {
        const timestamp = new Date(now + i * 24 * 60 * 60 * 1000).toISOString();
        const predicted = baseValue + Math.random() * 20 * i;
        const confidence = 0.9 - 0.05 * i;

        values.push({
          timestamp,
          predicted,
          confidence,
          lowerBound: predicted * (1 - (1 - confidence) / 2),
          upperBound: predicted * (1 + (1 - confidence) / 2),
        });
      }

      return {
        metric,
        values,
        trend: values[values.length - 1].predicted > baseValue ? 'increasing' : 'stable',
        anomalyProbability: Math.random() * 0.1,
      };
    });

    return {
      twinId: id,
      predictionType: data.predictionType,
      timestamp: new Date().toISOString(),
      forecastPeriod: data.forecastPeriod,
      predictions,
      confidence: 0.85,
      assumptions: [
        '假设当前负载模式保持稳定',
        '假设没有重大配置变更',
        '假设硬件资源不受限',
      ],
      warnings: predictions.some(p => p.anomalyProbability > 0.05)
        ? ['部分指标存在异常风险，建议关注']
        : [],
    };
  }

  /**
   * 初始化状态
   */
  private async initializeState(id: string): Promise<void> {
    const state = await this.generateState(id);
    this.states.set(id, [state]);
  }

  /**
   * 生成状态数据
   */
  private async generateState(id: string): Promise<TwinState> {
    return {
      twinId: id,
      timestamp: new Date().toISOString(),
      status: TwinStatus.ACTIVE,
      resources: {
        cpu: 40 + Math.random() * 30,
        memory: 50 + Math.random() * 30,
        storage: 30 + Math.random() * 20,
        network: 20 + Math.random() * 40,
      },
      performance: {
        throughput: 800 + Math.random() * 400,
        latency: 30 + Math.random() * 50,
        errorRate: Math.random() * 0.05,
        availability: 0.99 + Math.random() * 0.01,
      },
      dependencies: [
        { name: 'database', health: 'healthy' },
        { name: 'cache', health: 'healthy' },
        { name: 'api-gateway', health: 'healthy' },
      ],
      events: [],
    };
  }

  /**
   * 生成模拟结果
   */
  private generateSimulationResults(type: SimulationType): SimulationResult {
    const success = Math.random() > 0.2;

    const metrics = [
      { name: 'throughput', baseline: 1000, simulated: 1200, unit: 'req/s' },
      { name: 'latency', baseline: 50, simulated: 40, unit: 'ms' },
      { name: 'cpu', baseline: 60, simulated: 75, unit: '%' },
      { name: 'memory', baseline: 70, simulated: 85, unit: '%' },
    ].map(m => ({
      ...m,
      delta: m.simulated - m.baseline,
    }));

    const risks = [
      {
        description: '资源使用可能超出阈值',
        probability: 0.3,
        impact: 'medium',
        mitigation: '增加资源配置或优化性能',
      },
    ];

    const recommendations = [
      '建议在实施前进行小规模测试',
      '监控关键指标变化',
      '准备回滚方案',
    ];

    return {
      success,
      metrics,
      insights: [
        `${type} 模拟完成`,
        `吞吐量提升 ${metrics[0].delta > 0 ? metrics[0].delta : 0} req/s`,
        `延迟降低 ${metrics[1].delta < 0 ? Math.abs(metrics[1].delta) : 0} ms`,
      ],
      risks,
      recommendations,
      visualizations: [
        { type: 'chart', data: { metrics: metrics.map(m => ({ name: m.name, values: [m.baseline, m.simulated] })) } },
      ],
    };
  }
}

// 单例服务实例
export const digitalTwinService = new DigitalTwinService();

/**
 * 数字孪生路由类
 */
export class DigitalTwinRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/digital-twin - 获取数字孪生列表
    this.app.get('/api/v1/digital-twin', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        entityType?: EntityType;
        status?: TwinStatus;
        sourceId?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await digitalTwinService.listTwins(
        paginationParams,
        {
          entityType: query.entityType,
          status: query.status,
          sourceId: query.sourceId,
        }
      );

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/digital-twin - 创建数字孪生
    this.app.post('/api/v1/digital-twin', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateTwinRequest;
      const twin = await digitalTwinService.createTwin(body);
      return reply.code(201).send(twin);
    });

    // GET /api/v1/digital-twin/:id - 获取数字孪生详情
    this.app.get('/api/v1/digital-twin/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const twin = await digitalTwinService.getTwin(params.id);

      if (!twin) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'digital_twin',
          identifier: params.id,
        });
      }

      return reply.send(twin);
    });

    // PUT /api/v1/digital-twin/:id - 更新数字孪生配置
    this.app.put('/api/v1/digital-twin/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpdateTwinRequest;

      const twin = await digitalTwinService.updateTwin(params.id, body);
      return reply.send(twin);
    });

    // DELETE /api/v1/digital-twin/:id - 删除数字孪生
    this.app.delete('/api/v1/digital-twin/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      await digitalTwinService.deleteTwin(params.id);
      return reply.code(204).send();
    });

    // POST /api/v1/digital-twin/:id/sync - 同步真实环境状态
    this.app.post('/api/v1/digital-twin/:id/sync', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const twin = await digitalTwinService.syncTwin(params.id);
      return reply.send(twin);
    });

    // GET /api/v1/digital-twin/:id/state - 获取孪生状态
    this.app.get('/api/v1/digital-twin/:id/state', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const state = await digitalTwinService.getState(params.id);

      if (!state) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Twin state not found',
        });
      }

      return reply.send(state);
    });

    // POST /api/v1/digital-twin/:id/simulate - 执行模拟
    this.app.post('/api/v1/digital-twin/:id/simulate', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as SimulateRequest;

      const simulation = await digitalTwinService.simulate(params.id, body);
      return reply.send(simulation);
    });

    // GET /api/v1/digital-twin/:id/simulations - 获取模拟历史
    this.app.get('/api/v1/digital-twin/:id/simulations', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await digitalTwinService.getSimulations(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // GET /api/v1/digital-twin/:id/comparison - 获取真实与孪生对比
    this.app.get('/api/v1/digital-twin/:id/comparison', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const comparison = await digitalTwinService.getComparison(params.id);
      return reply.send(comparison);
    });

    // POST /api/v1/digital-twin/:id/predict - 执行预测分析
    this.app.post('/api/v1/digital-twin/:id/predict', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as PredictRequest;

      const prediction = await digitalTwinService.predict(params.id, body);
      return reply.send(prediction);
    });
  }
}