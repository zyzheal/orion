/**
 * Orion Risk Assessment Service
 * 真实风险评估服务 — 从各服务获取数据并计算风险评分
 */

import { query } from '../utils/database.js';
import {
  RiskLevel,
  RiskCategory,
  RiskScore,
  RiskEvent,
  RiskAssessment,
} from '../types/risk.js';
import {
  AssessmentRepository,
  RiskEventRepository,
  RiskScoreRepository,
} from '../repositories/RiskRepository.js';

// ============================================================
// Risk Factor Interfaces
// ============================================================

/** 风险因子接口 */
export interface RiskFactor {
  name: string;
  category: RiskCategory;
  value: number;
  maxValue: number;
  weight: number;
  description: string;
}

/** 风险评估请求 */
export interface RiskAssessmentRequest {
  entityType: string;
  entityId: string;
  tenantId: string;
  factors?: Partial<RiskFactor>[];
}

/** 风险评估结果 */
export interface RiskAssessmentResult {
  riskScore: RiskScore;
  factors: RiskFactor[];
  recommendations: string[];
  trend: 'increasing' | 'stable' | 'decreasing';
  previousScore?: number;
}

// ============================================================
// Risk Factor Weights (from database or defaults)
// ============================================================

const DEFAULT_FACTOR_WEIGHTS: Record<string, Record<string, { weight: number; maxValue: number }>> = {
  security: {
    vulnerability_count: { weight: 2.0, maxValue: 100 },
    unpatched_cves: { weight: 3.0, maxValue: 50 },
    access_control_issues: { weight: 1.5, maxValue: 20 },
    encryption_status: { weight: 1.0, maxValue: 1 },
  },
  performance: {
    response_time_p95: { weight: 1.5, maxValue: 5000 }, // ms
    error_rate: { weight: 2.0, maxValue: 100 }, // percentage
    resource_utilization: { weight: 1.0, maxValue: 100 }, // percentage
    throughput_degradation: { weight: 1.5, maxValue: 50 }, // percentage decline
  },
  availability: {
    uptime_percentage: { weight: 2.5, maxValue: 100 }, // percentage (inverse)
    incident_count: { weight: 2.0, maxValue: 20 },
    mttr: { weight: 1.5, maxValue: 3600 }, // seconds
    failover_capability: { weight: 1.0, maxValue: 1 },
  },
  compliance: {
    policy_violations: { weight: 2.0, maxValue: 50 },
    audit_findings: { weight: 2.5, maxValue: 30 },
    data_retention: { weight: 1.0, maxValue: 1 },
  },
  operational: {
    change_failure_rate: { weight: 1.5, maxValue: 100 },
    manual_intervention: { weight: 1.0, maxValue: 100 },
    documentation_coverage: { weight: 0.5, maxValue: 100 },
  },
  financial: {
    cost_overrun: { weight: 1.5, maxValue: 100 },
    budget_variance: { weight: 1.0, maxValue: 100 },
  },
};

// ============================================================
// Risk Assessment Service
// ============================================================

export class RiskAssessmentService {
  /**
   * 执行完整的风险评估
   * @param request 评估请求
   * @returns 风险评估结果
   */
  async assessRisk(request: RiskAssessmentRequest): Promise<RiskAssessmentResult> {
    // 1. 获取各维度的风险因子
    const factors = await this.gatherRiskFactors(request.entityType, request.entityId);

    // 2. 计算风险分数
    const { totalScore, dimensionScores } = this.calculateRiskScores(factors);

    // 3. 确定风险等级
    const riskLevel = this.scoreToLevel(totalScore);

    // 4. 获取历史分数用于趋势分析
    const previousScore = await this.getPreviousScore(request.entityType, request.entityId);
    const trend = this.calculateTrend(totalScore, previousScore);

    // 5. 生成建议
    const recommendations = this.generateRecommendations(factors, riskLevel);

    // 6. 保存评估结果
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const riskScore = await RiskScoreRepository.upsert({
      entityType: request.entityType,
      entityId: request.entityId,
      totalScore,
      dimensionScores,
      riskLevel,
      comment: `Auto-assessed at ${now.toISOString()}`,
      expiresAt,
    });

    // 7. 记录到历史
    await this.recordRiskHistory(request, totalScore, dimensionScores, riskLevel, factors, recommendations);

    return {
      riskScore,
      factors,
      recommendations,
      trend,
      previousScore,
    };
  }

