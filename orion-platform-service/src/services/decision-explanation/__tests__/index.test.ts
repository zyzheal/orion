/**
 * decision-explanation 模块导出测试
 *
 * 验证 index.ts 正确导出所有公共类型和类
 */

import {
  DecisionExplanationService,
  DecisionExplanationRepository,
  DecisionExplanationServiceError,
} from '../index';

// 导入类型（编译时检查，运行时不需要实际值）
import type {
  DecisionExplanation,
  DecisionFeedback,
  ShapFactor,
  RulePathStep,
  SubmitFeedbackInput,
  DecisionQualityStats,
  QualityTrend,
} from '../index';

describe('decision-explanation 模块导出', () => {
  describe('类导出', () => {
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

  describe('DecisionExplanationServiceError 实例验证', () => {
    it('应该创建具有正确属性的错误实例', () => {
      const error = new DecisionExplanationServiceError('测试错误', 'TEST_CODE');

      expect(error.message).toBe('测试错误');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('DecisionExplanationServiceError');
      expect(error).toBeInstanceOf(Error);
    });

    it('应该保留 stack trace', () => {
      const error = new DecisionExplanationServiceError('msg', 'code');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DecisionExplanationServiceError');
    });
  });

  describe('DecisionExplanationService 实例化', () => {
    it('应该能够使用 mock pool 创建实例', () => {
      const mockPool = { query: jest.fn() };
      const service = new DecisionExplanationService(mockPool as any);

      expect(service).toBeDefined();
      expect(service.getExplanation).toBeDefined();
      expect(service.generateExplanation).toBeDefined();
      expect(service.submitFeedback).toBeDefined();
      expect(service.getQualityStats).toBeDefined();
      expect(service.getQualityTrend).toBeDefined();
      expect(service.getFeedbackHistory).toBeDefined();
      expect(service.checkLowAccuracy).toBeDefined();
      expect(service.getLowAccuracyScenarios).toBeDefined();
    });
  });

  describe('DecisionExplanationRepository 实例化', () => {
    it('应该能够使用 mock pool 创建实例', () => {
      const mockPool = { query: jest.fn() };
      const repository = new DecisionExplanationRepository(mockPool as any);

      expect(repository).toBeDefined();
      expect(repository.findExplanation).toBeDefined();
      expect(repository.saveExplanation).toBeDefined();
      expect(repository.submitFeedback).toBeDefined();
      expect(repository.getQualityStats).toBeDefined();
      expect(repository.getQualityTrend).toBeDefined();
      expect(repository.listFeedback).toBeDefined();
    });
  });
});
