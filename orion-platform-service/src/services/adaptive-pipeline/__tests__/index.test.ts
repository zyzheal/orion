/**
 * adaptive-pipeline 模块导出测试
 *
 * 验证 index.ts 正确导出所有公共类型和类
 */

import {
  SelfAdaptivePipelineService,
} from '../index';

// 导入类型（编译时检查）
import type {
  AdaptationRule,
  PipelineAdaptation,
} from '../index';

describe('adaptive-pipeline 模块导出', () => {
  describe('类导出', () => {
    it('应该导出 SelfAdaptivePipelineService', () => {
      expect(SelfAdaptivePipelineService).toBeDefined();
      expect(typeof SelfAdaptivePipelineService).toBe('function');
    });
  });

  describe('SelfAdaptivePipelineService 实例化', () => {
    it('应该能够使用 mock pool 创建实例', () => {
      const mockPool = { query: jest.fn() };
      const service = new SelfAdaptivePipelineService(mockPool as any);

      expect(service).toBeDefined();
      expect(service.analyzePipelinePerformance).toBeDefined();
      expect(service.applyAdaptation).toBeDefined();
      expect(service.getAdaptationHistory).toBeDefined();
      expect(service.applyOptimization).toBeDefined();
    });

    it('应该支持 analyzePipelinePerformance 方法', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{
            avg_duration: '300000',
            avg_success: '0.95',
            run_count: '50',
            max_duration: '500000',
            min_duration: '100000',
            avg_cpu: '50',
            avg_memory: '60',
          }],
        }),
      };
      const service = new SelfAdaptivePipelineService(mockPool as any);

      const result = await service.analyzePipelinePerformance('p1');

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('应该支持 getAdaptationHistory 方法', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      };
      const service = new SelfAdaptivePipelineService(mockPool as any);

      const result = await service.getAdaptationHistory('p1');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
