jest.setTimeout(30000);
/**
 * SelfAdaptivePipelineService 单元测试
 *
 * 覆盖：analyzePipelinePerformance、applyOptimization、applyAdaptation、
 * getAdaptationHistory、inferAdaptationType、各种建议生成路径、错误处理
 */

import { SelfAdaptivePipelineService, OptimizationSuggestion } from '../SelfAdaptivePipelineService';
import { OrionError } from '../../../errors';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('SelfAdaptivePipelineService', () => {
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
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
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
          max_duration: '900000',
          min_duration: '300000',
          avg_cpu: '50',
          avg_memory: '60',
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
          max_duration: '900000',
          min_duration: '300000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const timeoutSuggestion = result.suggestions.find(s => s.type === 'timeout_adjustment');
      expect(timeoutSuggestion).toBeDefined();
      expect(timeoutSuggestion!.confidence).toBeGreaterThan(0);
    });

    it('应该建议添加重试策略', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.85', // < 90%
          run_count: '50',
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const retrySuggestion = result.suggestions.find(s => s.type === 'retry_optimization');
      expect(retrySuggestion).toBeDefined();
    });

    it('应该处理空结果', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: null,
          avg_success: null,
          run_count: null,
          max_duration: null,
          min_duration: null,
          avg_cpu: null,
          avg_memory: null,
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.metrics.avgDuration).toBe(0);
      expect(result.metrics.successRate).toBe(0);
      expect(result.metrics.runCount).toBe(0);
    });
  });

  describe('applyAdaptation', () => {
    it('应该应用适配规则', async () => {
      // applyAdaptation calls applyOptimization which does UPDATE then INSERT
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] }) // UPDATE
        .mockResolvedValueOnce({
          rows: [{
            id: 'a1',
            pipeline_id: 'p1',
            adaptation_type: 'timeout_adjustment',
            reason: 'avg_duration > 10min',
            confidence: 0.8,
            applied: false,
          }],
        }); // INSERT

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
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] }) // UPDATE
        .mockResolvedValueOnce({
          rows: [{
            id: 'a1',
            adaptation_type: 'retry_optimization',
          }],
        }); // INSERT

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
        'retry_optimization',
        'resource_scaling',
        'parallelism_tuning',
      ];

      for (const type of adaptationTypes) {
        mockPool.query
          .mockResolvedValueOnce({ rows: [{ id: 'p1' }] }) // UPDATE
          .mockResolvedValueOnce({
            rows: [{ id: 'a1', adaptation_type: type }],
          }); // INSERT

        const result = await service.applyAdaptation('p1', {
          metric: 'test',
          condition: 'test',
          action: type,
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
          max_duration: '900000',
          min_duration: '300000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      if (result.suggestions.length > 0) {
        const rule = result.suggestions[0];
        expect(rule.type).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.confidence).toBeGreaterThanOrEqual(0);
        expect(rule.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('PipelineAdaptation', () => {
    it('应该包含完整的适配信息', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] }) // UPDATE
        .mockResolvedValueOnce({
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
        }); // INSERT

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
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
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
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
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
          max_duration: '3000000',
          min_duration: '600000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.metrics.avgDuration).toBe(1800000);
    });
  });

  // ==================== analyzePipelinePerformance: 资源使用率建议 ====================

  describe('analyzePipelinePerformance - 资源使用率建议', () => {
    it('当 CPU > 80% 时应建议增加资源', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.95',
          run_count: '50',
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '85',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const cpuSuggestion = result.suggestions.find(s => s.type === 'resource_scaling' && s.description.includes('CPU'));
      expect(cpuSuggestion).toBeDefined();
      expect(cpuSuggestion!.confidence).toBe(0.75);
      expect(cpuSuggestion!.riskLevel).toBe('medium');
      expect(cpuSuggestion!.before).toEqual({ cpu_limit: '500m' });
      expect(cpuSuggestion!.after).toEqual({ cpu_limit: '1000m' });
    });

    it('当内存 > 85% 时应建议增加内存', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.95',
          run_count: '50',
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '90',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const memSuggestion = result.suggestions.find(s => s.type === 'resource_scaling' && s.description.includes('内存'));
      expect(memSuggestion).toBeDefined();
      expect(memSuggestion!.confidence).toBe(0.8);
      expect(memSuggestion!.riskLevel).toBe('medium');
      expect(memSuggestion!.before).toEqual({ memory_limit: '512Mi' });
      expect(memSuggestion!.after).toEqual({ memory_limit: '1Gi' });
    });

    it('当 CPU 和内存都超标时应同时建议', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.95',
          run_count: '50',
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '90',
          avg_memory: '95',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const resourceSuggestions = result.suggestions.filter(s => s.type === 'resource_scaling');
      expect(resourceSuggestions.length).toBe(2);
    });

    it('当 CPU 和内存都正常时不应建议资源扩容', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.95',
          run_count: '50',
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const resourceSuggestions = result.suggestions.filter(s => s.type === 'resource_scaling');
      expect(resourceSuggestions.length).toBe(0);
    });
  });

  // ==================== analyzePipelinePerformance: 并行化建议 ====================

  describe('analyzePipelinePerformance - 并行化建议', () => {
    it('当运行时间 > 5 分钟且有多个阶段时应建议并行化', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            avg_duration: '400000',
            avg_success: '0.95',
            run_count: '50',
            max_duration: '600000',
            min_duration: '200000',
            avg_cpu: '50',
            avg_memory: '60',
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            { stage_name: 'build', avg_duration: '200000' },
            { stage_name: 'test', avg_duration: '150000' },
            { stage_name: 'deploy', avg_duration: '50000' },
          ],
        });

      const result = await service.analyzePipelinePerformance('p1');

      const parallelSuggestion = result.suggestions.find(s => s.type === 'parallelism_tuning');
      expect(parallelSuggestion).toBeDefined();
      expect(parallelSuggestion!.confidence).toBe(0.6);
      expect(parallelSuggestion!.riskLevel).toBe('high');
      expect(parallelSuggestion!.after).toHaveProperty('parallel', true);
      expect(parallelSuggestion!.after).toHaveProperty('stages');
      expect((parallelSuggestion!.after as any).stages).toContain('build');
      expect((parallelSuggestion!.after as any).stages).toContain('test');
    });

    it('当运行时间 > 5 分钟但只有 1 个阶段时不应建议并行化', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            avg_duration: '400000',
            avg_success: '0.95',
            run_count: '50',
            max_duration: '600000',
            min_duration: '200000',
            avg_cpu: '50',
            avg_memory: '60',
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            { stage_name: 'build', avg_duration: '400000' },
          ],
        });

      const result = await service.analyzePipelinePerformance('p1');

      const parallelSuggestion = result.suggestions.find(s => s.type === 'parallelism_tuning');
      expect(parallelSuggestion).toBeUndefined();
    });

    it('当运行时间 < 5 分钟时不应查询阶段信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '200000',
          avg_success: '0.95',
          run_count: '50',
          max_duration: '300000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      await service.analyzePipelinePerformance('p1');

      // Only one query should be made (the main aggregation), not the stage query
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== analyzePipelinePerformance: 重试策略边界条件 ====================

  describe('analyzePipelinePerformance - 重试策略边界条件', () => {
    it('当成功率 < 90% 且 runCount <= 5 时不应建议重试', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.80',
          run_count: '5', // <= 5
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const retrySuggestion = result.suggestions.find(s => s.type === 'retry_optimization');
      expect(retrySuggestion).toBeUndefined();
    });

    it('当成功率 < 90% 且 runCount > 5 时应建议重试', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.80',
          run_count: '6', // > 5
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const retrySuggestion = result.suggestions.find(s => s.type === 'retry_optimization');
      expect(retrySuggestion).toBeDefined();
    });

    it('当成功率 >= 90% 时不应建议重试', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '300000',
          avg_success: '0.95',
          run_count: '100',
          max_duration: '500000',
          min_duration: '100000',
          avg_cpu: '50',
          avg_memory: '60',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      const retrySuggestion = result.suggestions.find(s => s.type === 'retry_optimization');
      expect(retrySuggestion).toBeUndefined();
    });
  });

  // ==================== analyzePipelinePerformance: 无建议时返回空数组 ====================

  describe('analyzePipelinePerformance - 无建议场景', () => {
    it('当所有指标都正常时应返回空建议列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          avg_duration: '100000',
          avg_success: '0.99',
          run_count: '100',
          max_duration: '200000',
          min_duration: '50000',
          avg_cpu: '30',
          avg_memory: '40',
        }],
      });

      const result = await service.analyzePipelinePerformance('p1');

      expect(result.suggestions).toEqual([]);
      expect(result.metrics.avgDuration).toBe(100000);
      expect(result.metrics.successRate).toBe(0.99);
    });
  });

  // ==================== applyOptimization 直接测试 ====================

  describe('applyOptimization', () => {
    it('应该成功应用 timeout_adjustment 优化', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'timeout_adjustment',
        description: '平均运行时间超过 10 分钟',
        before: { timeout_ms: 600000 },
        after: { timeout_ms: 900000 },
        confidence: 0.8,
        riskLevel: 'low',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] }) // UPDATE
        .mockResolvedValueOnce({
          rows: [{
            id: 'a1',
            tenant_id: 'default',
            pipeline_id: 'p1',
            adaptation_type: 'timeout_adjustment',
            before_value: { timeout_ms: 600000 },
            after_value: { timeout_ms: 900000 },
            reason: '平均运行时间超过 10 分钟',
            confidence: 0.8,
            applied: true,
          }],
        }); // INSERT

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.adaptation_type).toBe('timeout_adjustment');
      expect(result.applied).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it('应该成功应用 retry_optimization 优化', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'retry_optimization',
        description: '成功率低于 90%',
        before: { retry_count: 0 },
        after: { retry_count: 2, retry_delay_ms: 5000, retry_backoff: 'exponential' },
        confidence: 0.7,
        riskLevel: 'low',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'retry_optimization', applied: true }],
        });

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.adaptation_type).toBe('retry_optimization');
      expect(result.applied).toBe(true);
    });

    it('应该成功应用 resource_scaling 优化', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'resource_scaling',
        description: 'CPU 使用率超过 80%',
        before: { cpu_limit: '500m' },
        after: { cpu_limit: '1000m' },
        confidence: 0.75,
        riskLevel: 'medium',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'resource_scaling', applied: false }],
        });

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.adaptation_type).toBe('resource_scaling');
      expect(result.applied).toBe(false); // medium risk is not auto-applied
    });

    it('应该成功应用 parallelism_tuning 优化', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'parallelism_tuning',
        description: '存在可并行执行的阶段',
        before: { parallel: false },
        after: { parallel: true, stages: ['build', 'test'] },
        confidence: 0.6,
        riskLevel: 'high',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'parallelism_tuning', applied: false }],
        });

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.adaptation_type).toBe('parallelism_tuning');
      expect(result.applied).toBe(false); // high risk is not auto-applied
    });

    it('当 pipeline 不存在时应抛出 OrionError', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'timeout_adjustment',
        description: 'test',
        before: {},
        after: { timeout_ms: 900000 },
        confidence: 0.8,
        riskLevel: 'low',
      };

      // UPDATE returns empty rows
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.applyOptimization('nonexistent', suggestion)).rejects.toThrow(OrionError);
    });

    it('low risk 优化应自动应用 (applied=true)', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'timeout_adjustment',
        description: 'test',
        before: {},
        after: { timeout_ms: 900000 },
        confidence: 0.8,
        riskLevel: 'low',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'timeout_adjustment', applied: true }],
        });

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.applied).toBe(true);
    });

    it('medium risk 优化不应自动应用 (applied=false)', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'resource_scaling',
        description: 'test',
        before: {},
        after: { cpu_limit: '1000m' },
        confidence: 0.75,
        riskLevel: 'medium',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'resource_scaling', applied: false }],
        });

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.applied).toBe(false);
    });

    it('high risk 优化不应自动应用 (applied=false)', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'parallelism_tuning',
        description: 'test',
        before: {},
        after: { parallel: true },
        confidence: 0.6,
        riskLevel: 'high',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'parallelism_tuning', applied: false }],
        });

      const result = await service.applyOptimization('p1', suggestion);

      expect(result.applied).toBe(false);
    });

    it('应该传递自定义 tenantId', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'timeout_adjustment',
        description: 'test',
        before: {},
        after: { timeout_ms: 900000 },
        confidence: 0.8,
        riskLevel: 'low',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', tenant_id: 'custom-tenant', applied: true }],
        });

      await service.applyOptimization('p1', suggestion, 'custom-tenant');

      // Verify tenant_id is passed in INSERT params
      const insertCall = mockPool.query.mock.calls[1];
      expect(insertCall[1][0]).toBe('custom-tenant');
    });

    it('应该记录适配历史到 pipeline_adaptations 表', async () => {
      const suggestion: OptimizationSuggestion = {
        type: 'timeout_adjustment',
        description: 'avg_duration > 10min',
        before: { timeout_ms: 600000 },
        after: { timeout_ms: 900000 },
        confidence: 0.8,
        riskLevel: 'low',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'timeout_adjustment' }],
        });

      await service.applyOptimization('p1', suggestion);

      const insertSql = mockPool.query.mock.calls[1][0] as string;
      expect(insertSql).toContain('INSERT INTO pipeline_adaptations');
      expect(insertSql).toContain('RETURNING');
    });
  });

  // ==================== applyAdaptation (legacy API) 扩展测试 ====================

  describe('applyAdaptation - inferAdaptationType', () => {
    it('当 action 包含 timeout 时应映射为 timeout_adjustment', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'timeout_adjustment' }],
        });

      const result = await service.applyAdaptation('p1', {
        metric: 'duration',
        condition: 'test',
        action: 'increase_timeout',
        confidence: 0.8,
      });

      expect(result.adaptation_type).toBe('timeout_adjustment');
    });

    it('当 action 包含 retry 时应映射为 retry_optimization', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'retry_optimization' }],
        });

      const result = await service.applyAdaptation('p1', {
        metric: 'success_rate',
        condition: 'test',
        action: 'add_retry_policy',
        confidence: 0.7,
      });

      expect(result.adaptation_type).toBe('retry_optimization');
    });

    it('当 action 包含 resource 时应映射为 resource_scaling', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'resource_scaling' }],
        });

      const result = await service.applyAdaptation('p1', {
        metric: 'cpu',
        condition: 'test',
        action: 'increase_resource',
        confidence: 0.75,
      });

      expect(result.adaptation_type).toBe('resource_scaling');
    });

    it('当 action 包含 scale 时应映射为 resource_scaling', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'resource_scaling' }],
        });

      const result = await service.applyAdaptation('p1', {
        metric: 'cpu',
        condition: 'test',
        action: 'horizontal_scale',
        confidence: 0.75,
      });

      expect(result.adaptation_type).toBe('resource_scaling');
    });

    it('当 action 包含 parallel 时应映射为 parallelism_tuning', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'parallelism_tuning' }],
        });

      const result = await service.applyAdaptation('p1', {
        metric: 'duration',
        condition: 'test',
        action: 'enable_parallel',
        confidence: 0.6,
      });

      expect(result.adaptation_type).toBe('parallelism_tuning');
    });

    it('当 action 不匹配任何已知类型时应默认为 timeout_adjustment', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'a1', adaptation_type: 'timeout_adjustment' }],
        });

      const result = await service.applyAdaptation('p1', {
        metric: 'duration',
        condition: 'test',
        action: 'unknown_action',
        confidence: 0.5,
      });

      expect(result.adaptation_type).toBe('timeout_adjustment');
    });
  });

  // ==================== getAdaptationHistory 扩展测试 ====================

  describe('getAdaptationHistory - 扩展', () => {
    it('应该按 created_at DESC 排序', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getAdaptationHistory('p1');

      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY created_at DESC');
    });

    it('应该按 pipeline_id 过滤', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.getAdaptationHistory('pipeline-xyz');

      const params = mockPool.query.mock.calls[0][1];
      expect(params).toEqual(['pipeline-xyz']);
    });

    it('应该返回大量历史记录', async () => {
      const largeHistory = Array.from({ length: 100 }, (_, i) => ({
        id: `a${i}`,
        pipeline_id: 'p1',
        created_at: new Date(Date.now() - i * 86400000),
      }));
      mockPool.query.mockResolvedValue({ rows: largeHistory });

      const result = await service.getAdaptationHistory('p1');

      expect(result).toHaveLength(100);
    });

    it('数据库查询失败时应抛出错误', async () => {
      mockPool.query.mockRejectedValue(new Error('connection lost'));

      await expect(service.getAdaptationHistory('p1')).rejects.toThrow('connection lost');
    });
  });
});
