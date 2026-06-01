jest.setTimeout(30000);
/**
 * SelfAdaptivePipelineService 单元测试
 */

import { SelfAdaptivePipelineService } from '../SelfAdaptivePipelineService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe.skip('SelfAdaptivePipelineService', () => {
  let service: SelfAdaptivePipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SelfAdaptivePipelineService(mockPool as any);
  });

  describe('analyzePipelinePerformance', () => {
    it('应该返回性能指标', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.95',
          run_count: '50',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.metrics).toBeDefined();
      expect(result.metrics.avgDuration).toBe(300000);
      expect(result.metrics.successRate).toBe(0.95);
      expect(result.metrics.runCount).toBe(50);
    });

    it('应该返回适配建议', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '600000', // 10 minutes
          avg_success: '0.80',
          run_count: '100',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('应该建议增加超时时间', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '600001', // > 600000 (10 min)
          avg_success: '0.95',
          run_count: '10',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const timeoutSuggestion = result.suggestions.find(s => s.action === 'increase_timeout');
      expect(timeoutSuggestion).toBeDefined();
      expect(timeoutSuggestion!.confidence).toBeGreaterThan(0);
    });

    it('应该建议添加重试策略', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.85', // < 90%
          run_count: '50',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const retrySuggestion = result.suggestions.find(s => s.action === 'add_retry_policy');
      expect(retrySuggestion).toBeDefined();
    });

    it('应该处理空结果', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ avg_duration: null, avg_success: null, run_count: null }] });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.metrics.avgDuration).toBe(0);
      expect(result.metrics.successRate).toBe(0);
      expect(result.metrics.runCount).toBe(0);
    });
  });

  describe('applyAdaptation', () => {
    it('应该应用适配规则', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'a1',
          pipeline_id: 'p1',
          adaptation_type: 'timeout_adjustment',
          reason: 'avg_duration > 10min',
          confidence: 0.8,
          applied: false,
        }],
      });

      const result = await service.applyAdaptation('p1', {
        metric: 'duration',
        condition: 'avg_duration > 10min',
        action: 'increase_timeout',
        confidence: 0.8,
      });

      expect(result.pipeline_id).toBe('p1');
      expect(result.confidence).toBe(0.8);
    });

    it('应该记录适配历史', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'a1',
          adaptation_type: 'retry_optimization',
        }],
      });

      await service.applyAdaptation('p1', {
        metric: 'success_rate',
        condition: 'success_rate < 90%',
        action: 'add_retry_policy',
        confidence: 0.7,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_adaptations'),
        expect.any(Array)
      );
    });

    it('应该支持不同的适配类型', async () => {
      const adaptationTypes = [
        'timeout_adjustment',
        'resource_scaling',
        'retry_optimization',
        'parallelism_tuning',
      ];

      for (const type of adaptationTypes) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'a1', adaptation_type: type }],
        });

        const result = await service.applyAdaptation('p1', {
          metric: 'test',
          condition: 'test',
          action: type as any,
          confidence: 0.5,
        });

        expect(result.adaptation_type).toBe(type);
      }
    });
  });

  describe('getAdaptationHistory', () => {
    it('应该返回适配历史', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'a1', pipeline_id: 'p1', created_at: new Date('2024-01-02') },
          { id: 'a2', pipeline_id: 'p1', created_at: new Date('2024-01-01') },
        ],
      });

      const result = await service.getAdaptationHistory('p1');

      expect(result.length).toBe(2);
    });

    it('应该按时间倒序排列', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'a1', created_at: new Date('2024-01-02') },
          { id: 'a2', created_at: new Date('2024-01-01') },
        ],
      });

      await service.getAdaptationHistory('p1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['p1']
      );
    });

    it('应该处理空历史', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.getAdaptationHistory('p1');

      expect(result.length).toBe(0);
    });
  });

  describe('AdaptationRule', () => {
    it('应该包含完整的规则信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '600000',
          avg_success: '0.80',
          run_count: '50',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      if (result.suggestions.length > 0) {
        const rule = result.suggestions[0];
        expect(rule.metric).toBeDefined();
        expect(rule.condition).toBeDefined();
        expect(rule.action).toBeDefined();
        expect(rule.confidence).toBeGreaterThanOrEqual(0);
        expect(rule.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('PipelineAdaptation', () => {
    it('应该包含完整的适配信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'a1',
          tenant_id: 'tenant1',
          pipeline_id: 'p1',
          adaptation_type: 'timeout_adjustment',
          before_value: { timeout: 300000 },
          after_value: { timeout: 600000 },
          reason: 'Duration exceeded',
          confidence: 0.8,
          applied: false,
          created_at: new Date(),
        }],
      });

      const result = await service.applyAdaptation('p1', {
        metric: 'duration',
        condition: 'Duration exceeded',
        action: 'timeout_adjustment',
        confidence: 0.8,
      });

      expect(result.id).toBeDefined();
      expect(result.pipeline_id).toBeDefined();
      expect(result.adaptation_type).toBeDefined();
      expect(result.applied).toBeDefined();
    });
  });

  describe('Performance Analysis Edge Cases', () => {
    it('应该处理高运行次数', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.98',
          run_count: '1000',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.metrics.runCount).toBe(1000);
    });

    it('应该处理低成功率', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.50',
          run_count: '10',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('应该处理高平均时长', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '1800000', // 30 minutes
          avg_success: '0.95',
          run_count: '10',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.metrics.avgDuration).toBe(1800000);
    });
  });
});