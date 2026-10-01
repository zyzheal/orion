/**
 * 韧性评分 API 路由
 *
 * 提供系统韧性评估功能：
 * - GET /api/v1/resilience-score - 获取全局韧性评分
 * - GET /api/v1/resilience-score/services - 获取服务韧性评分列表
 * - GET /api/v1/resilience-score/services/:name - 获取特定服务韧性评分
 * - GET /api/v1/resilience-score/history - 获取韧性评分历史
 * - GET /api/v1/resilience-score/recommendations - 获取韧性改进建议
 * - POST /api/v1/resilience-score/assess - 执行韧性评估
 * - GET /api/v1/resilience-score/components - 获取韧性组件评分
 * - POST /api/v1/resilience-score/benchmarks - 创建基准对比
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PaginationHelper, OffsetPaginationParams } from '../utils/pagination';

/**
 * 韧性评分等级枚举
 */
export enum ResilienceLevel {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

/**
 * 韧性组件枚举
 */
export enum ResilienceComponent {
  REDUNDANCY = 'redundancy',
  FAILOVER = 'failover',
  RECOVERY = 'recovery',
  MONITORING = 'monitoring',
  TESTING = 'testing',
  SECURITY = 'security',
  SCALABILITY = 'scalability',
  DEPENDENCY = 'dependency',
}

/**
 * 全局韧性评分
 */
export interface GlobalResilienceScore {
  overallScore: number;
  level: ResilienceLevel;
  components: ComponentScore[];
  trends: {
    direction: 'up' | 'down' | 'stable';
    change: number;
    period: string;
  };
  lastAssessment: string;
  nextAssessment: string;
  riskFactors: string[];
  topRecommendations: string[];
}

/**
 * 组件评分
 */
export interface ComponentScore {
  component: ResilienceComponent;
  score: number;
  level: ResilienceLevel;
  details: {
    metric: string;
    value: number;
    weight: number;
  }[];
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * 服务韧性评分
 */
export interface ServiceResilienceScore {
  serviceName: string;
  overallScore: number;
  level: ResilienceLevel;
  components: ComponentScore[];
  dependencies: {
    name: string;
    criticality: 'high' | 'medium' | 'low';
    health: 'healthy' | 'degraded' | 'unhealthy';
  }[];
  incidents: {
    count: number;
    lastIncident?: string;
    mttr?: number;
    mtbf?: number;
  };
  lastAssessment: string;
}

/**
 * 韧性历史记录
 */
export interface ResilienceHistory {
  id: string;
  timestamp: string;
  overallScore: number;
  level: ResilienceLevel;
  componentScores: Record<ResilienceComponent, number>;
  trigger: 'scheduled' | 'manual' | 'incident' | 'change';
  details?: Record<string, unknown>;
}

/**
 * 韧性改进建议
 */
export interface ResilienceRecommendation {
  id: string;
  component: ResilienceComponent;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentScore: number;
  potentialImprovement: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  actions: string[];
  references: string[];
}

/**
 * 韧性基准对比
 */
export interface ResilienceBenchmark {
  id: string;
  name: string;
  timestamp: string;
  currentScore: number;
  benchmarkScore: number;
  comparison: {
    component: ResilienceComponent;
    current: number;
    benchmark: number;
    gap: number;
  }[];
  analysis: string;
}

/**
 * 评估请求
 */
export interface AssessResilienceRequest {
  scope: 'global' | 'service' | 'component';
  serviceName?: string;
  components?: ResilienceComponent[];
  deepAnalysis?: boolean;
}

/**
 * 创建基准请求
 */
export interface CreateBenchmarkRequest {
  name: string;
  baselineType: 'industry' | 'internal' | 'custom';
  customScores?: Record<ResilienceComponent, number>;
}

/**
 * 韧性评分服务类
 */
export class ResilienceScoreService {
  private serviceScores: Map<string, ServiceResilienceScore> = new Map();
  private history: ResilienceHistory[] = [];
  private recommendations: ResilienceRecommendation[] = [];
  private benchmarks: Map<string, ResilienceBenchmark> = new Map();
  private assessmentCounter = 0;

  /**
   * 获取全局韧性评分
   */
  async getGlobalScore(): Promise<GlobalResilienceScore> {
    const services = Array.from(this.serviceScores.values());
    const avgScore = services.length > 0
      ? services.reduce((sum, s) => sum + s.overallScore, 0) / services.length
      : this.calculateDefaultScore();

    const level = this.getLevelFromScore(avgScore);
    const components = this.aggregateComponentScores(services);

    // 获取趋势
    const recentHistory = this.history.slice(0, 5);
    const change = recentHistory.length >= 2
      ? recentHistory[0].overallScore - recentHistory[1].overallScore
      : 0;

    return {
      overallScore: Math.round(avgScore),
      level,
      components,
      trends: {
        direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
        change,
        period: '30 days',
      },
      lastAssessment: this.history[0]?.timestamp || new Date().toISOString(),
      nextAssessment: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      riskFactors: this.identifyRiskFactors(components),
      topRecommendations: this.getTopRecommendations(3),
    };
  }

