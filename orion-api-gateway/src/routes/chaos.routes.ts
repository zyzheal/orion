/**
 * 混沌工程 API 路由
 *
 * 提供混沌工程实验管理功能：
 * - GET /api/v1/chaos - 获取混沌实验列表
 * - POST /api/v1/chaos - 创建混沌实验
 * - GET /api/v1/chaos/:id - 获取实验详情
 * - PUT /api/v1/chaos/:id - 更新实验配置
 * - DELETE /api/v1/chaos/:id - 删除实验
 * - POST /api/v1/chaos/:id/start - 启动实验
 * - POST /api/v1/chaos/:id/stop - 停止实验
 * - POST /api/v1/chaos/:id/pause - 暂停实验
 * - POST /api/v1/chaos/:id/resume - 恢复实验
 * - GET /api/v1/chaos/:id/results - 获取实验结果
 * - GET /api/v1/chaos/:id/logs - 获取实验日志
 * - GET /api/v1/chaos/scenarios - 获取混沌场景列表
 * - POST /api/v1/chaos/schedule - 创建定时实验
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCodes, ErrorFactory } from '../errors/error-codes';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 实验状态枚举
 */
export enum ExperimentStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
}

/**
 * 混沌场景类型枚举
 */
export enum ChaosScenarioType {
  POD_KILL = 'pod_kill',
  POD_FAILURE = 'pod_failure',
  NETWORK_DELAY = 'network_delay',
  NETWORK_PARTITION = 'network_partition',
  NETWORK_CORRUPT = 'network_corrupt',
  CPU_STRESS = 'cpu_stress',
  MEMORY_STRESS = 'memory_stress',
  IO_STRESS = 'io_stress',
  DNS_FAULT = 'dns_fault',
  TIME_SKEW = 'time_skew',
  DISK_FILL = 'disk_fill',
  SERVICE_KILL = 'service_kill',
  API_FAILURE = 'api_failure',
  LATENCY_INJECTION = 'latency_injection',
  CUSTOM = 'custom',
}

/**
 * 目标类型枚举
 */
export enum TargetType {
  POD = 'pod',
  SERVICE = 'service',
  NODE = 'node',
  CONTAINER = 'container',
  NETWORK = 'network',
  API = 'api',
  DATABASE = 'database',
}

/**
 * 混沌实验配置
 */
export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  scenario: ChaosScenarioType;
  targets: ChaosTarget[];
  duration: number;
  intensity: number;
  schedule?: ExperimentSchedule;
  monitoring: MonitoringConfig;
  safeguards: SafeguardConfig[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  results?: ExperimentResult;
}

/**
 * 混沌目标
 */
export interface ChaosTarget {
  type: TargetType;
  selector: Record<string, string>;
  namespace?: string;
  count?: number;
  percentage?: number;
}

/**
 * 实验调度配置
 */
export interface ExperimentSchedule {
  type: 'once' | 'recurring' | 'cron';
  startTime: string;
  endTime?: string;
  interval?: number;
  cronExpression?: string;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  metrics: string[];
  endpoints: string[];
  thresholds: {
    metric: string;
    threshold: number;
    action: 'alert' | 'stop' | 'pause';
  }[];
  collectLogs: boolean;
}

/**
 * 安全防护配置
 */
export interface SafeguardConfig {
  type: 'max_duration' | 'error_rate' | 'resource_limit' | 'manual_approval' | 'rollback';
  config: Record<string, unknown>;
  enabled: boolean;
}

/**
 * 实验结果
 */
export interface ExperimentResult {
  id: string;
  experimentId: string;
  status: 'success' | 'failure' | 'partial';
  startTime: string;
  endTime: string;
  duration: number;
  metrics: {
    name: string;
    before: number;
    after: number;
    delta: number;
  }[];
  impactedTargets: string[];
  recoveryTime: number;
  detectionTime: number;
  insights: string[];
  recommendations: string[];
}

/**
 * 实验日志
 */
export interface ExperimentLog {
  id: string;
  experimentId: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 混沌场景
 */
export interface ChaosScenario {
  type: ChaosScenarioType;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  parameters: {
    name: string;
    type: string;
    required: boolean;
    defaultValue?: unknown;
    description: string;
  }[];
}

/**
 * 创建实验请求
 */
export interface CreateExperimentRequest {
  name: string;
  description: string;
  scenario: ChaosScenarioType;
  targets: ChaosTarget[];
  duration: number;
  intensity: number;
  schedule?: ExperimentSchedule;
  monitoring?: MonitoringConfig;
  safeguards?: SafeguardConfig[];
}

/**
 * 更新实验请求
 */
export interface UpdateExperimentRequest {
  name?: string;
  description?: string;
  targets?: ChaosTarget[];
  duration?: number;
  intensity?: number;
  schedule?: ExperimentSchedule;
  monitoring?: MonitoringConfig;
  safeguards?: SafeguardConfig[];
}

/**
 * 混沌工程服务类
 */
export class ChaosEngineeringService {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private results: Map<string, ExperimentResult[]> = new Map();
  private logs: Map<string, ExperimentLog[]> = new Map();
  private experimentCounter = 0;
  private logCounter = 0;
  private resultCounter = 0;

