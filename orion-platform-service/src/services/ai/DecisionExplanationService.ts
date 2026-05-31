/**
 * Decision Explanation Service — 决策解释服务
 *
 * 功能：
 * 1. SHAP 风格特征重要性计算（基于规则引擎的简化实现）
 * 2. 决策理由生成（为什么通过/失败）
 * 3. 置信度分数解释
 *
 * 注意：当前使用规则引擎进行近似计算，不需要真实 ML 推理。
 * 后续可以接入真实的 SHAP 库进行精确计算。
 */

import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import {
  DecisionExplanationRepository,
  DecisionExplanationEntity,
} from '../../repositories/DecisionExplanationRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== 类型定义 ====================

export interface DecisionFeature {
  name: string;
  value: number | string | boolean;
  weight?: number; // 预定义权重 (0-1)
  description?: string;
}

export interface FeatureImportance {
  name: string;
  importance: number; // SHAP-style: -1 to 1
  absoluteImportance: number;
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
  value: number | string | boolean;
}

export interface MatchedRule {
  id: string;
  name: string;
  condition: string;
  matched: boolean;
  contribution?: number;
}

export interface DecisionExplanation {
  decisionId: string;
  decisionType: string;
  decision: 'pass' | 'fail' | 'warn' | 'manual_review';
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';
  overallReason: string;
  featureImportance: FeatureImportance[];
  matchedRules: MatchedRule[];
  contributingFactors: string[];
  mitigatingFactors: string[];
  recommendations: string[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConfidenceExplanation {
  level: 'high' | 'medium' | 'low' | 'very_low';
  score: number;
  description: string;
  suggestedAction: string;
  reliabilityIndicators: string[];
}

// ==================== 决策类型特定规则 ====================

interface DecisionTypeRules {
  thresholds: {
    pass: number;
    warn: number;
    fail: number;
  };
  criticalFeatures: string[]; // 关键特征名
  reasonTemplates: {
    pass: string;
    fail: string;
    warn: string;
    manual_review: string;
  };
}

const DEFAULT_DECISION_RULES: Record<string, DecisionTypeRules> = {
  'code-review': {
    thresholds: { pass: 70, warn: 50, fail: 30 },
    criticalFeatures: ['code_complexity', 'test_coverage', 'security_issues', 'code_smell_count'],
    reasonTemplates: {
      pass: '代码质量良好，关键指标均通过阈值检查',
      fail: '代码质量不达标，存在以下关键问题',
      warn: '代码质量存在风险，建议人工复核',
      manual_review: '自动评估无法确定，需要人工介入',
    },
  },
  'risk-assessment': {
    thresholds: { pass: 75, warn: 55, fail: 35 },
    criticalFeatures: ['change_scope', 'dependency_health', 'historical_failure_rate', 'time_risk'],
    reasonTemplates: {
      pass: '部署风险较低，可以安全发布',
      fail: '部署风险过高，不建议发布',
      warn: '部署风险中等，建议采取预防措施',
      manual_review: '风险评估结果不确定，需要人工判断',
    },
  },
  'test-selection': {
    thresholds: { pass: 80, warn: 60, fail: 40 },
    criticalFeatures: ['change_impact', 'test_coverage_gap', 'historical_flaky_tests', 'critical_path_coverage'],
    reasonTemplates: {
      pass: '测试选择覆盖充分，可以执行',
      fail: '测试选择覆盖不足，存在质量风险',
      warn: '测试选择存在遗漏风险，建议补充',
      manual_review: '测试选择结果不确定，需要人工确认',
    },
  },
  'diagnosis': {
    thresholds: { pass: 80, warn: 60, fail: 40 },
    criticalFeatures: ['error_pattern_match', 'log_correlation', 'metric_anomaly_score', 'topology_match'],
    reasonTemplates: {
      pass: '根因诊断结果可信度高',
      fail: '根因诊断无法确定，信息不足',
      warn: '根因诊断结果存在不确定性',
      manual_review: '需要更多信息进行诊断',
    },
  },
};

// ==================== 置信度解释模板 ====================

const CONFIDENCE_EXPLANATIONS: Record<string, Omit<ConfidenceExplanation, 'score'>> = {
  high: {
    level: 'high',
    description: '模型对此决策的置信度很高，结果可靠',
    suggestedAction: '可以直接采纳此决策结果',
    reliabilityIndicators: [
      '输入特征数据完整',
      '模型在该场景的历史准确率高',
      '决策边界清晰',
    ],
  },
  medium: {
    level: 'medium',
    description: '模型对此决策的置信度中等，结果基本可靠',
    suggestedAction: '建议关注关键特征的影响，必要时进行人工复核',
    reliabilityIndicators: [
      '部分特征数据可能不完整',
      '该场景存在一定的不确定性',
      '决策边界较为模糊',
    ],
  },
  low: {
    level: 'low',
    description: '模型对此决策的置信度较低，结果仅供参考',
    suggestedAction: '强烈建议进行人工复核，不要完全依赖此决策',
    reliabilityIndicators: [
      '关键特征数据缺失或不完整',
      '该场景的历史准确率较低',
      '决策边界非常模糊',
    ],
  },
  very_low: {
    level: 'very_low',
    description: '模型对此决策的置信度极低，结果不可靠',
    suggestedAction: '必须进行人工审查，此决策不应作为自动执行的依据',
    reliabilityIndicators: [
      '大量关键特征数据缺失',
      '该场景缺乏历史数据支撑',
      '模型可能遇到了未见过的模式',
    ],
  },
};

// ==================== 核心服务类 ====================

export class DecisionExplanationService {
  private decisionRules: Map<string, DecisionTypeRules>;
  private explanationRepo: DecisionExplanationRepository | null = null;

  constructor(
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    customRules?: Record<string, DecisionTypeRules>
  ) {
    if (db) {
      this.explanationRepo = new DecisionExplanationRepository(db);
    }
    this.decisionRules = new Map(
      Object.entries({ ...DEFAULT_DECISION_RULES, ...customRules })
    );
  }

  /**
   * 注册自定义决策类型规则
   */
  registerDecisionType(type: string, rules: DecisionTypeRules): void {
    this.decisionRules.set(type, rules);
    logger.info({ msg: 'Registered decision type rules', type });
  }

  /**
   * 生成决策解释
   */
  async explainDecision(input: {
    decisionId: string;
    decisionType: string;
    decision: 'pass' | 'fail' | 'warn' | 'manual_review';
    features: DecisionFeature[];
    confidence?: number;
    threshold?: number;
    context?: Record<string, unknown>;
  }): Promise<DecisionExplanation> {
    const { decisionId, decisionType, decision, features, confidence = 0.75, threshold, context } = input;

    logger.info({
      msg: 'Generating decision explanation',
      decisionId,
      decisionType,
      decision,
    });

    // 计算特征重要性
    const featureImportance = this.calculateFeatureImportance(features);

    // 匹配规则路径
    const matchedRules = this.matchRules(features, decision);

    // 确定置信度等级
    const confidenceLevel = this.getConfidenceLevel(confidence);

    // 生成决策理由
    const overallReason = this.generateDecisionReason(decision, features, threshold);

    // 提取影响因子和缓解因子
    const { contributingFactors, mitigatingFactors } = this.analyzeFactors(featureImportance, decision);

    // 生成建议
    const recommendations = this.generateRecommendations(decision, featureImportance, confidenceLevel);

    const explanation: DecisionExplanation = {
      decisionId,
      decisionType,
      decision,
      confidence,
      confidenceLevel,
      overallReason,
      featureImportance,
      matchedRules,
      contributingFactors,
      mitigatingFactors,
      recommendations,
      timestamp: new Date(),
      metadata: context,
    };

    // 存储到历史记录
    if (this.explanationRepo) {
      await this.explanationRepo.create({
        id: uuidv4(),
        decision_id: decisionId,
        decision_type: decisionType,
        decision,
        confidence,
        confidence_level: confidenceLevel,
        overall_reason: overallReason,
        feature_importance: featureImportance as unknown as unknown[],
        matched_rules: matchedRules as unknown as unknown[],
        contributing_factors: contributingFactors,
        mitigating_factors: mitigatingFactors,
        recommendations,
        metadata_json: (context as Record<string, unknown>) ?? null,
      });
    }

    return explanation;
  }

  /**
   * 计算特征重要性（简化 SHAP 风格）
   *
   * 使用基于规则的方法模拟 SHAP 值：
   * - 每个特征根据其值和权重计算对最终决策的贡献
   * - 正值表示促进通过，负值表示促进失败
   * - 绝对值表示重要性大小
   */
  calculateFeatureImportance(features: DecisionFeature[]): FeatureImportance[] {
    const totalWeight = features.reduce(
      (sum, f) => sum + (f.weight ?? this.getDefaultWeight(f)),
      0
    );

    return features.map((feature) => {
      const weight = feature.weight ?? this.getDefaultWeight(feature);
      const normalizedWeight = totalWeight > 0 ? weight / totalWeight : 1 / features.length;

      // 计算特征值对决策的影响
      const impact = this.calculateFeatureImpact(feature);

      // SHAP 风格的重要性 = 归一化权重 * 影响方向
      const importance = normalizedWeight * impact;
      const absoluteImportance = Math.abs(importance);

      // 确定影响方向
      const direction: 'positive' | 'negative' | 'neutral' = importance > 0.05 ? 'positive' : importance < -0.05 ? 'negative' : 'neutral';

      // 生成描述
      const description = this.generateFeatureDescription(feature, importance);

      return {
        name: feature.name,
        importance: Math.round(importance * 1000) / 1000,
        absoluteImportance: Math.round(absoluteImportance * 1000) / 1000,
        direction,
        description,
        value: feature.value,
      };
    }).sort((a, b) => b.absoluteImportance - a.absoluteImportance);
  }

  /**
   * 生成决策理由
   */
  generateDecisionReason(
    decision: 'pass' | 'fail' | 'warn' | 'manual_review',
    features: DecisionFeature[],
    threshold?: number
  ): string {
    const rules = this.getRulesForFeatures(features);
    const baseReason = rules.reasonTemplates[decision];

    // 找出关键特征的问题
    const criticalIssues: string[] = [];
    const criticalFeatures = features.filter((f) => rules.criticalFeatures.includes(f.name));

    for (const feature of criticalFeatures) {
      const impact = this.calculateFeatureImpact(feature);
      if (impact < -0.3) {
        criticalIssues.push(
          `${feature.description || feature.name} 存在显著问题 (值: ${feature.value})`
        );
      }
    }

    // 如果有阈值信息，加入理由
    let thresholdInfo = '';
    if (threshold !== undefined) {
      const score = this.calculateOverallScore(features);
      thresholdInfo = `综合评分 ${score.toFixed(1)}，阈值 ${threshold.toFixed(1)}`;
    }

    const reason = [baseReason, thresholdInfo, ...criticalIssues].filter(Boolean).join('；');

    return reason;
  }

  /**
   * 获取置信度解释
   */
  getConfidenceExplanation(confidence: number): ConfidenceExplanation {
    const level = this.getConfidenceLevel(confidence);
    const template = CONFIDENCE_EXPLANATIONS[level];

    // 根据具体置信度调整可靠性指标
    const reliabilityIndicators = [...template.reliabilityIndicators];

    // 高置信度时增加正面指标
    if (confidence >= 0.9) {
      reliabilityIndicators.push('模型输出分布稳定');
    }

    // 低置信度时增加警告指标
    if (confidence < 0.4) {
      reliabilityIndicators.push('建议收集更多数据以提升模型准确度');
    }

    return {
      level,
      score: Math.round(confidence * 100) / 100,
      description: template.description,
      suggestedAction: template.suggestedAction,
      reliabilityIndicators,
    };
  }

  /**
   * 批量解释多个决策
   */
  async explainBatch(input: {
    decisionType: string;
    decisions: Array<{
      decisionId: string;
      decision: 'pass' | 'fail' | 'warn' | 'manual_review';
      features: DecisionFeature[];
      confidence?: number;
    }>;
  }): Promise<DecisionExplanation[]> {
    const results: DecisionExplanation[] = [];
    for (const d of input.decisions) {
      const result = await this.explainDecision({
        decisionId: d.decisionId,
        decisionType: input.decisionType,
        decision: d.decision,
        features: d.features,
        confidence: d.confidence,
      });
      results.push(result);
    }
    return results;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取置信度等级
   */
  private getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'very_low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'very_low';
  }

  /**
   * 计算特征对决策的影响值 (-1 到 1)
   */
  private calculateFeatureImpact(feature: DecisionFeature): number {
    const numericValue = this.toNumeric(feature.value);

    // 根据特征名使用不同的影响计算逻辑
    if (feature.name.includes('coverage') || feature.name.includes('success_rate') || feature.name.includes('health')) {
      // 越高越好的特征
      return (numericValue - 0.5) * 2; // 归一化到 [-1, 1]
    }

    if (feature.name.includes('issues') || feature.name.includes('smell') || feature.name.includes('failure') || feature.name.includes('risk')) {
      // 越低越好的特征（问题数、风险等）
      return -(numericValue - 0.5) * 2;
    }

    // 默认：假设越高越好
    return (numericValue - 0.5) * 2;
  }

  /**
   * 计算综合评分 (0-100)
   */
  private calculateOverallScore(features: DecisionFeature[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const feature of features) {
      const weight = feature.weight ?? this.getDefaultWeight(feature);
      const numericValue = this.toNumeric(feature.value);
      totalScore += numericValue * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 50;
  }

  /**
   * 分析影响因子和缓解因子
   */
  private analyzeFactors(
    featureImportance: FeatureImportance[],
    decision: 'pass' | 'fail' | 'warn' | 'manual_review'
  ): { contributingFactors: string[]; mitigatingFactors: string[] } {
    const contributingFactors: string[] = [];
    const mitigatingFactors: string[] = [];

    for (const fi of featureImportance) {
      if (fi.direction === 'negative' && (decision === 'fail' || decision === 'warn')) {
        contributingFactors.push(fi.description);
      } else if (fi.direction === 'positive' && (decision === 'fail' || decision === 'warn')) {
        mitigatingFactors.push(fi.description);
      } else if (fi.direction === 'positive' && (decision === 'pass')) {
        contributingFactors.push(fi.description);
      }
    }

    return { contributingFactors, mitigatingFactors };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    decision: 'pass' | 'fail' | 'warn' | 'manual_review',
    featureImportance: FeatureImportance[],
    confidenceLevel: 'high' | 'medium' | 'low' | 'very_low'
  ): string[] {
    const recommendations: string[] = [];

    switch (decision) {
      case 'fail':
        recommendations.push('修复以下关键问题后重新提交');
        // 针对最重要的负面特征给出建议
        const topIssues = featureImportance
          .filter((f) => f.direction === 'negative')
          .slice(0, 3);
        for (const issue of topIssues) {
          recommendations.push(`重点关注: ${issue.description}`);
        }
        break;
      case 'warn':
        recommendations.push('建议进行人工复核以确认决策结果');
        recommendations.push('关注以下风险因素');
        break;
      case 'manual_review':
        recommendations.push('自动评估无法确定，请安排专家审查');
        recommendations.push('收集更多信息以提升评估准确度');
        break;
      case 'pass':
        if (confidenceLevel === 'high') {
          recommendations.push('决策结果可信，可以继续后续流程');
        } else {
          recommendations.push('虽然决策为通过，但置信度有限，建议保持关注');
        }
        break;
    }

    // 低置信度通用建议
    if (confidenceLevel === 'low' || confidenceLevel === 'very_low') {
      recommendations.push('当前模型置信度较低，建议积累更多训练数据');
    }

    return recommendations;
  }

  /**
   * 获取特征的默认权重
   */
  private getDefaultWeight(feature: DecisionFeature): number {
    // 根据特征名模式给予默认权重
    if (feature.name.includes('security') || feature.name.includes('critical')) {
      return 0.3;
    }
    if (feature.name.includes('coverage') || feature.name.includes('quality')) {
      return 0.25;
    }
    if (feature.name.includes('complexity') || feature.name.includes('risk')) {
      return 0.2;
    }
    return 0.15;
  }

  /**
   * 将特征值转换为 0-1 的数值
   */
  private toNumeric(value: number | string | boolean): number {
    if (typeof value === 'number') {
      // 假设输入已经是 0-1 范围，或者进行简单的归一化
      return value > 1 ? Math.min(value / 100, 1) : Math.max(value, 0);
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    // 字符串尝试解析
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed > 1 ? Math.min(parsed / 100, 1) : Math.max(parsed, 0);
    }
    return 0.5; // 默认中间值
  }

  /**
   * 生成特征描述
   */
  private generateFeatureDescription(feature: DecisionFeature, importance: number): string {
    const direction = importance > 0 ? '促进通过' : importance < 0 ? '增加风险' : '无明显影响';
    const name = feature.description || feature.name;
    const value = typeof feature.value === 'number'
      ? (feature.value > 1 ? `${feature.value.toFixed(1)}%` : `${(feature.value * 100).toFixed(1)}%`)
      : String(feature.value);

    return `${name} (${value}) — ${direction}`;
  }

  /**
   * 获取适用于这些特征的规则集
   */
  private getRulesForFeatures(features: DecisionFeature[]): DecisionTypeRules {
    // 根据特征名匹配最合适的规则集
    const featureNames = features.map((f) => f.name);

    for (const [type, rules] of Array.from(this.decisionRules.entries())) {
      const matchCount = rules.criticalFeatures.filter((cf) =>
        featureNames.some((fn) => fn.includes(cf) || cf.includes(fn))
      ).length;
      if (matchCount >= 2) {
        return rules;
      }
    }

    // 返回默认规则
    return DEFAULT_DECISION_RULES['code-review'];
  }

  /**
   * 匹配规则路径 — 哪些规则被触发了
   */
  private matchRules(features: DecisionFeature[], decision: string): MatchedRule[] {
    const rules = this.getRulesForFeatures(features);
    const matchedRules: MatchedRule[] = [];

    for (const criticalFeature of rules.criticalFeatures) {
      const feature = features.find(
        (f) => f.name === criticalFeature || f.name.includes(criticalFeature) || criticalFeature.includes(f.name)
      );
      if (feature) {
        const numericValue = this.toNumeric(feature.value);
        const impact = this.calculateFeatureImpact(feature);
        const condition = this.getConditionForFeature(criticalFeature, decision);

        matchedRules.push({
          id: `rule-${criticalFeature}`,
          name: feature.description || criticalFeature,
          condition,
          matched: this.evaluateCondition(numericValue, decision, criticalFeature),
          contribution: Math.round(impact * 100) / 100,
        });
      }
    }

    return matchedRules;
  }

  /**
   * 获取特征对应的条件描述
   */
  private getConditionForFeature(featureName: string, decision: string): string {
    const thresholds = this.decisionRules.size > 0
      ? Array.from(this.decisionRules.values())[0]?.thresholds
      : undefined;

    if (!thresholds) return `${featureName} within normal range`;

    switch (decision) {
      case 'pass':
        return `${featureName} >= ${thresholds.pass}`;
      case 'fail':
        return `${featureName} < ${thresholds.fail}`;
      case 'warn':
        return `${thresholds.fail} <= ${featureName} < ${thresholds.warn}`;
      default:
        return `${featureName} evaluation inconclusive`;
    }
  }

  /**
   * 评估条件是否匹配
   */
  private evaluateCondition(value: number, decision: string, featureName: string): boolean {
    const rules = Array.from(this.decisionRules.values()).find(
      (r) => r.criticalFeatures.includes(featureName)
    );
    if (!rules) return true;

    switch (decision) {
      case 'pass':
        return value * 100 >= rules.thresholds.pass;
      case 'fail':
        return value * 100 < rules.thresholds.fail;
      case 'warn':
        return value * 100 >= rules.thresholds.fail && value * 100 < rules.thresholds.warn;
      default:
        return true;
    }
  }

  /**
   * 根据 ID 获取解释
   */
  async getExplanationById(decisionId: string): Promise<DecisionExplanation | undefined> {
    if (this.explanationRepo) {
      const entity = await this.explanationRepo.findByDecisionId(decisionId);
      if (entity) return this.entityToExplanation(entity);
    }
    return undefined;
  }

  /**
   * 获取解释历史记录
   */
  async getExplanationHistory(limit: number = 50, decisionType?: string): Promise<DecisionExplanation[]> {
    if (this.explanationRepo) {
      const entities = await this.explanationRepo.findRecent(limit, decisionType);
      return entities.map(e => this.entityToExplanation(e));
    }
    return [];
  }

  // ==================== Entity Conversion ====================

  private entityToExplanation(entity: DecisionExplanationEntity): DecisionExplanation {
    return {
      decisionId: entity.decision_id,
      decisionType: entity.decision_type,
      decision: entity.decision as DecisionExplanation['decision'],
      confidence: entity.confidence,
      confidenceLevel: entity.confidence_level as DecisionExplanation['confidenceLevel'],
      overallReason: entity.overall_reason ?? '',
      featureImportance: (entity.feature_importance as unknown as FeatureImportance[]) ?? [],
      matchedRules: (entity.matched_rules as unknown as MatchedRule[]) ?? [],
      contributingFactors: entity.contributing_factors ?? [],
      mitigatingFactors: entity.mitigating_factors ?? [],
      recommendations: entity.recommendations ?? [],
      timestamp: entity.created_at,
      metadata: entity.metadata_json ?? undefined,
    };
  }
}
