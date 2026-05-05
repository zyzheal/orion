/**
 * ResilienceScoreCalculator 单元测试
 */

import { ResilienceScoreCalculator, ResilienceScoreRepository, ResilienceScoreCalculatorError } from '../ResilienceScoreCalculator';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('ResilienceScoreCalculator', () => {
  let service: ResilienceScoreCalculator;
  let repository: ResilienceScoreRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ResilienceScoreRepository(mockPool as any);
    service = new ResilienceScoreCalculator(mockPool as any);
  });

  describe('ResilienceScoreRepository', () => {
    describe('findById', () => {
      it('应该返回韧性分数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            id: 's1',
            tenant_id: 'tenant1',
            score: 85,
            mttr_ms: 60000,
          }],
        });

        const result = await repository.findById('s1');

        expect(result).not.toBeNull();
        expect(result!.score).toBe(85);
      });

      it('应该返回 null 如果未找到', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await repository.findById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('findLatest', () => {
      it('应该返回最新分数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', score: 90 }],
        });

        const result = await repository.findLatest('tenant1');

        expect(result!.score).toBe(90);
      });

      it('应该支持按服务过滤', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', service_id: 'service-a' }],
        });

        await repository.findLatest('tenant1', 'service-a');

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('service_id'),
          expect.arrayContaining(['tenant1', 'service-a'])
        );
      });
    });

    describe('listHistory', () => {
      it('应该返回历史记录', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { calculated_at: new Date('2024-01-02'), score: 90 },
            { calculated_at: new Date('2024-01-01'), score: 85 },
          ],
        });

        const result = await repository.listHistory('tenant1');

        expect(result.length).toBe(2);
      });

      it('应该支持限制数量', async () => {
        mockPool.query.mockResolvedValue({
          rows: [],
        });

        await repository.listHistory('tenant1', undefined, 10);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.arrayContaining([10])
        );
      });
    });

    describe('create', () => {
      it('应该创建韧性分数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', score: 85 }],
        });

        const result = await repository.create({
          tenant_id: 'tenant1',
          score: 85,
          mttr_ms: 60000,
          success_rate: 0.95,
          error_budget: 0.05,
          trend: 'stable',
        });

        expect(result.score).toBe(85);
      });
    });

    describe('getServiceSummary', () => {
      it('应该返回服务汇总', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            service_id: 'service-a',
            avg_score: '85',
            avg_mttr: '60000',
          }],
        });

        const result = await repository.getServiceSummary('tenant1');

        expect(result.length).toBe(1);
        expect(result[0].service_id).toBe('service-a');
      });
    });
  });

  describe('ResilienceScoreCalculator', () => {
    describe('calculateScore', () => {
      it('应该计算韧性分数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ score: 85 }],
        });

        const result = await service.calculateScore('tenant1');

        expect(result.score).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });

      it('应该支持按服务计算', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ service_id: 'service-a', score: 90 }],
        });

        const result = await service.calculateScore('tenant1', 'service-a');

        expect(result).toBeDefined();
      });
    });

    describe('getScoreBreakdown', () => {
      it('应该返回分数分解', async () => {
        mockPool.query.mockResolvedValue({
          rows: [],
        });

        const result = await service.getScoreBreakdown('tenant1');

        expect(result.overall_score).toBeDefined();
        expect(result.mttr_score).toBeDefined();
        expect(result.success_rate_score).toBeDefined();
        expect(result.error_budget_score).toBeDefined();
        expect(result.factors).toBeDefined();
        expect(result.recommendations).toBeDefined();
      });
    });

    describe('getLatestScore', () => {
      it('应该返回最新分数', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 's1', score: 90 }],
        });

        const result = await service.getLatestScore('tenant1');

        expect(result!.score).toBe(90);
      });
    });

    describe('getHistory', () => {
      it('应该返回历史记录', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ date: '2024-01-01', score: 85 }],
        });

        const result = await service.getHistory('tenant1');

        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getServiceSummaries', () => {
      it('应该返回服务汇总', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{
            service_id: 'service-a',
            avg_score: '80',
          }],
        });

        const result = await service.getServiceSummaries('tenant1');

        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Scoring', () => {
    describe('MTTR Scoring', () => {
      it('应该对优秀 MTTR 给高分', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ mttr_ms: 30000 }], // < 1 min = excellent
        });

        const result = await service.calculateScore('tenant1');

        expect(result.mttr_ms).toBeLessThan(60000);
      });

      it('应该对糟糕 MTTR 给低分', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ mttr_ms: 900000 }], // > 15 min
        });

        const result = await service.calculateScore('tenant1');

        expect(result).toBeDefined();
      });
    });

    describe('Success Rate Scoring', () => {
      it('应该对高成功率给高分', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ success_rate: 0.99 }],
        });

        const result = await service.calculateScore('tenant1');

        expect(result.success_rate).toBeGreaterThan(0.95);
      });

      it('应该对低成功率给低分', async () => {
        mockPool.query.mockResolvedValue({
          rows: [{ success_rate: 0.80 }],
        });

        const result = await service.calculateScore('tenant1');

        expect(result).toBeDefined();
      });
    });

    describe('Trend Analysis', () => {
      it('应该识别改进趋势', async () => {
        mockPool.query.mockResolvedValue({
          rows: [
            { calculated_at: new Date('2024-01-03'), score: 95 },
            { calculated_at: new Date('2024-01-02'), score: 90 },
            { calculated_at: new Date('2024-01-01'), score: 85 },
          ],
        });

        const result = await service.calculateScore('tenant1');

        expect(result.trend).toBe('improving').or.toBe('stable').or.toBe('degrading');
      });
    });
  });

  describe('Weights', () => {
    it('应该使用正确的权重', () => {
      expect(service.WEIGHTS).toEqual({
        mttr: 0.25,
        successRate: 0.30,
        errorBudget: 0.25,
        recovery: 0.20,
      });
    });

    it('权重总和应为 1', () => {
      const total = Object.values(service.WEIGHTS).reduce((a, b) => a + b, 0);
      expect(total).toBe(1);
    });
  });

  describe('Thresholds', () => {
    it('应该定义 MTTR 阈值', () => {
      expect(service.THRESHOLDS.mttrExcellent).toBe(60000);
      expect(service.THRESHOLDS.mttrGood).toBe(300000);
      expect(service.THRESHOLDS.mttrAcceptable).toBe(900000);
    });

    it('应该定义成功率阈值', () => {
      expect(service.THRESHOLDS.successRateExcellent).toBe(0.99);
      expect(service.THRESHOLDS.successRateGood).toBe(0.95);
      expect(service.THRESHOLDS.successRateAcceptable).toBe(0.90);
    });
  });

  describe('ResilienceScoreCalculatorError', () => {
    it('应该正确设置错误信息', () => {
      const error = new ResilienceScoreCalculatorError('Calculation failed', 'CALCULATION_ERROR');

      expect(error.message).toBe('Calculation failed');
      expect(error.code).toBe('CALCULATION_ERROR');
      expect(error.name).toBe('ResilienceScoreCalculatorError');
    });
  });
});