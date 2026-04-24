/**
 * 风险评估服务
 *
 * 职责：
 * - 编排风险评估流程
 * - 存储和检索评估历史
 * - 生成评估报告
 * - 发布风险评估事件
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RiskAssessment,
  RiskReport,
  DeploymentRisk,
  RiskLevel,
  RiskFactor,
  RiskRecommendation,
  RiskAssessmentEventData,
  RiskTargetType,
  RiskAssessmentServiceConfig,
  HealthCheckResult,
} from './types';
import { RiskScoringEngine } from './RiskScoringEngine';
import { HealthCheckService } from './HealthCheckService';
import { RiskAssessmentRepository, RiskAssessmentEntity } from '../../repositories/RiskAssessmentRepository';

/**
 * 风险评估服务
 */
export class RiskAssessmentService {
  private scoringEngine: RiskScoringEngine;
  private healthCheckService: HealthCheckService;
  private eventBus: any;
  private assessmentRepository?: RiskAssessmentRepository;
  private reportHistory: Map<string, RiskReport>;

  constructor(config?: RiskAssessmentServiceConfig, db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.scoringEngine = new RiskScoringEngine();
    this.healthCheckService = new HealthCheckService({
      config: config?.healthCheckConfig,
    });
    this.eventBus = config?.eventBus;
    this.reportHistory = new Map();
    if (db) {
      this.assessmentRepository = new RiskAssessmentRepository(db);
    }
  }

  /**
   * 评估部署风险
   *
   * 综合部署风险评估数据，生成完整风险评估
   */
  async assessDeploymentRisk(params: {
    deploymentId: string;
    deploymentRisk: DeploymentRisk;
    tenantId?: string;
    runHealthChecks?: boolean;
    healthCheckParams?: {
      pipelineStatus?: string;
      testResults?: { total: number; passed: number; failed: number };
      codeReviewStatus?: 'approved' | 'pending' | 'rejected' | 'none';
      dependencies?: string[];
    };
  }): Promise<RiskAssessment> {
    const assessmentId = uuidv4();
    const { deploymentRisk, tenantId } = params;

    // 1. 计算风险评分
    const riskScore = this.scoringEngine.calculateRiskScore(deploymentRisk);

    // 2. 获取风险因子
    const factors = this.scoringEngine.getRiskFactors(deploymentRisk);

    // 3. 评估风险等级
    const riskLevel = this.scoringEngine.evaluateRiskLevel(riskScore);

    // 4. 生成建议
    const recommendations = this.scoringEngine.generateRecommendations(factors, riskLevel);

    // 5. 运行健康检查（可选）
    let healthCheckResult: HealthCheckResult | undefined;
    if (params.runHealthChecks && params.healthCheckParams) {
      healthCheckResult = await this.healthCheckService.runPreDeploymentChecks({
        targetId: params.deploymentId,
        ...params.healthCheckParams,
      });

      // 如果健康检查未通过，增加风险评分
      if (!healthCheckResult.canProceed) {
        recommendations.push({
          id: uuidv4(),
          type: 'block',
          title: '发布前检查未通过',
          description: `健康检查发现 ${healthCheckResult.failed} 个失败项: ${healthCheckResult.checks.filter((c) => c.status === 'fail').map((c) => c.details).join('; ')}`,
          priority: 'critical',
        });
      }
    }

    const assessment: RiskAssessment = {
      id: assessmentId,
      targetType: 'deployment',
      targetId: params.deploymentId,
      riskScore,
      riskLevel,
      factors,
      recommendations,
      createdAt: new Date(),
      tenantId,
      metadata: healthCheckResult ? { healthCheckResult } : undefined,
    };

    // 存储评估到 Repository
    if (this.assessmentRepository) {
      await this.assessmentRepository.create({
        tenantId: tenantId ?? 'default',
        name: `Risk assessment for deployment ${params.deploymentId}`,
        type: 'deployment',
        targetType: 'deployment',
        targetId: params.deploymentId,
        score: riskScore,
        riskLevel,
        findings: factors,
        status: 'completed',
        createdAt: new Date(),
      });
    }

    // 发布风险评估事件
    await this.publishRiskAssessmentEvent(assessment, healthCheckResult);

    return assessment;
  }

  /**
   * 评估变更风险
   *
   * 针对代码变更进行风险评估
   */
  async assessChangeRisk(params: {
    changeId: string;
    deploymentRisk: DeploymentRisk;
    tenantId?: string;
  }): Promise<RiskAssessment> {
    const { deploymentRisk, tenantId } = params;

    // 计算风险评分
    const riskScore = this.scoringEngine.calculateRiskScore(deploymentRisk);
    const factors = this.scoringEngine.getRiskFactors(deploymentRisk);
    const riskLevel = this.scoringEngine.evaluateRiskLevel(riskScore);
    const recommendations = this.scoringEngine.generateRecommendations(factors, riskLevel);

    const assessment: RiskAssessment = {
      id: uuidv4(),
      targetType: 'change',
      targetId: params.changeId,
      riskScore,
      riskLevel,
      factors,
      recommendations,
      createdAt: new Date(),
      tenantId,
    };

    if (this.assessmentRepository) {
      await this.assessmentRepository.create({
        tenantId: tenantId ?? 'default',
        name: `Risk assessment for change ${params.changeId}`,
        type: 'change',
        targetType: 'change',
        targetId: params.changeId,
        score: riskScore,
        riskLevel,
        findings: factors,
        status: 'completed',
        createdAt: new Date(),
      });
    }

    await this.publishRiskAssessmentEvent(assessment);

    return assessment;
  }