  /**
   * 收集风险因子数据
   * 从各服务获取真实的风险数据
   */
  private async gatherRiskFactors(entityType: string, entityId: string): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // 从数据库获取配置的权重
    const factorWeights = await this.loadFactorWeights();

    // Security factors
    const securityFactors = await this.getSecurityFactors(entityType, entityId, factorWeights.security);
    factors.push(...securityFactors);

    // Performance factors
    const performanceFactors = await this.getPerformanceFactors(entityType, entityId, factorWeights.performance);
    factors.push(...performanceFactors);

    // Availability factors
    const availabilityFactors = await this.getAvailabilityFactors(entityType, entityId, factorWeights.availability);
    factors.push(...availabilityFactors);

    // Compliance factors
    const complianceFactors = await this.getComplianceFactors(entityType, entityId, factorWeights.compliance);
    factors.push(...complianceFactors);

    // Operational factors
    const operationalFactors = await this.getOperationalFactors(entityType, entityId, factorWeights.operational);
    factors.push(...operationalFactors);

    // Financial factors
    const financialFactors = await this.getFinancialFactors(entityType, entityId, factorWeights.financial);
    factors.push(...financialFactors);

    return factors;
  }

  /**
   * 从数据库加载因子权重
   */
  private async loadFactorWeights(): Promise<typeof DEFAULT_FACTOR_WEIGHTS> {
    try {
      const result = await query(`
        SELECT category, factor_name, weight, max_value
        FROM risk_factor_weights
        WHERE is_active = true
      `);

      const weights = JSON.parse(JSON.stringify(DEFAULT_FACTOR_WEIGHTS));

      for (const row of result.rows as Array<{ category: string; factor_name: string; weight: number; max_value: number }>) {
        if (weights[row.category] && weights[row.category][row.factor_name]) {
          weights[row.category][row.factor_name] = {
            weight: row.weight,
            maxValue: row.max_value,
          };
        }
      }

      return weights;
    } catch {
      // If table doesn't exist or query fails, use defaults
      return DEFAULT_FACTOR_WEIGHTS;
    }
  }

  /**
   * 获取安全相关风险因子
   * 从安全服务或监控系统获取数据
   */
  private async getSecurityFactors(
    entityType: string,
    entityId: string,
    weights: Record<string, { weight: number; maxValue: number }>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      // 尝试从安全服务获取漏洞数据
      const vulnResult = await query(`
        SELECT COUNT(*) as count FROM security_vulnerabilities
        WHERE entity_type = $1 AND entity_id = $2 AND status = 'open'
      `, [entityType, entityId]);

      const vulnCount = parseInt((vulnResult.rows[0] as { count: string })?.count || '0', 10);
      factors.push({
        name: 'vulnerability_count',
        category: RiskCategory.SECURITY,
        value: vulnCount,
        maxValue: weights.vulnerability_count?.maxValue || 100,
        weight: weights.vulnerability_count?.weight || 2.0,
        description: 'Number of known unpatched vulnerabilities',
      });
    } catch {
      // 如果表不存在，使用默认空数据
      factors.push({
        name: 'vulnerability_count',
        category: RiskCategory.SECURITY,
        value: 0,
        maxValue: weights.vulnerability_count?.maxValue || 100,
        weight: weights.vulnerability_count?.weight || 2.0,
        description: 'Number of known unpatched vulnerabilities',
      });
    }

    try {
      // 获取未修复的 CVE
      const cveResult = await query(`
        SELECT COUNT(*) as count FROM security_cves
        WHERE entity_type = $1 AND entity_id = $2 AND patched = false
      `, [entityType, entityId]);

      const cveCount = parseInt((cveResult.rows[0] as { count: string })?.count || '0', 10);
      factors.push({
        name: 'unpatched_cves',
        category: RiskCategory.SECURITY,
        value: cveCount,
        maxValue: weights.unpatched_cves?.maxValue || 50,
        weight: weights.unpatched_cves?.weight || 3.0,
        description: 'Number of unpatched CVEs',
      });
    } catch {
      factors.push({
        name: 'unpatched_cves',
        category: RiskCategory.SECURITY,
        value: 0,
        maxValue: weights.unpatched_cves?.maxValue || 50,
        weight: weights.unpatched_cves?.weight || 3.0,
        description: 'Number of unpatched CVEs',
      });
    }

    // 访问控制问题 - 从审计日志获取
    try {
      const aclResult = await query(`
        SELECT COUNT(*) as count FROM audit_logs
        WHERE entity_type = $1 AND entity_id = $2
        AND action = 'access_denied' AND created_at > NOW() - INTERVAL '30 days'
      `, [entityType, entityId]);

      const aclIssues = parseInt((aclResult.rows[0] as { count: string })?.count || '0', 10);
      factors.push({
        name: 'access_control_issues',
        category: RiskCategory.SECURITY,
        value: aclIssues,
        maxValue: weights.access_control_issues?.maxValue || 20,
        weight: weights.access_control_issues?.weight || 1.5,
        description: 'Access control issues in recent period',
      });
    } catch {
      factors.push({
        name: 'access_control_issues',
        category: RiskCategory.SECURITY,
        value: 0,
        maxValue: weights.access_control_issues?.maxValue || 20,
        weight: weights.access_control_issues?.weight || 1.5,
        description: 'Access control issues in recent period',
      });
    }

    return factors;
  }

  /**
   * 获取性能相关风险因子
   */
  private async getPerformanceFactors(
    entityType: string,
    entityId: string,
    weights: Record<string, { weight: number; maxValue: number }>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // 从监控服务获取性能指标
    try {
      const perfResult = await query(`
        SELECT
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response,
          COUNT(*) FILTER (WHERE status_code >= 500) * 100.0 / NULLIF(COUNT(*), 0) as error_rate,
          AVG(cpu_usage) as avg_cpu,
          AVG(memory_usage) as avg_memory
        FROM metrics
        WHERE entity_type = $1 AND entity_id = $2
        AND recorded_at > NOW() - INTERVAL '7 days'
      `, [entityType, entityId]);

      const row = perfResult.rows[0] as {
        p95_response: number | null;
        error_rate: number | null;
        avg_cpu: number | null;
        avg_memory: number | null;
      };

      factors.push({
        name: 'response_time_p95',
        category: RiskCategory.PERFORMANCE,
        value: row?.p95_response || 0,
        maxValue: weights.response_time_p95?.maxValue || 5000,
        weight: weights.response_time_p95?.weight || 1.5,
        description: '95th percentile response time',
      });

      factors.push({
        name: 'error_rate',
        category: RiskCategory.PERFORMANCE,
        value: row?.error_rate || 0,
        maxValue: weights.error_rate?.maxValue || 100,
        weight: weights.error_rate?.weight || 2.0,
        description: 'Error rate percentage',
      });

      const resourceUtil = ((row?.avg_cpu || 0) + (row?.avg_memory || 0)) / 2;
      factors.push({
        name: 'resource_utilization',
        category: RiskCategory.PERFORMANCE,
        value: resourceUtil,
        maxValue: weights.resource_utilization?.maxValue || 100,
        weight: weights.resource_utilization?.weight || 1.0,
        description: 'Average CPU/Memory utilization',
      });
    } catch {
      // 默认值
      factors.push({
        name: 'response_time_p95',
        category: RiskCategory.PERFORMANCE,
        value: 0,
        maxValue: weights.response_time_p95?.maxValue || 5000,
        weight: weights.response_time_p95?.weight || 1.5,
        description: '95th percentile response time',
      });

      factors.push({
        name: 'error_rate',
        category: RiskCategory.PERFORMANCE,
        value: 0,
        maxValue: weights.error_rate?.maxValue || 100,
        weight: weights.error_rate?.weight || 2.0,
        description: 'Error rate percentage',
      });

      factors.push({
        name: 'resource_utilization',
        category: RiskCategory.PERFORMANCE,
        value: 0,
        maxValue: weights.resource_utilization?.maxValue || 100,
        weight: weights.resource_utilization?.weight || 1.0,
        description: 'Average CPU/Memory utilization',
      });
    }

    return factors;
  }

  /**
   * 获取可用性相关风险因子
   */
  private async getAvailabilityFactors(
    entityType: string,
    entityId: string,
    weights: Record<string, { weight: number; maxValue: number }>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      // 从事件/告警服务获取可用性数据
      const uptimeResult = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'down') as downtime_count,
          COUNT(*) as total_checks,
          AVG(EXTRACT(EPOCH FROM (resolved_at - started_at))) as avg_recovery_time
        FROM incidents
        WHERE entity_type = $1 AND entity_id = $2
        AND started_at > NOW() - INTERVAL '30 days'
      `, [entityType, entityId]);

      const row = uptimeResult.rows[0] as {
        downtime_count: string | null;
        total_checks: string | null;
        avg_recovery_time: number | null;
      };

      const totalChecks = parseInt(row?.total_checks || '1', 10);
      const downtimeCount = parseInt(row?.downtime_count || '0', 10);
      const uptimePercentage = totalChecks > 0 ? ((totalChecks - downtimeCount) / totalChecks) * 100 : 100;

      factors.push({
        name: 'uptime_percentage',
        category: RiskCategory.AVAILABILITY,
        value: uptimePercentage,
        maxValue: weights.uptime_percentage?.maxValue || 100,
        weight: weights.uptime_percentage?.weight || 2.5,
        description: 'Historical uptime percentage (inverse: lower is riskier)',
      });

      factors.push({
        name: 'incident_count',
        category: RiskCategory.AVAILABILITY,
        value: downtimeCount,
        maxValue: weights.incident_count?.maxValue || 20,
        weight: weights.incident_count?.weight || 2.0,
        description: 'Number of incidents in period',
      });

      factors.push({
        name: 'mttr',
        category: RiskCategory.AVAILABILITY,
        value: row?.avg_recovery_time || 0,
        maxValue: weights.mttr?.maxValue || 3600,
        weight: weights.mttr?.weight || 1.5,
        description: 'Mean Time To Recovery (seconds)',
      });
    } catch {
      factors.push({
        name: 'uptime_percentage',
        category: RiskCategory.AVAILABILITY,
        value: 100,
        maxValue: weights.uptime_percentage?.maxValue || 100,
        weight: weights.uptime_percentage?.weight || 2.5,
        description: 'Historical uptime percentage (inverse: lower is riskier)',
      });

      factors.push({
        name: 'incident_count',
        category: RiskCategory.AVAILABILITY,
        value: 0,
        maxValue: weights.incident_count?.maxValue || 20,
        weight: weights.incident_count?.weight || 2.0,
        description: 'Number of incidents in period',
      });

      factors.push({
        name: 'mttr',
        category: RiskCategory.AVAILABILITY,
        value: 0,
        maxValue: weights.mttr?.maxValue || 3600,
        weight: weights.mttr?.weight || 1.5,
        description: 'Mean Time To Recovery (seconds)',
      });
    }

    return factors;
  }

  /**
   * 获取合规相关风险因子
   */
  private async getComplianceFactors(
    entityType: string,
    entityId: string,
    weights: Record<string, { weight: number; maxValue: number }>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      const complianceResult = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'violation') as policy_violations,
          COUNT(*) FILTER (WHERE status = 'finding') as audit_findings
        FROM compliance_checks
        WHERE entity_type = $1 AND entity_id = $2
        AND checked_at > NOW() - INTERVAL '90 days'
      `, [entityType, entityId]);

      const row = complianceResult.rows[0] as {
        policy_violations: string | null;
        audit_findings: string | null;
      };

      factors.push({
        name: 'policy_violations',
        category: RiskCategory.COMPLIANCE,
        value: parseInt(row?.policy_violations || '0', 10),
        maxValue: weights.policy_violations?.maxValue || 50,
        weight: weights.policy_violations?.weight || 2.0,
        description: 'Policy violation count',
      });

      factors.push({
        name: 'audit_findings',
        category: RiskCategory.COMPLIANCE,
        value: parseInt(row?.audit_findings || '0', 10),
        maxValue: weights.audit_findings?.maxValue || 30,
        weight: weights.audit_findings?.weight || 2.5,
        description: 'Audit findings count',
      });
    } catch {
      factors.push({
        name: 'policy_violations',
        category: RiskCategory.COMPLIANCE,
        value: 0,
        maxValue: weights.policy_violations?.maxValue || 50,
        weight: weights.policy_violations?.weight || 2.0,
        description: 'Policy violation count',
      });

      factors.push({
        name: 'audit_findings',
        category: RiskCategory.COMPLIANCE,
        value: 0,
        maxValue: weights.audit_findings?.maxValue || 30,
        weight: weights.audit_findings?.weight || 2.5,
        description: 'Audit findings count',
      });
    }

    return factors;
  }

  /**
   * 获取运营相关风险因子
   */
  private async getOperationalFactors(
    entityType: string,
    entityId: string,
    weights: Record<string, { weight: number; maxValue: number }>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      // 从变更日志获取变更失败率
      const changeResult = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / NULLIF(COUNT(*), 0) as failure_rate,
          COUNT(*) FILTER (WHERE requires_manual = true) * 100.0 / NULLIF(COUNT(*), 0) as manual_rate
        FROM changes
        WHERE entity_type = $1 AND entity_id = $2
        AND created_at > NOW() - INTERVAL '30 days'
      `, [entityType, entityId]);

      const row = changeResult.rows[0] as {
        failure_rate: number | null;
        manual_rate: number | null;
      };

      factors.push({
        name: 'change_failure_rate',
        category: RiskCategory.OPERATIONAL,
        value: row?.failure_rate || 0,
        maxValue: weights.change_failure_rate?.maxValue || 100,
        weight: weights.change_failure_rate?.weight || 1.5,
        description: 'Change failure rate percentage',
      });

      factors.push({
        name: 'manual_intervention',
        category: RiskCategory.OPERATIONAL,
        value: row?.manual_rate || 0,
        maxValue: weights.manual_intervention?.maxValue || 100,
        weight: weights.manual_intervention?.weight || 1.0,
        description: 'Manual intervention frequency',
      });
    } catch {
      factors.push({
        name: 'change_failure_rate',
        category: RiskCategory.OPERATIONAL,
        value: 0,
        maxValue: weights.change_failure_rate?.maxValue || 100,
        weight: weights.change_failure_rate?.weight || 1.5,
        description: 'Change failure rate percentage',
      });

      factors.push({
        name: 'manual_intervention',
        category: RiskCategory.OPERATIONAL,
        value: 0,
        maxValue: weights.manual_intervention?.maxValue || 100,
        weight: weights.manual_intervention?.weight || 1.0,
        description: 'Manual intervention frequency',
      });
    }

    return factors;
  }

  /**
   * 获取财务相关风险因子
   */
  private async getFinancialFactors(
    entityType: string,
    entityId: string,
    weights: Record<string, { weight: number; maxValue: number }>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      const finopsResult = await query(`
        SELECT
          (actual_cost - budgeted_cost) * 100.0 / NULLIF(budgeted_cost, 0) as cost_overrun,
          (forecast_cost - budgeted_cost) * 100.0 / NULLIF(budgeted_cost, 0) as budget_variance
        FROM finops_reports
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY report_date DESC
        LIMIT 1
      `, [entityType, entityId]);

      const row = finopsResult.rows[0] as {
        cost_overrun: number | null;
        budget_variance: number | null;
      };

      factors.push({
        name: 'cost_overrun',
        category: RiskCategory.FINANCIAL,
        value: Math.max(0, row?.cost_overrun || 0),
        maxValue: weights.cost_overrun?.maxValue || 100,
        weight: weights.cost_overrun?.weight || 1.5,
        description: 'Cost overrun percentage',
      });

      factors.push({
        name: 'budget_variance',
        category: RiskCategory.FINANCIAL,
        value: Math.max(0, Math.abs(row?.budget_variance || 0)),
        maxValue: weights.budget_variance?.maxValue || 100,
        weight: weights.budget_variance?.weight || 1.0,
        description: 'Budget variance percentage',
      });
    } catch {
      factors.push({
        name: 'cost_overrun',
        category: RiskCategory.FINANCIAL,
        value: 0,
        maxValue: weights.cost_overrun?.maxValue || 100,
        weight: weights.cost_overrun?.weight || 1.5,
        description: 'Cost overrun percentage',
      });

      factors.push({
        name: 'budget_variance',
        category: RiskCategory.FINANCIAL,
        value: 0,
        maxValue: weights.budget_variance?.maxValue || 100,
        weight: weights.budget_variance?.weight || 1.0,
        description: 'Budget variance percentage',
      });
    }

    return factors;
  }

  /**
   * 计算风险分数
   * 使用加权平均计算各维度和总体分数
   */
  private calculateRiskScores(factors: RiskFactor[]): {
    totalScore: number;
    dimensionScores: Record<string, number>;
  } {
    const categoryScores: Record<string, { total: number; weight: number }> = {};

    for (const factor of factors) {
      const category = factor.category;
      if (!categoryScores[category]) {
        categoryScores[category] = { total: 0, weight: 0 };
      }

      // 归一化因子值到 0-100
      const normalizedValue = Math.min(100, (factor.value / factor.maxValue) * 100);
      categoryScores[category].total += normalizedValue * factor.weight;
      categoryScores[category].weight += factor.weight;
    }

    // 计算各维度分数
    const dimensionScores: Record<string, number> = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [category, data] of Object.entries(categoryScores)) {
      const dimensionScore = data.weight > 0 ? Math.round(data.total / data.weight) : 0;
      dimensionScores[category] = dimensionScore;
      totalWeightedScore += dimensionScore * data.weight;
      totalWeight += data.weight;
    }

    const totalScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

    return { totalScore, dimensionScores };
  }

  /**
   * 分数转等级
   */
  private scoreToLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.CRITICAL;
    if (score >= 60) return RiskLevel.HIGH;
    if (score >= 40) return RiskLevel.MEDIUM;
    if (score >= 20) return RiskLevel.LOW;
    return RiskLevel.INFO;
  }

  /**
   * 获取之前的风险分数
   */
  private async getPreviousScore(entityType: string, entityId: string): Promise<number | undefined> {
    try {
      const result = await query(`
        SELECT total_score FROM risk_history
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY changed_at DESC
        LIMIT 1
      `, [entityType, entityId]);

      if (result.rows.length > 0) {
        return (result.rows[0] as { total_score: number }).total_score;
      }
    } catch {
      // 表可能不存在
    }
    return undefined;
  }

  /**
   * 计算趋势
   */
  private calculateTrend(currentScore: number, previousScore?: number): 'increasing' | 'stable' | 'decreasing' {
    if (previousScore === undefined) return 'stable';

    const diff = currentScore - previousScore;
    if (diff > 10) return 'increasing'; // 风险增加
    if (diff < -10) return 'decreasing'; // 风险降低
    return 'stable';
  }

  /**
   * 生成风险建议
   */
  private generateRecommendations(factors: RiskFactor[], riskLevel: RiskLevel): string[] {
    const recommendations: string[] = [];

    // 按风险值排序的因子
    const sortedFactors = [...factors].sort((a, b) => {
      const aRisk = (a.value / a.maxValue) * a.weight;
      const bRisk = (b.value / b.maxValue) * b.weight;
      return bRisk - aRisk;
    });

    // 为每个高风险因子生成建议
    for (const factor of sortedFactors) {
      const riskRatio = factor.value / factor.maxValue;
      if (riskRatio > 0.6) {
        const rec = this.getRecommendationForFactor(factor);
        if (rec && !recommendations.includes(rec)) {
          recommendations.push(rec);
        }
      }
    }

    // 添加整体建议
    if (riskLevel === RiskLevel.CRITICAL) {
      recommendations.unshift('立即召开风险应急会议，制定风险缓解计划');
    } else if (riskLevel === RiskLevel.HIGH) {
      recommendations.unshift('优先处理高风险因子，建议在 24-48 小时内制定改进计划');
    }

    // 限制建议数量
    return recommendations.slice(0, 5);
  }

  /**
   * 为特定因子获取建议
   */
  private getRecommendationForFactor(factor: RiskFactor): string | null {
    const recommendations: Record<string, Record<string, string>> = {
      security: {
        vulnerability_count: '立即修复高危漏洞，实施补丁管理流程',
        unpatched_cves: '加快 CVE 补丁修复进度，建立漏洞响应机制',
        access_control_issues: '审查访问控制策略，加强权限管理',
      },
      performance: {
        response_time_p95: '优化响应时间，检查数据库查询和缓存策略',
        error_rate: '分析错误日志，定位并修复导致高错误率的问题',
        resource_utilization: '扩容或优化资源使用，考虑自动伸缩策略',
      },
      availability: {
        uptime_percentage: '检查基础设施稳定性，部署高可用方案',
        incident_count: '分析事故根因，建立预防机制',
        mttr: '优化故障检测和恢复流程，建立自动化修复能力',
      },
      compliance: {
        policy_violations: '审查并修复策略违规项',
        audit_findings: '优先处理审计发现项，制定合规改进计划',
      },
      operational: {
        change_failure_rate: '改进变更流程，增加自动化测试和回滚能力',
        manual_intervention: '增加自动化程度，减少人工干预需求',
      },
      financial: {
        cost_overrun: '审查成本超支原因，优化资源使用',
        budget_variance: '调整预算规划，提高成本预测准确性',
      },
    };

    return recommendations[factor.category]?.[factor.name] || null;
  }

  /**
   * 记录风险历史
   */
  private async recordRiskHistory(
    request: RiskAssessmentRequest,
    totalScore: number,
    dimensionScores: Record<string, number>,
    riskLevel: RiskLevel,
    factors: RiskFactor[],
    recommendations: string[]
  ): Promise<void> {
    try {
      await query(`
        INSERT INTO risk_history (
          entity_type, entity_id, risk_level, risk_score, dimension_scores,
          factors, recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        request.entityType,
        request.entityId,
        riskLevel,
        totalScore,
        JSON.stringify(dimensionScores),
        JSON.stringify(factors.map(f => ({ name: f.name, category: f.category, value: f.value }))),
        JSON.stringify(recommendations),
      ]);
    } catch {
      // 静默失败，不影响主流程
    }
  }

  /**
   * 获取风险评估历史趋势
   */
  async getRiskTrend(
    entityType: string,
    entityId: string,
    days: number = 30
  ): Promise<{ date: string; score: number; level: RiskLevel }[]> {
    try {
      const result = await query(`
        SELECT
          DATE(changed_at) as date,
          risk_score,
          risk_level
        FROM risk_history
        WHERE entity_type = $1 AND entity_id = $2
        AND changed_at > NOW() - INTERVAL '$3 days'
        ORDER BY date ASC
      `, [entityType, entityId, days]);

      return result.rows.map((row) => {
        const r = row as { date: Date; risk_score: number; risk_level: string };
        return {
          date: r.date.toISOString().split('T')[0],
          score: r.risk_score,
          level: r.risk_level as RiskLevel,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * 为没有历史数据的实体生成默认风险评估
   * 当无法获取真实数据时，使用基于实体类型的启发式评估
   */
  async assessWithDefaults(entityType: string, entityId: string, tenantId: string): Promise<RiskAssessmentResult> {
    // 尝试加载因子权重
    const weights = await this.loadFactorWeights();

    // 生成默认因子（基于实体类型假设）
    const factors: RiskFactor[] = [];

    // 为每个类别添加默认因子
    for (const [category, categoryWeights] of Object.entries(weights)) {
      for (const [name, config] of Object.entries(categoryWeights)) {
        factors.push({
          name,
          category: category as RiskCategory,
          value: 0, // 默认无数据
          maxValue: config.maxValue,
          weight: config.weight,
          description: `${name} for ${entityType}`,
        });
      }
    }

    const { totalScore, dimensionScores } = this.calculateRiskScores(factors);
    const riskLevel = this.scoreToLevel(totalScore);
    const recommendations = this.generateRecommendations(factors, riskLevel);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const riskScore = await RiskScoreRepository.upsert({
      entityType,
      entityId,
      totalScore,
      dimensionScores,
      riskLevel,
      comment: 'Default assessment - no historical data available',
      expiresAt,
    });

    return {
      riskScore,
      factors,
      recommendations,
      trend: 'stable',
      previousScore: undefined,
    };
  }
}