  /**
   * 获取服务韧性评分列表
   */
  async getServiceScores(params: OffsetPaginationParams): Promise<{ data: ServiceResilienceScore[]; total: number }> {
    let services = Array.from(this.serviceScores.values());

    const sortField = params.sort || 'overallScore';
    const sortOrder = params.order || 'desc';
    services.sort((a, b) => {
      const aVal = a[sortField as keyof ServiceResilienceScore] as number;
      const bVal = b[sortField as keyof ServiceResilienceScore] as number;
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const total = services.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: services.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 获取特定服务韧性评分
   */
  async getServiceScore(name: string): Promise<ServiceResilienceScore | null> {
    return this.serviceScores.get(name) || null;
  }

  /**
   * 获取韧性历史
   */
  async getHistory(params: OffsetPaginationParams): Promise<{ data: ResilienceHistory[]; total: number }> {
    const total = this.history.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: this.history.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 获取韧性改进建议
   */
  async getRecommendations(params: OffsetPaginationParams & { priority?: string; component?: ResilienceComponent }): Promise<{ data: ResilienceRecommendation[]; total: number }> {
    let recs = this.recommendations;

    if (params.priority) {
      recs = recs.filter(r => r.priority === params.priority);
    }
    if (params.component) {
      recs = recs.filter(r => r.component === params.component);
    }

    const total = recs.length;
    const offset = params.offset || 0;
    const limit = params.limit || 20;

    return {
      data: recs.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * 执行韧性评估
   */
  async assessResilience(data: AssessResilienceRequest): Promise<ServiceResilienceScore | GlobalResilienceScore> {
    this.assessmentCounter++;

    if (data.scope === 'service' && data.serviceName) {
      const serviceScore = await this.assessService(data.serviceName, data.deepAnalysis);
      this.serviceScores.set(data.serviceName, serviceScore);

      // 添加历史记录
      this.addHistory('manual', {
        serviceName: data.serviceName,
        scope: 'service',
      });

      return serviceScore;
    }

    // 全局评估
    await this.assessAllServices();
    const globalScore = await this.getGlobalScore();

    this.addHistory('manual', { scope: 'global' });

    return globalScore;
  }

  /**
   * 获取韧性组件评分
   */
  async getComponentScores(): Promise<{ component: ResilienceComponent; global: number; breakdown: { service: string; score: number }[] }[]> {
    const services = Array.from(this.serviceScores.values());
    const results: { component: ResilienceComponent; global: number; breakdown: { service: string; score: number }[] }[] = [];

    for (const component of Object.values(ResilienceComponent)) {
      const breakdown = services.map(s => {
        const compScore = s.components.find(c => c.component === component);
        return { service: s.serviceName, score: compScore?.score || 0 };
      });

      const globalScore = breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length;

      results.push({
        component,
        global: Math.round(globalScore),
        breakdown,
      });
    }

    return results;
  }

  /**
   * 创建基准对比
   */
  async createBenchmark(data: CreateBenchmarkRequest): Promise<ResilienceBenchmark> {
    const globalScore = await this.getGlobalScore();
    const benchmarkScores = data.baselineType === 'custom' && data.customScores
      ? data.customScores
      : this.getIndustryBenchmark();

    const comparison = globalScore.components.map(c => ({
      component: c.component,
      current: c.score,
      benchmark: benchmarkScores[c.component] || 75,
      gap: c.score - (benchmarkScores[c.component] || 75),
    }));

    const benchmarkBenchmarkScore = Object.values(benchmarkScores).reduce((a, b) => a + b, 0) / Object.values(benchmarkScores).length;

    const benchmark: ResilienceBenchmark = {
      id: `benchmark_${Date.now()}_${this.assessmentCounter}`,
      name: data.name,
      timestamp: new Date().toISOString(),
      currentScore: globalScore.overallScore,
      benchmarkScore: Math.round(benchmarkBenchmarkScore),
      comparison,
      analysis: this.generateBenchmarkAnalysis(comparison),
    };

    this.benchmarks.set(benchmark.id, benchmark);
    return benchmark;
  }

  /**
   * 计算默认评分
   */
  private calculateDefaultScore(): number {
    // 模拟各组件评分
    return Math.round(50 + Math.random() * 30);
  }

  /**
   * 根据评分获取等级
   */
  private getLevelFromScore(score: number): ResilienceLevel {
    if (score >= 90) return ResilienceLevel.EXCELLENT;
    if (score >= 75) return ResilienceLevel.GOOD;
    if (score >= 60) return ResilienceLevel.FAIR;
    if (score >= 40) return ResilienceLevel.POOR;
    return ResilienceLevel.CRITICAL;
  }

  /**
   * 汇总组件评分
   */
  private aggregateComponentScores(services: ServiceResilienceScore[]): ComponentScore[] {
    const componentMap = new Map<ResilienceComponent, { total: number; count: number; details: any[] }>();

    for (const service of services) {
      for (const comp of service.components) {
        const existing = componentMap.get(comp.component) || { total: 0, count: 0, details: [] };
        existing.total += comp.score;
        existing.count++;
        existing.details.push(...comp.details);
        componentMap.set(comp.component, existing);
      }
    }

    return Array.from(componentMap.entries()).map(([component, data]) => ({
      component,
      score: Math.round(data.total / data.count),
      level: this.getLevelFromScore(data.total / data.count),
      details: data.details.slice(0, 5),
      status: data.total / data.count >= 70 ? 'healthy' : data.total / data.count >= 50 ? 'warning' : 'critical',
    }));
  }

  /**
   * 识别风险因素
   */
  private identifyRiskFactors(components: ComponentScore[]): string[] {
    return components
      .filter(c => c.score < 60)
      .map(c => `${c.component} 韧性不足 (${c.score}分)`);
  }

  /**
   * 获取顶级建议
   */
  private getTopRecommendations(count: number): string[] {
    return this.recommendations
      .filter(r => r.priority === 'high')
      .slice(0, count)
      .map(r => r.title);
  }

  /**
   * 评估单个服务
   */
  private async assessService(serviceName: string, deepAnalysis?: boolean): Promise<ServiceResilienceScore> {
    // 模拟评估
    const components: ComponentScore[] = Object.values(ResilienceComponent).map(comp => {
      const baseScore = 50 + Math.random() * 40;
      return {
        component: comp,
        score: Math.round(baseScore),
        level: this.getLevelFromScore(baseScore),
        details: [
          { metric: 'availability', value: Math.random() * 0.1 + 0.9, weight: 0.3 },
          { metric: 'mttr', value: Math.random() * 60 + 5, weight: 0.2 },
          { metric: 'test_coverage', value: Math.random() * 0.5 + 0.5, weight: 0.15 },
        ],
        status: baseScore >= 70 ? 'healthy' : baseScore >= 50 ? 'warning' : 'critical',
      };
    });

    const overallScore = Math.round(components.reduce((sum, c) => sum + c.score, 0) / components.length);

    return {
      serviceName,
      overallScore,
      level: this.getLevelFromScore(overallScore),
      components,
      dependencies: [
        { name: 'database', criticality: 'high', health: 'healthy' },
        { name: 'cache', criticality: 'medium', health: 'healthy' },
        { name: 'api-gateway', criticality: 'high', health: 'healthy' },
      ],
      incidents: {
        count: Math.floor(Math.random() * 5),
        lastIncident: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        mttr: Math.round(Math.random() * 120 + 10),
        mtbf: Math.round(Math.random() * 720 + 240),
      },
      lastAssessment: new Date().toISOString(),
    };
  }

  /**
   * 评估所有服务
   */
  private async assessAllServices(): Promise<void> {
    const defaultServices = ['pipeline-service', 'auth-service', 'ai-service', 'platform-service', 'notification-service'];

    for (const serviceName of defaultServices) {
      const score = await this.assessService(serviceName);
      this.serviceScores.set(serviceName, score);
    }

    // 生成建议
    this.generateRecommendations();
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(): void {
    this.recommendations = [
      {
        id: 'rec_1',
        component: ResilienceComponent.REDUNDANCY,
        priority: 'high',
        title: '增加服务副本数',
        description: '关键服务副本数不足，建议增加到至少3个副本',
        currentScore: 65,
        potentialImprovement: 15,
        effort: 'low',
        impact: 'high',
        actions: ['调整 deployment replicas', '配置 HPA 策略', '添加 Pod 反亲和性'],
        references: ['Kubernetes 最佳实践'],
      },
      {
        id: 'rec_2',
        component: ResilienceComponent.MONITORING,
        priority: 'medium',
        title: '完善监控指标',
        description: '添加更多业务指标监控',
        currentScore: 70,
        potentialImprovement: 10,
        effort: 'medium',
        impact: 'medium',
        actions: ['添加自定义指标', '配置告警规则', '优化仪表盘'],
        references: ['监控最佳实践'],
      },
      {
        id: 'rec_3',
        component: ResilienceComponent.TESTING,
        priority: 'high',
        title: '增加混沌测试',
        description: '定期执行混沌工程实验以提高系统韧性',
        currentScore: 55,
        potentialImprovement: 20,
        effort: 'medium',
        impact: 'high',
        actions: ['配置 Chaos Mesh', '制定实验计划', '建立恢复机制'],
        references: ['混沌工程指南'],
      },
    ];
  }

  /**
   * 添加历史记录
   */
  private addHistory(trigger: ResilienceHistory['trigger'], details?: Record<string, unknown>): void {
    const globalScore = this.calculateDefaultScore();

    this.history.unshift({
      id: `hist_${Date.now()}_${this.assessmentCounter}`,
      timestamp: new Date().toISOString(),
      overallScore: globalScore,
      level: this.getLevelFromScore(globalScore),
      componentScores: {
        [ResilienceComponent.REDUNDANCY]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.FAILOVER]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.RECOVERY]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.MONITORING]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.TESTING]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.SECURITY]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.SCALABILITY]: Math.round(50 + Math.random() * 30),
        [ResilienceComponent.DEPENDENCY]: Math.round(50 + Math.random() * 30),
      },
      trigger,
      details,
    });
  }

  /**
   * 获取行业标准基准
   */
  private getIndustryBenchmark(): Record<ResilienceComponent, number> {
    return {
      [ResilienceComponent.REDUNDANCY]: 85,
      [ResilienceComponent.FAILOVER]: 80,
      [ResilienceComponent.RECOVERY]: 75,
      [ResilienceComponent.MONITORING]: 85,
      [ResilienceComponent.TESTING]: 70,
      [ResilienceComponent.SECURITY]: 90,
      [ResilienceComponent.SCALABILITY]: 80,
      [ResilienceComponent.DEPENDENCY]: 75,
    };
  }

  /**
   * 生成基准分析
   */
  private generateBenchmarkAnalysis(comparison: { component: ResilienceComponent; current: number; benchmark: number; gap: number }[]): string {
    const gaps = comparison.filter(c => c.gap < 0);
    if (gaps.length === 0) {
      return '系统韧性评分达到或超过行业标准基准，整体表现优秀。';
    }

    const worstGap = gaps.sort((a, b) => a.gap - b.gap)[0];
    return `系统在 ${worstGap.component} 方面与行业基准差距最大 (差距 ${Math.abs(worstGap.gap)} 分)，建议优先改进。`;
  }
}

// 单例服务实例
export const resilienceScoreService = new ResilienceScoreService();

/**
 * 韧性评分路由类
 */
export class ResilienceScoreRoutes {
  constructor(private app: FastifyInstance) {}

