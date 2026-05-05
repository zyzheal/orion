/**
 * DecisionExplanationService 单元测试
 */

import { DecisionExplanationService, DecisionExplanationRepository, DecisionExplanationServiceError } from '../DecisionExplanationService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('DecisionExplanationService', () => {
  let service: DecisionExplanationService;
  let repository: DecisionExplanationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DecisionExplanationRepository(mockPool as any);
    service = new DecisionExplanationService(mockPool as any);
  });

  describe('DecisionExplanationRepository', () => {
    describe('findExplanation', () => {
      it('应该返回决策解释', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            decision_id: 'd1',
            scenario: 'risk-assessment',
            model_id: 'm1',
            created_at: new Date(),
          }],
        });

        const result = await repository.findExplanation('d1');

        expect(result).not.toBeNull();
        expect(result!.scenario).toBe('risk-assessment');
      });

      it('应该包含 SHAP 因素', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ decision_id: 'd1', created_at: new Date() }],
        });

        const result = await repository.findExplanation('d1');

        expect(result!.explanation.topFactors.length).toBeGreaterThan(0);
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findExplanation('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('submitFeedback', () => {
      it('应该提交决策反馈', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 'f1',
            decision_id: 'd1',
            rating: 'correct',
            comment: 'Good decision',
          }],
        });

        const result = await repository.submitFeedback({
          tenant_id: 'tenant1',
          decision_id: 'd1',
          rating: 'correct',
          comment: 'Good decision',
        });

        expect(result.rating).toBe('correct');
      });

      it('应该支持不同的评级', async () => {
        const ratings = ['correct', 'incorrect', 'partially'];

        for (const rating of ratings) {
          mockPool.query.mockResolvedValue({
            rows: [{ id: 'f1', rating }],
          });

          const result = await repository.submitFeedback({
            tenant_id: 'tenant1',
            decision_id: 'd1',
            rating,
          });

          expect(result.rating).toBe(rating);
        }
      });
    });

    describe('getQualityStats', () => {
      it('应该返回质量统计', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            scenario: 'risk-assessment',
            total_decisions: '100',
            correct_count: '80',
            incorrect_count: '15',
            partially_count: '5',
          }],
        });

        const result = await repository.getQualityStats('risk-assessment', 30);

        expect(result.total_decisions).toBe(100);
        expect(result.accuracy).toBeCloseTo(0.8, 2);
      });

      it('应该处理空结果', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.getQualityStats('risk-assessment', 30);

        expect(result.total_decisions).toBe(0);
        expect(result.accuracy).toBe(0);
      });
    });

    describe('getQualityTrend', () => {
      it('应该返回质量趋势', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { date: '2024-01-01', correct_count: '80', total_count: '100' },
            { date: '2024-01-02', correct_count: '90', total_count: '100' },
          ],
        });

        const result = await repository.getQualityTrend('risk-assessment', 30);

        expect(result.length).toBe(2);
        expect(result[0].accuracy).toBeCloseTo(0.8, 2);
      });

      it('应该按日期排序', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { date: '2024-01-02' },
            { date: '2024-01-01' },
          ],
        });

        await repository.getQualityTrend('risk-assessment', 30);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY date DESC'),
          expect.any(Array)
        );
      });
    });

    describe('listFeedback', () => {
      it('应该返回反馈列表', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { id: 'f1', decision_id: 'd1' },
            { id: 'f2', decision_id: 'd1' },
          ],
        });

        const result = await repository.listFeedback('d1');

        expect(result.length).toBe(2);
      });
    });
  });

  describe('DecisionExplanationService', () => {
    describe('getExplanation', () => {
      it('应该返回决策解释', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ decision_id: 'd1', scenario: 'risk-assessment' }],
        });

        const result = await service.getExplanation('d1');

        expect(result).not.toBeNull();
        expect(result!.confidence).toBeDefined();
      });
    });

    describe('submitFeedback', () => {
      it('应该提交反馈', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'f1', rating: 'correct' }],
        });

        const result = await service.submitFeedback({
          tenant_id: 'tenant1',
          decision_id: 'd1',
          rating: 'correct',
        });

        expect(result.rating).toBe('correct');
      });
    });

    describe('getQualityStats', () => {
      it('应该返回质量统计', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            total_decisions: '100',
            correct_count: '80',
          }],
        });

        const result = await service.getQualityStats('risk-assessment', 30);

        expect(result).toHaveProperty('accuracy');
      });
    });

    describe('getQualityTrend', () => {
      it('应该返回质量趋势', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ date: '2024-01-01', accuracy: 0.8 }],
        });

        const result = await service.getQualityTrend('risk-assessment', 30);

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getFeedbackHistory', () => {
      it('应该返回反馈历史', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'f1' }],
        });

        const result = await service.getFeedbackHistory('d1');

        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('ShapFactor', () => {
    it('应该包含正确的因素信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ decision_id: 'd1' }],
      });

      const result = await repository.findExplanation('d1');

      const factor = result!.explanation.topFactors[0];
      expect(factor.feature).toBeDefined();
      expect(factor.value).toBeDefined();
      expect(factor.contribution).toBeDefined();
      expect(factor.direction).toBe('positive').or.toBe('negative');
    });
  });

  describe('RulePathStep', () => {
    it('应该包含规则路径信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ decision_id: 'd1' }],
      });

      const result = await repository.findExplanation('d1');

      if (result!.explanation.ruleMatchPath) {
        const step = result!.explanation.ruleMatchPath[0];
        expect(step.ruleId).toBeDefined();
        expect(step.ruleName).toBeDefined();
        expect(step.condition).toBeDefined();
        expect(step.matched).toBeDefined();
      }
    });
  });

  describe('DecisionExplanationServiceError', () => {
    it('应该正确设置错误信息', () => {
      const error = new DecisionExplanationServiceError('Decision not found', 'DECISION_NOT_FOUND');

      expect(error.message).toBe('Decision not found');
      expect(error.code).toBe('DECISION_NOT_FOUND');
      expect(error.name).toBe('DecisionExplanationServiceError');
    });
  });
});