/**
 * 风险评分引擎
 *
 * 基于多维度因子的加权评分算法：
 * - 技术因子: 变更规模、复杂度、依赖数量
 * - 历史因子: 过去失败率、近期事故、MTTR
 * - 组织因子: 团队经验、审查完整性
 *
 * 风险等级划分:
 * - Low: 0-25
 * - Medium: 26-50
 * - High: 51-75
 * - Critical: 76-100
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RiskFactor,
  RiskLevel,
  RiskRecommendation,
  DeploymentRisk,
  RiskFactorCategory,
} from '../types/security';

/**
 * 风险评分权重配置
 */
export interface RiskScoringWeights {
  // 技术因子权重
  technical: {
    changeSize: number;
    changeComplexity: number;
    dependencyCount: number;
    testCoverage: number;
  };
  // 历史因子权重
  historical: {
    failureRate: number;
    recentIncidents: number;
    mttr: number;
  };
  // 组织因子权重
  organizational: {
    teamExperience: number;
    reviewCompleteness: number;
    timeOfDay: number;
  };
}

/**
 * 默认权重配置
 */
export const DEFAULT_WEIGHTS: RiskScoringWeights = {
  technical: {
    changeSize: 0.15,
    changeComplexity: 0.12,
    dependencyCount: 0.08,
    testCoverage: 0.05,
  },
  historical: {
    failureRate: 0.20,
    recentIncidents: 0.15,
    mttr: 0.05,
  },
  organizational: {
    teamExperience: 0.05,
    reviewCompleteness: 0.10,
    timeOfDay: 0.05,
  },
};

/**
 * 风险等级阈值
 */
export const RISK_LEVEL_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
};

/**
 * 风险评分引擎
 */
export class RiskScoringEngine {
  private weights: RiskScoringWeights;

  constructor(weights?: Partial<RiskScoringWeights>) {
    this.weights = this.mergeWeights(weights);
  }

  /**
   * 计算风险评分
   *
   * 基于变更风险评估数据，计算 0-100 的风险分数
   */
  calculateRiskScore(deploymentRisk: DeploymentRisk): number {
    const factors = this.evaluateRiskFactors(deploymentRisk);
    return this.computeWeightedScore(factors);
  }

  /**
   * 评估风险等级
   */
  evaluateRiskLevel(score: number): RiskLevel {
    if (score <= RISK_LEVEL_THRESHOLDS.low) {
      return 'Low';
    }
    if (score <= RISK_LEVEL_THRESHOLDS.medium) {
      return 'Medium';
    }
    if (score <= RISK_LEVEL_THRESHOLDS.high) {
      return 'High';
    }
    return 'Critical';
  }

  /**
   * 获取风险因子列表
   */
  getRiskFactors(deploymentRisk: DeploymentRisk): RiskFactor[] {
    return this.evaluateRiskFactors(deploymentRisk);
  }