  register(): void {
    // GET /api/v1/resilience-score - 获取全局韧性评分
    this.app.get('/api/v1/resilience-score', async (request: FastifyRequest, reply: FastifyReply) => {
      const score = await resilienceScoreService.getGlobalScore();
      return reply.send(score);
    });

    // GET /api/v1/resilience-score/services - 获取服务韧性评分列表
    this.app.get('/api/v1/resilience-score/services', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await resilienceScoreService.getServiceScores(paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // GET /api/v1/resilience-score/services/:name - 获取特定服务韧性评分
    this.app.get('/api/v1/resilience-score/services/:name', async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { name: string };
      const score = await resilienceScoreService.getServiceScore(params.name);

      if (!score) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Service resilience score not found',
        });
      }

      return reply.send(score);
    });

    // GET /api/v1/resilience-score/history - 获取韧性评分历史
    this.app.get('/api/v1/resilience-score/history', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams;

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await resilienceScoreService.getHistory(paginationParams);

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // GET /api/v1/resilience-score/recommendations - 获取韧性改进建议
    this.app.get('/api/v1/resilience-score/recommendations', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as OffsetPaginationParams & { priority?: string; component?: ResilienceComponent };

      const paginationParams = PaginationHelper.parseOffsetParams(query);
      const { data, total } = await resilienceScoreService.getRecommendations({
        ...paginationParams,
        priority: query.priority,
        component: query.component,
      });

      return reply.send(
        PaginationHelper.createOffsetResponse(data, {
          offset: paginationParams.offset || 0,
          limit: paginationParams.limit || 20,
          total,
        })
      );
    });

    // POST /api/v1/resilience-score/assess - 执行韧性评估
    this.app.post('/api/v1/resilience-score/assess', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as AssessResilienceRequest;
      const result = await resilienceScoreService.assessResilience(body);
      return reply.send(result);
    });

    // GET /api/v1/resilience-score/components - 获取韧性组件评分
    this.app.get('/api/v1/resilience-score/components', async (request: FastifyRequest, reply: FastifyReply) => {
      const components = await resilienceScoreService.getComponentScores();
      return reply.send({ data: components });
    });

    // POST /api/v1/resilience-score/benchmarks - 创建基准对比
    this.app.post('/api/v1/resilience-score/benchmarks', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateBenchmarkRequest;
      const benchmark = await resilienceScoreService.createBenchmark(body);
      return reply.code(201).send(benchmark);
    });
  }
}