  /**
   * 获取评估历史
   */
  async getAssessmentHistory(filter?: {
    targetType?: RiskTargetType;
    targetId?: string;
    tenantId?: string;
    riskLevel?: RiskLevel;
    since?: Date;
    limit?: number;
  }): Promise<RiskAssessment[]> {
    if (this.assessmentRepository) {
      let entities: RiskAssessmentEntity[];

      if (filter?.targetType && filter?.targetId) {
        entities = await this.assessmentRepository.findByTarget(filter.targetType, filter.targetId);
      } else if (filter?.tenantId) {
        entities = await this.assessmentRepository.findByTenant(filter.tenantId, { limit: filter?.limit ?? 20 });
      } else {
        const result = await this.assessmentRepository.findAll({ limit: filter?.limit ?? 20 });
        entities = result.entities;
      }

      return entities.map(e => this.mapEntityToAssessment(e));
    }
    return [];
  }

  /**
   * 获取单个评估详情
   */
  async getAssessmentById(assessmentId: string): Promise<RiskAssessment | undefined> {
    if (this.assessmentRepository) {
      const entity = await this.assessmentRepository.findById(assessmentId);
      return entity ? this.mapEntityToAssessment(entity) : undefined;
    }
    return undefined;
  }

  private mapEntityToAssessment(entity: RiskAssessmentEntity): RiskAssessment {
    return {
      id: entity.id,
      targetType: entity.targetType as RiskTargetType,
      targetId: entity.targetId,
      riskScore: entity.score ?? 0,
      riskLevel: entity.riskLevel as RiskLevel ?? 'Medium',
      factors: entity.findings as RiskFactor[] ?? [],
      recommendations: [],
      createdAt: entity.createdAt,
      tenantId: entity.tenantId,
    };
  }

  /**
   * 生成风险评估报告
   */
  async generateReport(assessmentId: string): Promise<RiskReport | null> {
    const assessment = await this.getAssessmentById(assessmentId);
    if (!assessment) return null;

    const technicalFactors = assessment.factors.filter((f) => f.category === 'technical');
    const historicalFactors = assessment.factors.filter((f) => f.category === 'historical');
    const organizationalFactors = assessment.factors.filter((f) => f.category === 'organizational');

    const criticalRiskCount = assessment.factors.filter((f) => f.score > 70).length;
    const healthCheckResult = assessment.metadata?.healthCheckResult as HealthCheckResult | undefined;

    const canDeploy =
      assessment.riskLevel !== 'Critical' &&
      (!healthCheckResult || healthCheckResult.canProceed);

    const report: RiskReport = {
      id: uuidv4(),
      assessmentId,
      summary: {
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        canDeploy,
        criticalRiskCount,
        healthCheckResult,
      },
      details: {
        technicalFactors,
        historicalFactors,
        organizationalFactors,
      },
      recommendations: assessment.recommendations,
      generatedAt: new Date(),
      tenantId: assessment.tenantId,
    };

    this.reportHistory.set(report.id, report);
    return report;
  }

  /**
   * 获取报告历史
   */
  getReportHistory(filter?: {
    assessmentId?: string;
    tenantId?: string;
    limit?: number;
  }): RiskReport[] {
    let results = Array.from(this.reportHistory.values());

    if (filter?.assessmentId) {
      results = results.filter((r) => r.assessmentId === filter.assessmentId);
    }
    if (filter?.tenantId) {
      results = results.filter((r) => r.tenantId === filter.tenantId);
    }

    results.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

    if (filter?.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * 获取单个报告
   */
  getReportById(reportId: string): RiskReport | undefined {
    return this.reportHistory.get(reportId);
  }

  /**
   * 获取健康检查服务实例
   */
  getHealthCheckService(): HealthCheckService {
    return this.healthCheckService;
  }

  /**
   * 获取评分引擎实例
   */
  getScoringEngine(): RiskScoringEngine {
    return this.scoringEngine;
  }

  /**
   * 清空报告历史（用于测试）
   * 注意：评估记录存储在数据库中，需要通过 Repository 删除
   */
  clearHistory(): void {
    this.reportHistory.clear();
  }

  // ==================== 私有方法 ====================

  /**
   * 发布风险评估事件
   */
  private async publishRiskAssessmentEvent(
    assessment: RiskAssessment,
    healthCheckResult?: HealthCheckResult
  ): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    try {
      const { CloudEvent } = await import('@orion/event-bus');
      const eventData: RiskAssessmentEventData = {
        assessmentId: assessment.id,
        targetType: assessment.targetType,
        targetId: assessment.targetId,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        healthCheckPassed: healthCheckResult ? healthCheckResult.canProceed : true,
        canProceed: assessment.riskLevel !== 'Critical' && (!healthCheckResult || healthCheckResult.canProceed),
        criticalFactorCount: assessment.factors.filter((f) => f.score > 70).length,
        timestamp: new Date().toISOString(),
      };

      const event = new CloudEvent({
        type: 'risk.assessment.completed',
        source: 'orion-platform-service',
        data: eventData,
        extensions: {
          tenantId: assessment.tenantId,
          priority: assessment.riskLevel === 'Critical' ? 'critical' : assessment.riskLevel === 'High' ? 'high' : 'normal',
        },
      });

      await this.eventBus.publish(event);
    } catch (error) {
      console.error('[RiskAssessmentService] Failed to publish risk assessment event:', error);
    }
  }
}