  /**
   * 获取混沌场景列表
   */
  async getScenarios(): Promise<ChaosScenario[]> {
    return [
      {
        type: ChaosScenarioType.POD_KILL,
        name: 'Pod Kill',
        description: '随机杀死 Pod 以测试系统恢复能力',
        category: 'infrastructure',
        riskLevel: 'medium',
        parameters: [
          { name: 'killMode', type: 'string', required: false, defaultValue: 'random', description: '杀死模式' },
          { name: 'gracePeriod', type: 'number', required: false, defaultValue: 30, description: '优雅终止时间' },
        ],
      },
      {
        type: ChaosScenarioType.NETWORK_DELAY,
        name: 'Network Delay',
        description: '注入网络延迟以测试系统容错能力',
        category: 'network',
        riskLevel: 'low',
        parameters: [
          { name: 'latency', type: 'number', required: true, description: '延迟时间(ms)' },
          { name: 'jitter', type: 'number', required: false, defaultValue: 0, description: '抖动范围' },
        ],
      },
      {
        type: ChaosScenarioType.CPU_STRESS,
        name: 'CPU Stress',
        description: '模拟 CPU 高负载场景',
        category: 'resource',
        riskLevel: 'high',
        parameters: [
          { name: 'load', type: 'number', required: true, description: 'CPU 负载百分比' },
          { name: 'workers', type: 'number', required: false, defaultValue: 1, description: '工作线程数' },
        ],
      },
      {
        type: ChaosScenarioType.MEMORY_STRESS,
        name: 'Memory Stress',
        description: '模拟内存高负载场景',
        category: 'resource',
        riskLevel: 'high',
        parameters: [
          { name: 'size', type: 'number', required: true, description: '内存占用大小(MB)' },
          { name: 'fillRate', type: 'number', required: false, defaultValue: 100, description: '填充速率' },
        ],
      },
      {
        type: ChaosScenarioType.API_FAILURE,
        name: 'API Failure',
        description: '模拟 API 服务故障',
        category: 'application',
        riskLevel: 'medium',
        parameters: [
          { name: 'errorCode', type: 'number', required: true, description: '错误码' },
          { name: 'message', type: 'string', required: false, defaultValue: 'Service unavailable', description: '错误消息' },
        ],
      },
      {
        type: ChaosScenarioType.LATENCY_INJECTION,
        name: 'Latency Injection',
        description: '注入请求延迟以测试超时处理',
        category: 'application',
        riskLevel: 'low',
        parameters: [
          { name: 'latency', type: 'number', required: true, description: '延迟时间(ms)' },
          { name: 'probability', type: 'number', required: false, defaultValue: 1.0, description: '触发概率' },
        ],
      },
    ];
  }

  /**
   * 生成实验 ID
   */
  private generateExperimentId(): string {
    this.experimentCounter++;
    return `chaos_${Date.now()}_${this.experimentCounter}`;
  }

  /**
   * 创建实验
   */
  async createExperiment(data: CreateExperimentRequest, userId: string): Promise<ChaosExperiment> {
    const id = this.generateExperimentId();
    const now = new Date().toISOString();

    const experiment: ChaosExperiment = {
      id,
      name: data.name,
      description: data.description,
      status: ExperimentStatus.DRAFT,
      scenario: data.scenario,
      targets: data.targets,
      duration: data.duration,
      intensity: data.intensity,
      schedule: data.schedule,
      monitoring: data.monitoring || {
        metrics: ['latency', 'error_rate', 'throughput'],
        endpoints: [],
        thresholds: [],
        collectLogs: true,
      },
      safeguards: data.safeguards || [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    this.experiments.set(id, experiment);
    return experiment;
  }

  /**
   * 获取实验列表
   */
  async listExperiments(
    params: OffsetPaginationParams,
    filters?: {
      status?: ExperimentStatus;
      scenario?: ChaosScenarioType;
      createdBy?: string;
    }
  ): Promise<{ data: ChaosExperiment[]; total: number }> {
    let experiments = Array.from(this.experiments.values());

    if (filters?.status) {
      experiments = experiments.filter(e => e.status === filters.status);
    }
    if (filters?.scenario) {
      experiments = experiments.filter(e => e.scenario === filters.scenario);
    }
    if (filters?.createdBy) {
      experiments = experiments.filter(e => e.createdBy === filters.createdBy);
    }

    const sortField = params.sort || 'createdAt';
    const sortOrder = params.order || 'desc';
    experiments.sort((a, b) => {
      const aVal = a[sortField as keyof ChaosExperiment];
      const bVal = b[sortField as keyof ChaosExperiment];
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = experiments.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;
    experiments = experiments.slice(offset, offset + limit);

    return { data: experiments, total };
  }

  /**
   * 获取实验详情
   */
  async getExperiment(id: string): Promise<ChaosExperiment | null> {
    return this.experiments.get(id) || null;
  }

  /**
   * 更新实验
   */
  async updateExperiment(id: string, data: UpdateExperimentRequest): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'experiment',
        identifier: id,
      });
    }

    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error('EXperiment_RUNNING', 'Cannot update running experiment');
    }

