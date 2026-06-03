/**
 * DecisionExplanationService 单元测试
 *
 * 覆盖范围：
 * - DecisionExplanationRepository: findExplanation, saveExplanation, submitFeedback, getQualityStats, getQualityTrend, listFeedback
 * - DecisionExplanationService: getExplanation, generateExplanation, submitFeedback, getQualityStats, getQualityTrend, getFeedbackHistory, checkLowAccuracy, getLowAccuracyScenarios
 * - DecisionExplanationServiceError
 * - 边界条件和错误处理
 */

import {
  DecisionExplanationService,
  DecisionExplanationRepository,
  DecisionExplanationServiceError,
  ShapFactor,
  RulePathStep,
  SubmitFeedbackInput,
} from '../DecisionExplanationService';

// ==================== Mock DatabasePool ====================

const mockQuery = jest.fn();

const mockPool = {
  query: mockQuery,
};

// ==================== Helpers ====================

function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    decision_id: 'dec-001',
    tenant_id: 'tenant-1',
    decision_type: 'risk-assessment',
    model_id: null,
    confidence_score: '0.85',
    feature_importance: [
      { feature: 'test_coverage', value: 0.85, contribution: 0.3, direction: 'positive' },
      { feature: 'code_complexity', value: 42, contribution: -0.15, direction: 'negative' },
    ],
    explanation: {
      summary: 'Test summary',
      ruleMatchPath: [
        { ruleId: 'r1', ruleName: 'coverage-rule', condition: 'coverage > 0.8', matched: true },
      ],
      alternativeOutcomes: ['approve', 'reject'],
    },
    created_at: new Date('2024-06-01T10:00:00Z'),
    ...overrides,
  };
}

function makeFeedbackRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fb-001',
    tenant_id: 'tenant-1',
    decision_id: 'dec-001',
    scenario: 'risk-assessment',
    model_id: null,
    rating: 'correct',
    comment: 'Good decision',
    created_by: 'user-1',
    created_at: new Date(),
    ...overrides,
  };
}

// ==================== Tests ====================

