/**
 * DecisionExplanationService 单元测试
 */

import {
  DecisionExplanationService,
  DecisionFeature,
} from '../DecisionExplanationService';

describe('DecisionExplanationService', () => {
  let service: DecisionExplanationService;

  beforeEach(() => {
    service = new DecisionExplanationService();
  });

  // ==================== explainDecision ====================

  describe('explainDecision', () => {
    const baseFeatures: DecisionFeature[] = [
      { name: 'code_complexity', value: 0.3, weight: 0.2, description: '代码复杂度' },
      { name: 'test_coverage', value: 0.85, weight: 0.25, description: '测试覆盖率' },
      { name: 'security_issues', value: 0.1, weight: 0.3, description: '安全问题数' },
      { name: 'code_smell_count', value: 0.2, weight: 0.25, description: '代码异味数' },
    ];

    it('should generate a complete decision explanation for pass', async () => {
      const explanation = await service.explainDecision({
        decisionId: 'dec-001',
        decisionType: 'code-review',
        decision: 'pass',
        features: baseFeatures,
        confidence: 0.92,
        threshold: 70,
      });

      expect(explanation.decisionId).toBe('dec-001');
      expect(explanation.decisionType).toBe('code-review');
      expect(explanation.decision).toBe('pass');
      expect(explanation.confidence).toBe(0.92);
      expect(explanation.confidenceLevel).toBe('high');
      expect(explanation.overallReason).toBeDefined();
      expect(explanation.featureImportance.length).toBe(baseFeatures.length);
      expect(explanation.timestamp).toBeInstanceOf(Date);
    });

    it('should generate explanation for fail decision', async () => {
      const riskyFeatures: DecisionFeature[] = [
        { name: 'code_complexity', value: 0.9, weight: 0.2, description: '代码复杂度' },
        { name: 'test_coverage', value: 0.15, weight: 0.25, description: '测试覆盖率' },
        { name: 'security_issues', value: 0.8, weight: 0.3, description: '安全问题数' },
        { name: 'code_smell_count', value: 0.7, weight: 0.25, description: '代码异味数' },
      ];

      const explanation = await service.explainDecision({
        decisionId: 'dec-002',
        decisionType: 'code-review',
        decision: 'fail',
        features: riskyFeatures,
        confidence: 0.88,
      });

      expect(explanation.decision).toBe('fail');
      expect(explanation.contributingFactors.length).toBeGreaterThan(0);
      expect(explanation.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate explanation for warn decision', async () => {
      const explanation = await service.explainDecision({
        decisionId: 'dec-003',
        decisionType: 'risk-assessment',
        decision: 'warn',
        features: [
          { name: 'change_scope', value: 0.5, weight: 0.3, description: '变更范围' },
          { name: 'dependency_health', value: 0.6, weight: 0.25, description: '依赖健康度' },
          { name: 'historical_failure_rate', value: 0.4, weight: 0.25, description: '历史失败率' },
          { name: 'time_risk', value: 0.5, weight: 0.2, description: '时间风险' },
        ],
        confidence: 0.65,
      });

      expect(explanation.decision).toBe('warn');
      expect(explanation.confidenceLevel).toBe('medium');
    });

    it('should include context in metadata', async () => {
      const explanation = await service.explainDecision({
        decisionId: 'dec-004',
        decisionType: 'code-review',
        decision: 'pass',
        features: baseFeatures,
        context: { userId: 'user-1', pipelineId: 'pipe-1' },
      });

      expect(explanation.metadata).toEqual({ userId: 'user-1', pipelineId: 'pipe-1' });
    });

    it('should handle manual_review decision', async () => {
      const explanation = await service.explainDecision({
        decisionId: 'dec-005',
        decisionType: 'diagnosis',
        decision: 'manual_review',
        features: [
          { name: 'error_pattern_match', value: 0.4, weight: 0.3 },
          { name: 'log_correlation', value: 0.3, weight: 0.25 },
        ],
        confidence: 0.35,
      });

      expect(explanation.decision).toBe('manual_review');
      expect(explanation.confidenceLevel).toBe('very_low');
    });
  });

  // ==================== calculateFeatureImportance ====================

  describe('calculateFeatureImportance', () => {
    it('should return sorted feature importance by absolute importance', () => {
      const features: DecisionFeature[] = [
        { name: 'feature_a', value: 0.9, weight: 0.1 },
        { name: 'feature_b', value: 0.1, weight: 0.4 },
        { name: 'feature_c', value: 0.5, weight: 0.2 },
      ];

      const importance = service.calculateFeatureImportance(features);

      expect(importance.length).toBe(3);
      for (let i = 1; i < importance.length; i++) {
        expect(importance[i].absoluteImportance).toBeLessThanOrEqual(
          importance[i - 1].absoluteImportance
        );
      }
    });

    it('should assign correct direction based on feature type', () => {
      const features: DecisionFeature[] = [
        { name: 'test_coverage', value: 0.9, weight: 0.3 }, // higher is better -> positive
        { name: 'security_issues', value: 0.8, weight: 0.3 }, // higher is worse -> negative
      ];

      const importance = service.calculateFeatureImportance(features);

      const coverage = importance.find((f) => f.name === 'test_coverage');
      const security = importance.find((f) => f.name === 'security_issues');

      expect(coverage?.direction).toBe('positive');
      expect(security?.direction).toBe('negative');
    });

    it('should use default weights when not provided', () => {
      const features: DecisionFeature[] = [
        { name: 'security_critical', value: 0.5 },
        { name: 'quality_score', value: 0.5 },
        { name: 'other_feature', value: 0.5 },
      ];

      const importance = service.calculateFeatureImportance(features);

      expect(importance.length).toBe(3);
      // All should have valid importance values
      importance.forEach((f) => {
        expect(f.importance).toBeGreaterThanOrEqual(-1);
        expect(f.importance).toBeLessThanOrEqual(1);
      });
    });

    it('should handle boolean feature values', () => {
      const features: DecisionFeature[] = [
        { name: 'is_approved', value: true, weight: 0.5 },
        { name: 'has_issues', value: false, weight: 0.5 },
      ];

      const importance = service.calculateFeatureImportance(features);

      expect(importance.length).toBe(2);
    });

    it('should handle string feature values', () => {
      const features: DecisionFeature[] = [
        { name: 'status', value: '0.75', weight: 0.5 },
        { name: 'category', value: 'unknown', weight: 0.5 },
      ];

      const importance = service.calculateFeatureImportance(features);

      expect(importance.length).toBe(2);
    });
  });

  // ==================== generateDecisionReason ====================

  describe('generateDecisionReason', () => {
    it('should generate a reason for pass decision', () => {
      const features: DecisionFeature[] = [
        { name: 'code_complexity', value: 0.2, weight: 0.3 },
        { name: 'test_coverage', value: 0.9, weight: 0.3 },
        { name: 'security_issues', value: 0.1, weight: 0.4 },
      ];

      const reason = service.generateDecisionReason('pass', features, 70);

      expect(reason.length).toBeGreaterThan(0);
      expect(reason).toContain('综合评分');
    });

    it('should generate a reason for fail decision', () => {
      const features: DecisionFeature[] = [
        { name: 'code_complexity', value: 0.9, weight: 0.3 },
        { name: 'security_issues', value: 0.85, weight: 0.4 },
      ];

      const reason = service.generateDecisionReason('fail', features);

      expect(reason.length).toBeGreaterThan(0);
    });

    it('should include threshold info when provided', () => {
      const features: DecisionFeature[] = [
        { name: 'code_complexity', value: 0.5, weight: 0.5 },
        { name: 'test_coverage', value: 0.5, weight: 0.5 },
      ];

      const reason = service.generateDecisionReason('warn', features, 60);

      expect(reason).toContain('60');
    });
  });

  // ==================== getConfidenceExplanation ====================

  describe('getConfidenceExplanation', () => {
    it('should return high confidence explanation for score >= 0.8', () => {
      const explanation = service.getConfidenceExplanation(0.9);

      expect(explanation.level).toBe('high');
      expect(explanation.score).toBe(0.9);
      expect(explanation.description).toBeDefined();
      expect(explanation.suggestedAction).toBeDefined();
    });

    it('should return medium confidence explanation for score >= 0.6', () => {
      const explanation = service.getConfidenceExplanation(0.7);

      expect(explanation.level).toBe('medium');
    });

    it('should return low confidence explanation for score >= 0.4', () => {
      const explanation = service.getConfidenceExplanation(0.5);

      expect(explanation.level).toBe('low');
    });

    it('should return very_low confidence explanation for score < 0.4', () => {
      const explanation = service.getConfidenceExplanation(0.2);

      expect(explanation.level).toBe('very_low');
    });

    it('should include additional indicator for very high confidence', () => {
      const explanation = service.getConfidenceExplanation(0.95);

      expect(explanation.reliabilityIndicators).toContain('模型输出分布稳定');
    });

    it('should include warning for low confidence', () => {
      const explanation = service.getConfidenceExplanation(0.3);

      expect(explanation.reliabilityIndicators).toContain(
        '建议收集更多数据以提升模型准确度'
      );
    });
  });

  // ==================== explainBatch ====================

  describe('explainBatch', () => {
    it('should explain multiple decisions', async () => {
      const results = await service.explainBatch({
        decisionType: 'code-review',
        decisions: [
          {
            decisionId: 'batch-1',
            decision: 'pass' as const,
            features: [{ name: 'coverage', value: 0.9, weight: 0.5 }],
            confidence: 0.85,
          },
          {
            decisionId: 'batch-2',
            decision: 'fail' as const,
            features: [{ name: 'security_issues', value: 0.8, weight: 0.5 }],
            confidence: 0.9,
          },
        ],
      });

      expect(results.length).toBe(2);
      expect(results[0].decisionId).toBe('batch-1');
      expect(results[1].decisionId).toBe('batch-2');
    });
  });

  // ==================== registerDecisionType ====================

  describe('registerDecisionType', () => {
    it('should accept custom decision type rules', async () => {
      service.registerDecisionType('custom-type', {
        thresholds: { pass: 80, warn: 60, fail: 40 },
        criticalFeatures: ['custom_feature'],
        reasonTemplates: {
          pass: 'Custom pass reason',
          fail: 'Custom fail reason',
          warn: 'Custom warn reason',
          manual_review: 'Custom manual review reason',
        },
      });

      const explanation = await service.explainDecision({
        decisionId: 'custom-1',
        decisionType: 'custom-type',
        decision: 'pass',
        features: [
          { name: 'custom_feature', value: 0.9, weight: 0.5 },
          { name: 'other_feature', value: 0.8, weight: 0.5 },
        ],
        confidence: 0.9,
      });

      expect(explanation.decisionType).toBe('custom-type');
    });
  });
});