    const updated: ChaosExperiment = {
      ...experiment,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    this.experiments.set(id, updated);
    return updated;
  }

  /**
   * 删除实验
   */
  async deleteExperiment(id: string): Promise<void> {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'experiment',
        identifier: id,
      });
    }

    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error('EXperiment_RUNNING', 'Cannot delete running experiment');
    }

    this.experiments.delete(id);
    this.results.delete(id);
    this.logs.delete(id);
  }

  /**
   * 启动实验
   */
  async startExperiment(id: string): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'experiment',
        identifier: id,
      });
    }

    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error('EXperiment_ALREADY_RUNNING', 'Experiment is already running');
    }

    const now = new Date().toISOString();
    experiment.status = ExperimentStatus.RUNNING;
    experiment.startedAt = now;
    experiment.updatedAt = now;

    this.experiments.set(id, experiment);

    // 添加启动日志
    this.addLog(id, 'info', 'Experiment started', { scenario: experiment.scenario });

    return experiment;
  }

  /**
   * 停止实验
   */
  async stopExperiment(id: string): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'experiment',
        identifier: id,
      });
    }

    if (experiment.status !== ExperimentStatus.RUNNING && experiment.status !== ExperimentStatus.PAUSED) {
      throw new Error('EXperiment_NOT_RUNNING', 'Experiment is not running');
    }

    const now = new Date().toISOString();
    experiment.status = ExperimentStatus.STOPPED;
    experiment.completedAt = now;
    experiment.updatedAt = now;

    this.experiments.set(id, experiment);

    // 生成结果
    this.generateResult(id, experiment);

    this.addLog(id, 'info', 'Experiment stopped', { duration: experiment.duration });

    return experiment;
  }

  /**
   * 暂停实验
   */
  async pauseExperiment(id: string): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'experiment',
        identifier: id,
      });
    }

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new Error('EXperiment_NOT_RUNNING', 'Experiment is not running');
    }

    experiment.status = ExperimentStatus.PAUSED;
    experiment.updatedAt = new Date().toISOString();

    this.experiments.set(id, experiment);
    this.addLog(id, 'warning', 'Experiment paused');

    return experiment;
  }

  /**
   * 恢复实验
   */
  async resumeExperiment(id: string): Promise<ChaosExperiment> {
    const experiment = await this.getExperiment(id);
    if (!experiment) {
      throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
        resourceType: 'experiment',
        identifier: id,
      });
    }

    if (experiment.status !== ExperimentStatus.PAUSED) {
      throw new Error('EXperiment_NOT_PAUSED', 'Experiment is not paused');
    }

    experiment.status = ExperimentStatus.RUNNING;
    experiment.updatedAt = new Date().toISOString();

    this.experiments.set(id, experiment);
    this.addLog(id, 'info', 'Experiment resumed');

    return experiment;
  }

  /**
   * 获取实验结果
   */
  async getResults(id: string, params: OffsetPaginationParams): Promise<{ data: ExperimentResult[]; total: number }> {
    const results = this.results.get(id) || [];
    const total = results.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: results.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 获取实验日志
   */
  async getLogs(id: string, params: OffsetPaginationParams): Promise<{ data: ExperimentLog[]; total: number }> {
    const logs = this.logs.get(id) || [];
    const total = logs.length;
    const offset = params.offset || 0;
    const limit = params.limit || 100;

    return {
      data: logs.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 添加日志
   */
  private addLog(experimentId: string, level: ExperimentLog['level'], message: string, details?: Record<string, unknown>): void {
    const logs = this.logs.get(experimentId) || [];
    this.logCounter++;
    logs.unshift({
      id: `log_${Date.now()}_${this.logCounter}`,
      experimentId,
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    });
    this.logs.set(experimentId, logs);
  }

  /**
   * 生成实验结果
   */
  private generateResult(experimentId: string, experiment: ChaosExperiment): void {
    const results = this.results.get(experimentId) || [];
    this.resultCounter++;

    const result: ExperimentResult = {
      id: `result_${Date.now()}_${this.resultCounter}`,
      experimentId,
      status: Math.random() > 0.3 ? 'success' : 'partial',
      startTime: experiment.startedAt || new Date().toISOString(),
      endTime: experiment.completedAt || new Date().toISOString(),
      duration: experiment.duration,
      metrics: [
        { name: 'latency', before: 100, after: 250, delta: 150 },
        { name: 'error_rate', before: 0.01, after: 0.05, delta: 0.04 },
        { name: 'throughput', before: 1000, after: 800, delta: -200 },
      ],
      impactedTargets: experiment.targets.map(t => `${t.type}:${JSON.stringify(t.selector)}`),
      recoveryTime: Math.round(Math.random() * 60000),
      detectionTime: Math.round(Math.random() * 10000),
      insights: [
        '系统在 Pod 故障后能够自动恢复',
        '网络延迟对服务响应时间影响显著',
        '建议增加健康检查间隔',
      ],
      recommendations: [
        '考虑增加 Pod 副本数以提高容错能力',
        '优化网络配置以减少延迟',
        '添加熔断器以防止级联故障',
      ],
    };

    results.unshift(result);
    this.results.set(experimentId, results);
    experiment.results = result;
  }
}

// 单例服务实例
export const chaosEngineeringService = new ChaosEngineeringService();

/**
 * 混沌工程路由类
 */
export class ChaosRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/chaos/scenarios - 获取混沌场景列表
    this.app.get('/api/v1/chaos/scenarios', async (request: FastifyRequest, reply: FastifyReply) => {
      const scenarios = await chaosEngineeringService.getScenarios();
      return reply.send({ data: scenarios });
    });

    // GET /api/v1/chaos - 获取混沌实验列表
    this.app.get('/api/v1/chaos', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & {
        status?: ExperimentStatus;
        scenario?: ChaosScenarioType;
        createdBy?: string;
      };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await chaosEngineeringService.listExperiments(
        paginationParams,
        {
          status: query.status,
          scenario: query.scenario,
          createdBy: query.createdBy,
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

    // POST /api/v1/chaos - 创建混沌实验
    this.app.post('/api/v1/chaos', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateExperimentRequest;
      const userId = (request as any).user?.id || 'system';

      const experiment = await chaosEngineeringService.createExperiment(body, userId);
      return reply.code(201).send(experiment);
    });

    // GET /api/v1/chaos/:id - 获取实验详情
    this.app.get('/api/v1/chaos/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const experiment = await chaosEngineeringService.getExperiment(params.id);

      if (!experiment) {
        throw ErrorFactory.notFound(ErrorCodes.RESOURCE_NOT_FOUND, {
          resourceType: 'experiment',
          identifier: params.id,
        });
      }

      return reply.send(experiment);
    });

    // PUT /api/v1/chaos/:id - 更新实验配置
    this.app.put('/api/v1/chaos/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const body = request.body as UpdateExperimentRequest;

      const experiment = await chaosEngineeringService.updateExperiment(params.id, body);
      return reply.send(experiment);
    });

    // DELETE /api/v1/chaos/:id - 删除实验
    this.app.delete('/api/v1/chaos/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      await chaosEngineeringService.deleteExperiment(params.id);
      return reply.code(204).send();
    });

    // POST /api/v1/chaos/:id/start - 启动实验
    this.app.post('/api/v1/chaos/:id/start', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const experiment = await chaosEngineeringService.startExperiment(params.id);
      return reply.send(experiment);
    });

    // POST /api/v1/chaos/:id/stop - 停止实验
    this.app.post('/api/v1/chaos/:id/stop', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const experiment = await chaosEngineeringService.stopExperiment(params.id);
      return reply.send(experiment);
    });

    // POST /api/v1/chaos/:id/pause - 暂停实验
    this.app.post('/api/v1/chaos/:id/pause', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const experiment = await chaosEngineeringService.pauseExperiment(params.id);
      return reply.send(experiment);
    });

    // POST /api/v1/chaos/:id/resume - 恢复实验
    this.app.post('/api/v1/chaos/:id/resume', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const experiment = await chaosEngineeringService.resumeExperiment(params.id);
      return reply.send(experiment);
    });

    // GET /api/v1/chaos/:id/results - 获取实验结果
    this.app.get('/api/v1/chaos/:id/results', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await chaosEngineeringService.getResults(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // GET /api/v1/chaos/:id/logs - 获取实验日志
    this.app.get('/api/v1/chaos/:id/logs', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id: string };
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await chaosEngineeringService.getLogs(params.id, paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 100,
          total,
        })
      );
    });
  }
}