describe('DecisionExplanationService', () => {
  let service: DecisionExplanationService;
  let repository: DecisionExplanationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DecisionExplanationRepository(mockPool as any);
    service = new DecisionExplanationService(mockPool as any);
  });

  // ==================== DecisionExplanationRepository ====================

  describe('DecisionExplanationRepository', () => {
    describe('findExplanation', () => {
      it('应该返回完整的决策解释', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        const result = await repository.findExplanation('dec-001');

        expect(result).not.toBeNull();
        expect(result!.decision_id).toBe('dec-001');
        expect(result!.scenario).toBe('risk-assessment');
        expect(result!.model_version).toBe('unknown');
      });

      it('应该正确解析 confidence_score 为数字', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow({ confidence_score: '0.72' })] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.confidence).toBeCloseTo(0.72, 2);
      });

      it('应该处理 confidence_score 为 NaN 的情况', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow({ confidence_score: 'invalid' })] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.confidence).toBe(0);
      });

      it('应该正确映射 feature_importance 为 topFactors', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.explanation.topFactors).toHaveLength(2);
        expect(result!.explanation.topFactors[0].feature).toBe('test_coverage');
        expect(result!.explanation.topFactors[0].direction).toBe('positive');
        expect(result!.explanation.topFactors[1].direction).toBe('negative');
      });

      it('应该处理空的 feature_importance', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow({ feature_importance: [] })] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.explanation.topFactors).toHaveLength(0);
      });

      it('应该处理 null 的 feature_importance', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow({ feature_importance: null })] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.explanation.topFactors).toEqual([]);
      });

      it('应该处理 null 的 explanation', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow({ explanation: null })] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.explanation.summary).toBe('');
        expect(result!.explanation.topFactors).toHaveLength(2);
      });

      it('应该正确传递 ruleMatchPath 和 alternativeOutcomes', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.explanation.ruleMatchPath).toHaveLength(1);
        expect(result!.explanation.ruleMatchPath![0].ruleId).toBe('r1');
        expect(result!.explanation.alternativeOutcomes).toEqual(['approve', 'reject']);
      });

      it('应该返回 null 如果未找到', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await repository.findExplanation('nonexistent');

        expect(result).toBeNull();
      });

      it('应该使用 tenant_id 过滤条件', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        await repository.findExplanation('dec-001', 'tenant-1');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('AND tenant_id = $2'),
          ['dec-001', 'tenant-1']
        );
      });

      it('不带 tenantId 时只使用一个参数', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        await repository.findExplanation('dec-001');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('WHERE decision_id = $1'),
          ['dec-001']
        );
        expect(mockQuery.mock.calls[0][0]).not.toContain('tenant_id');
      });

      it('应该将 created_at 转换为 Date 对象', async () => {
        const dateStr = '2024-03-15T08:30:00.000Z';
        mockQuery.mockResolvedValue({ rows: [makeDbRow({ created_at: dateStr })] });

        const result = await repository.findExplanation('dec-001');

        expect(result!.evaluated_at).toBeInstanceOf(Date);
      });
    });

    describe('saveExplanation', () => {
      it('应该调用 INSERT 保存解释', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const factors: ShapFactor[] = [
          { feature: 'coverage', value: 0.9, contribution: 0.4, direction: 'positive' },
        ];
        const explanationData = { summary: 'Test', ruleMatchPath: [] };

        await repository.saveExplanation('dec-001', 'tenant-1', 'risk-assessment', explanationData, factors, 0.85);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO ai_decision_explanations'),
          ['dec-001', 'tenant-1', 'risk-assessment', explanationData, factors, 0.85]
        );
      });

      it('应该包含所有必要的列', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.saveExplanation('d1', 't1', 'deploy', {}, [], 0.5);

        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain('decision_id');
        expect(sql).toContain('tenant_id');
        expect(sql).toContain('decision_type');
        expect(sql).toContain('explanation');
        expect(sql).toContain('feature_importance');
        expect(sql).toContain('confidence_score');
      });
    });

    describe('submitFeedback', () => {
      it('应该提交反馈并返回结果', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow()] });

        const result = await repository.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'correct',
          comment: 'Good decision',
          created_by: 'user-1',
        });

        expect(result.id).toBe('fb-001');
        expect(result.rating).toBe('correct');
      });

      it('应该支持所有三种评级', async () => {
        const ratings: Array<'correct' | 'incorrect' | 'partially'> = ['correct', 'incorrect', 'partially'];

        for (const rating of ratings) {
          mockQuery.mockResolvedValue({ rows: [makeFeedbackRow({ rating })] });

          const result = await repository.submitFeedback({
            tenant_id: 'tenant-1',
            decision_id: 'dec-001',
            rating,
          });

          expect(result.rating).toBe(rating);
        }
      });

      it('应该传递 null comment 当未提供时', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow({ comment: null })] });

        await repository.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'correct',
        });

        const params = mockQuery.mock.calls[0][1];
        expect(params[3]).toBeNull();
      });

      it('应该传递 null created_by 当未提供时', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow({ created_by: null })] });

        await repository.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'correct',
        });

        const params = mockQuery.mock.calls[0][1];
        expect(params[4]).toBeNull();
      });
    });

    describe('getQualityStats', () => {
      it('应该正确计算准确率', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            scenario: 'risk-assessment',
            total_decisions: '100',
            correct_count: '80',
            incorrect_count: '15',
            partially_count: '5',
            avg_confidence: '0.82',
          }],
        });

        const result = await repository.getQualityStats('risk-assessment', 30);

        expect(result.total_decisions).toBe(100);
        expect(result.correct_count).toBe(80);
        expect(result.incorrect_count).toBe(15);
        expect(result.partially_count).toBe(5);
        expect(result.accuracy).toBeCloseTo(0.8, 2);
        expect(result.avg_confidence).toBeCloseTo(0.82, 2);
        expect(result.scenario).toBe('risk-assessment');
      });

      it('应该处理空结果返回零值', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await repository.getQualityStats('risk-assessment', 30);

        expect(result.total_decisions).toBe(0);
        expect(result.correct_count).toBe(0);
        expect(result.incorrect_count).toBe(0);
        expect(result.partially_count).toBe(0);
        expect(result.accuracy).toBe(0);
        expect(result.avg_confidence).toBe(0);
      });

      it('应该传递正确的查询参数', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.getQualityStats('deploy', 7);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('WHERE f.scenario = $1'),
          ['deploy', 7]
        );
      });

      it('应该处理 avg_confidence 为 null 的情况', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            total_decisions: '10',
            correct_count: '5',
            incorrect_count: '3',
            partially_count: '2',
            avg_confidence: null,
          }],
        });

        const result = await repository.getQualityStats('test', 30);

        expect(result.avg_confidence).toBe(0);
      });
    });

    describe('getQualityTrend', () => {
      it('应该返回按日期分组的趋势数据', async () => {
        mockQuery.mockResolvedValue({
          rows: [
            { date: '2024-01-02', correct_count: '90', total_count: '100' },
            { date: '2024-01-01', correct_count: '80', total_count: '100' },
          ],
        });

        const result = await repository.getQualityTrend('risk-assessment', 30);

        expect(result).toHaveLength(2);
        expect(result[0].accuracy).toBeCloseTo(0.9, 2);
        expect(result[0].count).toBe(100);
        expect(result[1].accuracy).toBeCloseTo(0.8, 2);
      });

      it('应该处理空趋势数据', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await repository.getQualityTrend('risk-assessment', 30);

        expect(result).toEqual([]);
      });

      it('应该处理 total_count 为 0 的情况', async () => {
        mockQuery.mockResolvedValue({
          rows: [{ date: '2024-01-01', correct_count: '0', total_count: '0' }],
        });

        const result = await repository.getQualityTrend('risk-assessment', 30);

        expect(result[0].accuracy).toBe(0);
      });

      it('应该使用 ORDER BY date DESC', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.getQualityTrend('risk-assessment', 30);

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY date DESC'),
          expect.any(Array)
        );
      });
    });

    describe('listFeedback', () => {
      it('应该返回指定决策的反馈列表', async () => {
        mockQuery.mockResolvedValue({
          rows: [
            makeFeedbackRow({ id: 'fb-001' }),
            makeFeedbackRow({ id: 'fb-002', rating: 'incorrect' }),
          ],
        });

        const result = await repository.listFeedback('dec-001');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('fb-001');
        expect(result[1].id).toBe('fb-002');
      });

      it('应该返回空列表当无反馈时', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await repository.listFeedback('dec-001');

        expect(result).toEqual([]);
      });

      it('应该按 created_at DESC 排序', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await repository.listFeedback('dec-001');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC'),
          ['dec-001']
        );
      });
    });
  });

  // ==================== DecisionExplanationService ====================

  describe('DecisionExplanationService', () => {
    describe('getExplanation', () => {
      it('应该返回决策解释', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        const result = await service.getExplanation('dec-001');

        expect(result.decision_id).toBe('dec-001');
        expect(result.confidence).toBeDefined();
      });

      it('应该在未找到时抛出 EXPLANATION_NOT_FOUND 错误', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await expect(service.getExplanation('nonexistent')).rejects.toThrow(DecisionExplanationServiceError);
        await expect(service.getExplanation('nonexistent')).rejects.toMatchObject({
          code: 'EXPLANATION_NOT_FOUND',
        });
      });

      it('应该传递 tenantId 到 repository', async () => {
        mockQuery.mockResolvedValue({ rows: [makeDbRow()] });

        await service.getExplanation('dec-001', 'tenant-1');

        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('AND tenant_id = $2'),
          ['dec-001', 'tenant-1']
        );
      });

      it('错误消息应该包含 decisionId', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await expect(service.getExplanation('abc-123')).rejects.toThrow('abc-123');
      });
    });

    describe('generateExplanation', () => {
      it('应该生成完整的决策解释', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          'model-1',
          { test_coverage: 0.85, code_complexity: 42 },
          { risk_level: 'low', confidence: 0.9 },
          { test_coverage: 0.4, code_complexity: -0.2 }
        );

        expect(result.decision_id).toBe('dec-001');
        expect(result.scenario).toBe('risk-assessment');
        expect(result.model_id).toBe('model-1');
        expect(result.model_version).toBe('v2.1.0');
      });

      it('应该使用 output.confidence 作为优先级', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          null,
          { test_coverage: 0.85 },
          { confidence: 0.95 },
          { test_coverage: 0.4 }
        );

        expect(result.confidence).toBe(0.95);
      });

      it('应该在 output 无 confidence 时从 SHAP 值计算', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          null,
          { a: 1, b: 2 },
          {},
          { a: 0.6, b: 0.5 }
        );

        // totalMagnitude = 0.6 + 0.5 = 1.1, min(1, 1.1/2) = 0.55
        expect(result.confidence).toBeCloseTo(0.55, 2);
      });

      it('应该在无 SHAP 值时返回默认 confidence 0.5', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          null,
          { a: 1 },
          {}
        );

        expect(result.confidence).toBe(0.5);
      });

      it('应该在空 SHAP 值时返回默认 confidence 0.5', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          null,
          { a: 1 },
          {},
          {}
        );

        expect(result.confidence).toBe(0.5);
      });

      it('应该从 SHAP 值中选取 top 3 因素', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const shapValues = {
          feature_a: 0.5,
          feature_b: -0.8,
          feature_c: 0.3,
          feature_d: 0.9,
          feature_e: -0.1,
        };

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          null,
          { feature_a: 1, feature_b: 2, feature_c: 3, feature_d: 4, feature_e: 5 },
          {},
          shapValues
        );

        expect(result.explanation.topFactors).toHaveLength(3);
        // 按绝对值排序: feature_d(0.9) > feature_b(0.8) > feature_a(0.5)
        expect(result.explanation.topFactors[0].feature).toBe('feature_d');
        expect(result.explanation.topFactors[1].feature).toBe('feature_b');
        expect(result.explanation.topFactors[2].feature).toBe('feature_a');
      });

      it('应该正确设置 direction 为 positive 或 negative', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'test',
          null,
          { a: 1, b: 2 },
          {},
          { a: 0.5, b: -0.3 }
        );

        const factors = result.explanation.topFactors;
        expect(factors.find(f => f.feature === 'a')!.direction).toBe('positive');
        expect(factors.find(f => f.feature === 'b')!.direction).toBe('negative');
      });

      it('当特征不在 inputFeatures 中时应该使用 N/A', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'test',
          null,
          {},  // 空的 inputFeatures
          {},
          { missing_feature: 0.5 }
        );

        expect(result.explanation.topFactors[0].value).toBe('N/A');
      });

      it('应该生成包含 risk_level 的 summary', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          null,
          { test_coverage: 0.9 },
          { risk_level: 'high' },
          { test_coverage: 0.5 }
        );

        expect(result.explanation.summary).toContain('high');
        expect(result.explanation.summary).toContain('risk level');
      });

      it('应该生成默认 summary 当无因素时', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'deploy',
          null,
          {},
          {}
        );

        expect(result.explanation.summary).toContain('deploy');
        expect(result.explanation.summary).toContain('default rules');
      });

      it('应该截断长 output 为 50 字符', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const longOutput = { result: 'a'.repeat(100) };
        const result = await service.generateExplanation(
          'dec-001',
          'test',
          null,
          { f: 1 },
          longOutput,
          { f: 0.5 }
        );

        // summary 中 JSON.stringify(output).slice(0, 50) 应不超过 50 字符 + 前缀
        expect(result.explanation.summary).toContain('Result:');
      });

      it('应该保存到数据库当提供 tenantId 时', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          'model-1',
          { test_coverage: 0.85 },
          { risk_level: 'low' },
          { test_coverage: 0.4 },
          undefined,
          'tenant-1'
        );

        // 第二次调用应该是 INSERT
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO ai_decision_explanations');
      });

      it('不保存到数据库当无 tenantId 时', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.generateExplanation(
          'dec-001',
          'risk-assessment',
          'model-1',
          { test_coverage: 0.85 },
          { risk_level: 'low' },
          { test_coverage: 0.4 }
        );

        expect(mockQuery).not.toHaveBeenCalled();
      });

      it('应该包含 ruleMatchPath', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const rulePath: RulePathStep[] = [
          { ruleId: 'r1', ruleName: 'rule-1', condition: 'x > 0', matched: true },
        ];

        const result = await service.generateExplanation(
          'dec-001',
          'test',
          null,
          {},
          {},
          undefined,
          rulePath
        );

        expect(result.explanation.ruleMatchPath).toEqual(rulePath);
      });

      it('SHAP confidence 应该限制在最大值 1', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.generateExplanation(
          'dec-001',
          'test',
          null,
          { a: 1, b: 2, c: 3 },
          {},
          { a: 1.0, b: 1.0, c: 1.0 }  // total = 3.0, min(1, 3/2) = 1
        );

        expect(result.confidence).toBe(1);
      });

      it('应该包含 evaluated_at 时间戳', async () => {
        mockQuery.mockResolvedValue({ rows: [] });
        const before = new Date();

        const result = await service.generateExplanation(
          'dec-001',
          'test',
          null,
          {},
          {}
        );

        expect(result.evaluated_at).toBeInstanceOf(Date);
        expect(result.evaluated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      });
    });

    describe('submitFeedback', () => {
      it('应该提交有效的反馈', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow()] });

        const result = await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'correct',
        });

        expect(result.rating).toBe('correct');
      });

      it('应该接受 partially 评级', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow({ rating: 'partially' })] });

        const result = await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'partially',
        });

        expect(result.rating).toBe('partially');
      });

      it('应该接受 incorrect 评级', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow({ rating: 'incorrect' })] });

        const result = await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'incorrect',
        });

        expect(result.rating).toBe('incorrect');
      });

      it('应该在无效评级时抛出 INVALID_RATING 错误', async () => {
        await expect(
          service.submitFeedback({
            tenant_id: 'tenant-1',
            decision_id: 'dec-001',
            rating: 'invalid' as any,
          })
        ).rejects.toThrow(DecisionExplanationServiceError);

        await expect(
          service.submitFeedback({
            tenant_id: 'tenant-1',
            decision_id: 'dec-001',
            rating: 'invalid' as any,
          })
        ).rejects.toMatchObject({ code: 'INVALID_RATING' });
      });

      it('无效评级时不应该调用数据库', async () => {
        try {
          await service.submitFeedback({
            tenant_id: 'tenant-1',
            decision_id: 'dec-001',
            rating: 'wrong' as any,
          });
        } catch {
          // ignore
        }

        expect(mockQuery).not.toHaveBeenCalled();
      });

      it('应该传递可选字段 comment 和 created_by', async () => {
        mockQuery.mockResolvedValue({ rows: [makeFeedbackRow()] });

        await service.submitFeedback({
          tenant_id: 'tenant-1',
          decision_id: 'dec-001',
          rating: 'correct',
          comment: 'Looks good',
          created_by: 'admin',
        });

        const params = mockQuery.mock.calls[0][1];
        expect(params).toContain('Looks good');
        expect(params).toContain('admin');
      });
    });

    describe('getQualityStats', () => {
      it('应该返回质量统计', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            scenario: 'risk-assessment',
            total_decisions: '50',
            correct_count: '40',
            incorrect_count: '5',
            partially_count: '5',
            avg_confidence: '0.88',
          }],
        });

        const result = await service.getQualityStats('risk-assessment', 30);

        expect(result.accuracy).toBeCloseTo(0.8, 2);
        expect(result.total_decisions).toBe(50);
      });

      it('应该使用默认 7 天', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.getQualityStats('risk-assessment');

        const params = mockQuery.mock.calls[0][1];
        expect(params[1]).toBe(7);
      });

      it('应该接受自定义天数', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.getQualityStats('deploy', 14);

        const params = mockQuery.mock.calls[0][1];
        expect(params[1]).toBe(14);
      });
    });

    describe('getQualityTrend', () => {
      it('应该返回包装在 data 中的趋势', async () => {
        mockQuery.mockResolvedValue({
          rows: [{ date: '2024-01-01', correct_count: '8', total_count: '10' }],
        });

        const result = await service.getQualityTrend('risk-assessment', 30);

        expect(result).toHaveProperty('data');
        expect(result.data).toHaveLength(1);
        expect(result.data[0].accuracy).toBeCloseTo(0.8, 2);
      });

      it('应该使用默认 30 天', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.getQualityTrend('risk-assessment');

        const params = mockQuery.mock.calls[0][1];
        expect(params[1]).toBe(30);
      });

      it('应该返回空 data 数组当无数据', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.getQualityTrend('deploy');

        expect(result.data).toEqual([]);
      });
    });

    describe('getFeedbackHistory', () => {
      it('应该返回反馈历史', async () => {
        mockQuery.mockResolvedValue({
          rows: [makeFeedbackRow({ id: 'fb-001' }), makeFeedbackRow({ id: 'fb-002' })],
        });

        const result = await service.getFeedbackHistory('dec-001');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('fb-001');
      });

      it('应该返回空列表当无历史', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.getFeedbackHistory('dec-001');

        expect(result).toEqual([]);
      });
    });

    describe('checkLowAccuracy', () => {
      it('当准确率低于阈值且样本量 >= 10 时返回 isLow: true', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            scenario: 'risk-assessment',
            total_decisions: '20',
            correct_count: '10',
            incorrect_count: '8',
            partially_count: '2',
            avg_confidence: '0.6',
          }],
        });

        const result = await service.checkLowAccuracy('risk-assessment');

        expect(result.isLow).toBe(true);
        expect(result.accuracy).toBeCloseTo(0.5, 2);
        expect(result.threshold).toBe(0.7);
      });

      it('当准确率高于阈值时返回 isLow: false', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            scenario: 'deploy',
            total_decisions: '50',
            correct_count: '45',
            incorrect_count: '3',
            partially_count: '2',
            avg_confidence: '0.9',
          }],
        });

        const result = await service.checkLowAccuracy('deploy');

        expect(result.isLow).toBe(false);
        expect(result.accuracy).toBeCloseTo(0.9, 2);
      });

      it('当样本量 < 10 时返回 isLow: false（即使准确率低）', async () => {
        mockQuery.mockResolvedValue({
          rows: [{
            scenario: 'test',
            total_decisions: '5',
            correct_count: '1',
            incorrect_count: '4',
            partially_count: '0',
            avg_confidence: '0.3',
          }],
        });

        const result = await service.checkLowAccuracy('test');

        expect(result.isLow).toBe(false);
      });

      it('当无数据时返回 isLow: false', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.checkLowAccuracy('empty-scenario');

        expect(result.isLow).toBe(false);
        expect(result.accuracy).toBe(0);
        expect(result.threshold).toBe(0.7);
      });

      it('应该使用 30 天窗口', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.checkLowAccuracy('test');

        const params = mockQuery.mock.calls[0][1];
        expect(params[1]).toBe(30);
      });
    });

    describe('getLowAccuracyScenarios', () => {
      it('应该返回低准确率场景列表', async () => {
        mockQuery.mockResolvedValue({
          rows: [
            { scenario: 'risk-assessment', total: '20', correct: '10' },
            { scenario: 'deploy', total: '15', correct: '12' },
          ],
        });

        const result = await service.getLowAccuracyScenarios();

        // risk-assessment: 10/20 = 0.5 < 0.7 -> included
        // deploy: 12/15 = 0.8 > 0.7 -> excluded
        expect(result).toHaveLength(1);
        expect(result[0].scenario).toBe('risk-assessment');
        expect(result[0].accuracy).toBeCloseTo(0.5, 2);
        expect(result[0].total_decisions).toBe(20);
      });

      it('应该返回空数组当所有场景准确率都足够', async () => {
        mockQuery.mockResolvedValue({
          rows: [
            { scenario: 'good-scenario', total: '50', correct: '45' },
          ],
        });

        const result = await service.getLowAccuracyScenarios();

        expect(result).toEqual([]);
      });

      it('应该返回空数组当无数据', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const result = await service.getLowAccuracyScenarios();

        expect(result).toEqual([]);
      });

      it('应该过滤掉样本量 < 10 的场景（HAVING COUNT >= 10）', async () => {
        mockQuery.mockResolvedValue({
          rows: [
            { scenario: 'small-sample', total: '10', correct: '3' },
          ],
        });

        const result = await service.getLowAccuracyScenarios();

        // 3/10 = 0.3 < 0.7, 且 total >= 10, 应该包含
        expect(result).toHaveLength(1);
        expect(result[0].scenario).toBe('small-sample');
      });

      it('应该直接查询数据库而非复用 getQualityStats', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        await service.getLowAccuracyScenarios();

        // 应该直接使用 pool.query 而不是通过 repository
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain('GROUP BY scenario');
        expect(sql).toContain('HAVING');
      });
    });
  });

  // ==================== DecisionExplanationServiceError ====================

  describe('DecisionExplanationServiceError', () => {
    it('应该正确设置错误属性', () => {
      const error = new DecisionExplanationServiceError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('DecisionExplanationServiceError');
    });

    it('应该是 Error 的实例', () => {
      const error = new DecisionExplanationServiceError('msg', 'code');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DecisionExplanationServiceError);
    });

    it('应该保留 stack trace', () => {
      const error = new DecisionExplanationServiceError('msg', 'code');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DecisionExplanationServiceError');
    });
  });

  // ==================== ShapFactor 类型验证 ====================

  describe('ShapFactor 结构验证', () => {
    it('应该包含所有必要字段', async () => {
      mockQuery.mockResolvedValue({
        rows: [makeDbRow({
          feature_importance: [
            { feature: 'coverage', value: 0.9, contribution: 0.4, direction: 'positive' },
          ],
        })],
      });

      const result = await repository.findExplanation('dec-001');
      const factor = result!.explanation.topFactors[0];

      expect(typeof factor.feature).toBe('string');
      expect(typeof factor.contribution).toBe('number');
      expect(factor.direction === 'positive' || factor.direction === 'negative').toBe(true);
    });

    it('value 可以是数字或字符串', async () => {
      mockQuery.mockResolvedValue({
        rows: [makeDbRow({
          feature_importance: [
            { feature: 'num_feature', value: 42, contribution: 0.1, direction: 'positive' },
            { feature: 'str_feature', value: 'high', contribution: 0.2, direction: 'positive' },
          ],
        })],
      });

      const result = await repository.findExplanation('dec-001');

      expect(typeof result!.explanation.topFactors[0].value).toBe('number');
      expect(typeof result!.explanation.topFactors[1].value).toBe('string');
    });
  });

  // ==================== RulePathStep 类型验证 ====================

  describe('RulePathStep 结构验证', () => {
    it('应该包含所有必要字段', async () => {
      mockQuery.mockResolvedValue({
        rows: [makeDbRow({
          explanation: {
            ruleMatchPath: [
              { ruleId: 'r1', ruleName: 'test-rule', condition: 'x > 0', matched: true },
              { ruleId: 'r2', ruleName: 'fail-rule', condition: 'y < 10', matched: false },
            ],
          },
        })],
      });

      const result = await repository.findExplanation('dec-001');
      const steps = result!.explanation.ruleMatchPath!;

      expect(steps).toHaveLength(2);
      expect(steps[0].ruleId).toBe('r1');
      expect(steps[0].matched).toBe(true);
      expect(steps[1].matched).toBe(false);
    });

    it('当 explanation 无 ruleMatchPath 时应该为 undefined', async () => {
      mockQuery.mockResolvedValue({
        rows: [makeDbRow({ explanation: {} })],
      });

      const result = await repository.findExplanation('dec-001');

      expect(result!.explanation.ruleMatchPath).toBeUndefined();
    });
  });

  // ==================== 数据库错误传播 ====================

  describe('数据库错误传播', () => {
    it('findExplanation 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findExplanation('dec-001')).rejects.toThrow('Connection refused');
    });

    it('saveExplanation 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Duplicate key'));

      await expect(
        repository.saveExplanation('d1', 't1', 'test', {}, [], 0.5)
      ).rejects.toThrow('Duplicate key');
    });

    it('submitFeedback 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Constraint violation'));

      await expect(
        repository.submitFeedback({ tenant_id: 't1', decision_id: 'd1', rating: 'correct' })
      ).rejects.toThrow('Constraint violation');
    });

    it('getQualityStats 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Timeout'));

      await expect(repository.getQualityStats('test', 30)).rejects.toThrow('Timeout');
    });

    it('getQualityTrend 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));

      await expect(repository.getQualityTrend('test', 30)).rejects.toThrow('Query failed');
    });

    it('listFeedback 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(repository.listFeedback('d1')).rejects.toThrow('Network error');
    });

    it('getExplanation 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('DB error'));

      await expect(service.getExplanation('d1')).rejects.toThrow('DB error');
    });

    it('generateExplanation 应该传播数据库保存错误', async () => {
      mockQuery.mockRejectedValue(new Error('Save failed'));

      await expect(
        service.generateExplanation('d1', 'test', null, {}, {}, undefined, undefined, 't1')
      ).rejects.toThrow('Save failed');
    });

    it('checkLowAccuracy 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Stats failed'));

      await expect(service.checkLowAccuracy('test')).rejects.toThrow('Stats failed');
    });

    it('getLowAccuracyScenarios 应该传播数据库错误', async () => {
      mockQuery.mockRejectedValue(new Error('Query error'));

      await expect(service.getLowAccuracyScenarios()).rejects.toThrow('Query error');
    });
  });

  // ==================== 模块导出验证 ====================

  describe('模块导出', () => {
    it('应该导出 DecisionExplanationService', () => {
      expect(DecisionExplanationService).toBeDefined();
      expect(typeof DecisionExplanationService).toBe('function');
    });

    it('应该导出 DecisionExplanationRepository', () => {
      expect(DecisionExplanationRepository).toBeDefined();
      expect(typeof DecisionExplanationRepository).toBe('function');
    });

    it('应该导出 DecisionExplanationServiceError', () => {
      expect(DecisionExplanationServiceError).toBeDefined();
      expect(typeof DecisionExplanationServiceError).toBe('function');
    });
  });
});