  /**
   * 生成风险评估建议
   */
  generateRecommendations(
    factors: RiskFactor[],
    riskLevel: RiskLevel
  ): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];

    for (const factor of factors) {
      if (factor.score < 20) continue; // 低分项不需要建议

      const rec = this.getRecommendationForFactor(factor, riskLevel);
      if (rec) {
        recommendations.push(rec);
      }
    }

    // 根据风险等级添加通用建议
    if (riskLevel === 'Critical') {
      recommendations.push({
        id: uuidv4(),
        type: 'block',
        title: '风险过高，建议暂停部署',
        description: '当前风险评分已达到 Critical 级别，建议进行额外的安全审查和测试后再考虑部署。',
        priority: 'critical',
      });
    } else if (riskLevel === 'High') {
      recommendations.push({
        id: uuidv4(),
        type: 'warn',
        title: '高风险，需要额外审查',
        description: '当前风险评分较高，建议在部署前增加额外的测试和审查步骤。',
        priority: 'high',
      });
    }

    // 按优先级排序
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * 更新权重配置
   */
  updateWeights(newWeights: Partial<RiskScoringWeights>): void {
    this.weights = this.mergeWeights(newWeights);
  }

  /**
   * 获取当前权重配置
   */
  getWeights(): RiskScoringWeights {
    return { ...this.weights };
  }

  // ==================== 私有方法 ====================

  /**
   * 评估所有风险因子
   */
  private evaluateRiskFactors(deploymentRisk: DeploymentRisk): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // 技术因子
    factors.push(this.evaluateChangeSize(deploymentRisk));
    factors.push(this.evaluateChangeComplexity(deploymentRisk));
    factors.push(this.evaluateDependencyCount(deploymentRisk));
    factors.push(this.evaluateTestCoverage(deploymentRisk));

    // 历史因子
    factors.push(this.evaluateHistoricalFailureRate(deploymentRisk));
    factors.push(this.evaluateRecentIncidents(deploymentRisk));
    factors.push(this.evaluateMTTR(deploymentRisk));

    // 组织因子
    factors.push(this.evaluateTeamExperience(deploymentRisk));
    factors.push(this.evaluateReviewCompleteness(deploymentRisk));
    factors.push(this.evaluateTimeRisk(deploymentRisk));

    return factors;
  }

  /**
   * 计算加权分数
   */
  private computeWeightedScore(factors: RiskFactor[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      totalScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    }

    if (totalWeight === 0) return 0;

    // 归一化到 0-100
    return Math.min(100, Math.round((totalScore / totalWeight) * 100) / 100);
  }

  /**
   * 评估变更规模因子
   */
  private evaluateChangeSize(deploymentRisk: DeploymentRisk): RiskFactor {
    const { filesChanged, linesChanged } = deploymentRisk.changeSize;

    // 基于文件数和代码行数评分
    let score = 0;
    if (filesChanged > 100) score = 90;
    else if (filesChanged > 50) score = 75;
    else if (filesChanged > 20) score = 55;
    else if (filesChanged > 10) score = 35;
    else if (filesChanged > 5) score = 20;
    else score = 10;

    // 代码行数影响
    if (linesChanged > 10000) score = Math.min(100, score + 15);
    else if (linesChanged > 5000) score = Math.min(100, score + 10);
    else if (linesChanged > 1000) score = Math.min(100, score + 5);

    return {
      name: 'changeSize',
      weight: this.weights.technical.changeSize,
      score,
      description: `变更规模: ${filesChanged} 个文件, ${linesChanged} 行代码`,
      category: 'technical',
    };
  }

  /**
   * 评估变更复杂度因子
   */
  private evaluateChangeComplexity(deploymentRisk: DeploymentRisk): RiskFactor {
    const scopeSize = deploymentRisk.changeScope.length;

    let score = 0;
    if (scopeSize > 10) score = 85;
    else if (scopeSize > 5) score = 65;
    else if (scopeSize > 3) score = 45;
    else if (scopeSize > 1) score = 25;
    else score = 10;

    // 关键依赖影响复杂度
    if (deploymentRisk.dependencyRisk.criticalDependencies.length > 2) {
      score = Math.min(100, score + 15);
    } else if (deploymentRisk.dependencyRisk.criticalDependencies.length > 0) {
      score = Math.min(100, score + 8);
    }

    return {
      name: 'changeComplexity',
      weight: this.weights.technical.changeComplexity,
      score,
      description: `变更复杂度: ${scopeSize} 个组件, ${deploymentRisk.dependencyRisk.criticalDependencies.length} 个关键依赖`,
      category: 'technical',
    };
  }

  /**
   * 评估依赖数量因子
   */
  private evaluateDependencyCount(deploymentRisk: DeploymentRisk): RiskFactor {
    const { totalDependencies, unhealthyDependencies } = deploymentRisk.dependencyRisk;

    let score = 0;
    if (totalDependencies > 20) score = 70;
    else if (totalDependencies > 10) score = 50;
    else if (totalDependencies > 5) score = 30;
    else score = 15;

    // 不健康依赖大幅提升风险
    if (unhealthyDependencies > 0) {
      score = Math.min(100, score + unhealthyDependencies * 15);
    }

    return {
      name: 'dependencyCount',
      weight: this.weights.technical.dependencyCount,
      score,
      description: `依赖: ${totalDependencies} 个总依赖, ${unhealthyDependencies} 个不健康`,
      category: 'technical',
    };
  }

  /**
   * 评估测试覆盖因子
   */
  private evaluateTestCoverage(deploymentRisk: DeploymentRisk): RiskFactor {
    // 基于变更规模和历史失败率推断测试覆盖情况
    const { filesChanged } = deploymentRisk.changeSize;
    const failureRate = deploymentRisk.historicalRisk.recentFailureRate;

    let score = 50; // 默认中等

    // 大变更 + 高失败率 = 测试覆盖不足
    if (filesChanged > 50 && failureRate > 0.2) score = 80;
    else if (filesChanged > 20 && failureRate > 0.1) score = 65;
    else if (failureRate > 0.15) score = 60;
    else if (failureRate < 0.05) score = 25;
    else score = 40;

    return {
      name: 'testCoverage',
      weight: this.weights.technical.testCoverage,
      score,
      description: `测试覆盖评估: 基于历史失败率 ${Math.round(failureRate * 100)}%`,
      category: 'technical',
    };
  }

  /**
   * 评估历史失败率因子
   */
  private evaluateHistoricalFailureRate(deploymentRisk: DeploymentRisk): RiskFactor {
    const failureRate = deploymentRisk.historicalRisk.recentFailureRate;
    const score = Math.round(failureRate * 100);

    return {
      name: 'failureRate',
      weight: this.weights.historical.failureRate,
      score: Math.min(100, score),
      description: `历史失败率: ${Math.round(failureRate * 100)}%`,
      category: 'historical',
    };
  }

  /**
   * 评估近期事故因子
   */
  private evaluateRecentIncidents(deploymentRisk: DeploymentRisk): RiskFactor {
    const incidents = deploymentRisk.historicalRisk.recentIncidents;

    let score = 0;
    if (incidents > 5) score = 90;
    else if (incidents > 3) score = 70;
    else if (incidents > 1) score = 45;
    else if (incidents > 0) score = 25;
    else score = 5;

    return {
      name: 'recentIncidents',
      weight: this.weights.historical.recentIncidents,
      score,
      description: `近期事故数: ${incidents}`,
      category: 'historical',
    };
  }

  /**
   * 评估 MTTR 因子
   */
  private evaluateMTTR(deploymentRisk: DeploymentRisk): RiskFactor {
    const mttr = deploymentRisk.historicalRisk.averageMTTR;
    const mttrMinutes = mttr / 60000;

    let score = 0;
    if (mttrMinutes > 240) score = 85;   // > 4 小时
    else if (mttrMinutes > 120) score = 70; // > 2 小时
    else if (mttrMinutes > 60) score = 55;  // > 1 小时
    else if (mttrMinutes > 30) score = 35;  // > 30 分钟
    else if (mttrMinutes > 10) score = 20;  // > 10 分钟
    else score = 10;

    return {
      name: 'mttr',
      weight: this.weights.historical.mttr,
      score,
      description: `平均恢复时间: ${Math.round(mttrMinutes)} 分钟`,
      category: 'historical',
    };
  }

  /**
   * 评估团队经验因子
   */
  private evaluateTeamExperience(deploymentRisk: DeploymentRisk): RiskFactor {
    // 基于变更规模和失败率推断团队经验
    const { filesChanged } = deploymentRisk.changeSize;
    const failureRate = deploymentRisk.historicalRisk.recentFailureRate;

    let score = 30; // 默认中等偏下

    if (filesChanged > 50 && failureRate > 0.15) score = 75;
    else if (filesChanged > 30 && failureRate > 0.1) score = 55;
    else if (failureRate > 0.1) score = 50;
    else if (failureRate < 0.05 && filesChanged < 10) score = 15;
    else score = 30;

    return {
      name: 'teamExperience',
      weight: this.weights.organizational.teamExperience,
      score,
      description: `团队经验评估: 基于近期表现`,
      category: 'organizational',
    };
  }

  /**
   * 评估审查完整性因子
   */
  private evaluateReviewCompleteness(deploymentRisk: DeploymentRisk): RiskFactor {
    // 基于变更规模和依赖推断审查完整性
    const scopeSize = deploymentRisk.changeScope.length;
    const { filesChanged } = deploymentRisk.changeSize;

    let score = 25;

    // 大变更需要更严格的审查
    if (filesChanged > 50 || scopeSize > 5) score = 60;
    else if (filesChanged > 20 || scopeSize > 3) score = 45;
    else if (filesChanged > 10) score = 35;
    else score = 20;

    return {
      name: 'reviewCompleteness',
      weight: this.weights.organizational.reviewCompleteness,
      score,
      description: `审查完整性评估: ${scopeSize} 个组件涉及`,
      category: 'organizational',
    };
  }

  /**
   * 评估时间风险因子
   */
  private evaluateTimeRisk(deploymentRisk: DeploymentRisk): RiskFactor {
    const { isWeekend, isAfterHours, isHoliday, isFriday } = deploymentRisk.timeRisk;

    let score = 10; // 默认低风险
    if (isHoliday) score = 80;
    else if (isWeekend) score = 60;
    else if (isFriday && isAfterHours) score = 55;
    else if (isFriday) score = 35;
    else if (isAfterHours) score = 30;

    return {
      name: 'timeOfDay',
      weight: this.weights.organizational.timeOfDay,
      score,
      description: `时间风险: ${isHoliday ? '节假日' : isWeekend ? '周末' : isFriday ? '周五' : isAfterHours ? '非工作时间' : '正常工作时间'}`,
      category: 'organizational',
    };
  }

  /**
   * 为单个因子生成建议
   */
  private getRecommendationForFactor(
    factor: RiskFactor,
    riskLevel: RiskLevel
  ): RiskRecommendation | null {
    const factorRecommendations: Record<string, (factor: RiskFactor) => RiskRecommendation> = {
      changeSize: (f) => ({
        id: uuidv4(),
        type: f.score > 70 ? 'block' : 'warn',
        title: '变更规模过大',
        description: `当前变更涉及 ${f.description}，建议分批部署降低风险。`,
        relatedFactor: f.name,
        priority: f.score > 70 ? 'high' : 'medium',
      }),
      changeComplexity: (f) => ({
        id: uuidv4(),
        type: f.score > 70 ? 'warn' : 'info',
        title: '变更复杂度较高',
        description: `变更涉及多个组件和关键依赖，建议增加集成测试覆盖。`,
        relatedFactor: f.name,
        priority: 'medium',
      }),
      dependencyCount: (f) => ({
        id: uuidv4(),
        type: f.score > 60 ? 'warn' : 'info',
        title: '依赖服务风险',
        description: `${f.description}，建议确认所有依赖服务的健康状态。`,
        relatedFactor: f.name,
        priority: f.score > 60 ? 'high' : 'medium',
      }),
      failureRate: (f) => ({
        id: uuidv4(),
        type: f.score > 60 ? 'block' : 'warn',
        title: '历史失败率较高',
        description: `${f.description}，建议分析失败原因并制定应对措施。`,
        relatedFactor: f.name,
        priority: f.score > 60 ? 'critical' : 'high',
      }),
      recentIncidents: (f) => ({
        id: uuidv4(),
        type: f.score > 60 ? 'warn' : 'info',
        title: '近期事故频繁',
        description: `${f.description}，系统可能处于不稳定状态，建议暂缓部署。`,
        relatedFactor: f.name,
        priority: f.score > 60 ? 'high' : 'medium',
      }),
      mttr: (f) => ({
        id: uuidv4(),
        type: f.score > 60 ? 'warn' : 'suggestion',
        title: '恢复时间较长',
        description: `${f.description}，建议优化回滚流程和故障恢复预案。`,
        relatedFactor: f.name,
        priority: f.score > 60 ? 'medium' : 'low',
      }),
      timeOfDay: (f) => ({
        id: uuidv4(),
        type: f.score > 50 ? 'warn' : 'suggestion',
        title: '非最佳部署时间',
        description: `${f.description}，建议调整到工作时间进行部署。`,
        relatedFactor: f.name,
        priority: f.score > 50 ? 'medium' : 'low',
      }),
    };

    const generator = factorRecommendations[factor.name];
    if (!generator) return null;

    return generator(factor);
  }

  /**
   * 合并权重配置
   */
  private mergeWeights(newWeights?: Partial<RiskScoringWeights>): RiskScoringWeights {
    return {
      technical: {
        ...DEFAULT_WEIGHTS.technical,
        ...(newWeights?.technical || {}),
      },
      historical: {
        ...DEFAULT_WEIGHTS.historical,
        ...(newWeights?.historical || {}),
      },
      organizational: {
        ...DEFAULT_WEIGHTS.organizational,
        ...(newWeights?.organizational || {}),
      },
    };
  }
}
