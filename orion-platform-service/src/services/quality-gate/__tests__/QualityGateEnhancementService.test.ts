/**
 * QualityGateEnhancementService 单元测试
 */

import { QualityGateEnhancementService } from '../QualityGateEnhancementService';

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('QualityGateEnhancementService', () => {
  let service: QualityGateEnhancementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QualityGateEnhancementService(mockPool as any);
  });

  describe('createRule', () => {
    it('应该创建质量门规则', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          tenant_id: 'tenant1',
          name: 'coverage-threshold',
          type: 'coverage',
          threshold: 80,
          operator: 'gte',
          blocking: true,
          enabled: true,
        }],
      });

      const result = await service.createRule({
        tenant_id: 'tenant1',
        name: 'coverage-threshold',
        type: 'coverage',
        threshold: 80,
        operator: 'gte',
        blocking: true,
      });

      expect(result.name).toBe('coverage-threshold');
      expect(result.threshold).toBe(80);
      expect(result.enabled).toBe(true);
    });

    it('应该默认启用规则', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          enabled: true,
        }],
      });

      const result = await service.createRule({
        tenant_id: 'tenant1',
        name: 'rule',
        type: 'coverage',
        threshold: 80,
        operator: 'gte',
      });

      expect(result.enabled).toBe(true);
    });

    it('应该支持不同的规则类型', async () => {
      const ruleTypes = ['coverage', 'complexity', 'security', 'performance', 'custom'];

      for (const type of ruleTypes) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', type }],
        });

        const result = await service.createRule({
          tenant_id: 'tenant1',
          name: `${type}-rule`,
          type,
          threshold: 50,
          operator: 'lt',
        });

        expect(result.type).toBe(type);
      }
    });
  });

  describe('listRules', () => {
    it('应该返回规则列表', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', name: 'coverage-rule', enabled: true },
          { id: 'r2', name: 'security-rule', enabled: true },
        ],
      });

      const result = await service.listRules('tenant1');

      expect(result.length).toBe(2);
    });

    it('应该只返回启用的规则', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', enabled: true }],
      });

      await service.listRules('tenant1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('enabled = true'),
        ['tenant1']
      );
    });
  });

  describe('evaluateGate', () => {
    it('应该评估质量门并返回通过结果', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          name: 'coverage',
          type: 'coverage',
          threshold: 80,
          operator: 'gte',
          blocking: true,
        }],
      });

      const result = await service.evaluateGate('run1', { coverage: 85 });

      expect(result.passed).toBe(true);
      expect(result.rules_checked).toBeGreaterThan(0);
    });

    it('应该检测规则失败', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          name: 'coverage',
          type: 'coverage',
          threshold: 80,
          operator: 'gte',
          blocking: true,
        }],
      });

      const result = await service.evaluateGate('run1', { coverage: 50 });

      expect(result.passed).toBe(false);
      expect(result.rules_failed.length).toBeGreaterThan(0);
    });

    it('应该返回失败详情', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          name: 'coverage-threshold',
          type: 'coverage',
          threshold: 80,
          operator: 'gte',
          blocking: true,
        }],
      });

      const result = await service.evaluateGate('run1', { coverage: 60 });

      expect(result.rules_failed[0].rule.name).toBe('coverage-threshold');
      expect(result.rules_failed[0].actual_value).toBe(60);
      expect(result.rules_failed[0].message).toContain('threshold');
    });

    it('应该处理空规则列表', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.evaluateGate('run1', { coverage: 85 });

      expect(result.passed).toBe(true);
      expect(result.rules_checked).toBe(0);
    });
  });

  describe('evaluateRule', () => {
    it('应该正确评估 gt 操作符', () => {
      const rule = { threshold: 80, operator: 'gt' };

      expect(service.evaluateRule(rule as any, 81)).toBe(true);
      expect(service.evaluateRule(rule as any, 80)).toBe(false);
      expect(service.evaluateRule(rule as any, 79)).toBe(false);
    });

    it('应该正确评估 lt 操作符', () => {
      const rule = { threshold: 80, operator: 'lt' };

      expect(service.evaluateRule(rule as any, 79)).toBe(true);
      expect(service.evaluateRule(rule as any, 80)).toBe(false);
      expect(service.evaluateRule(rule as any, 81)).toBe(false);
    });

    it('应该正确评估 eq 操作符', () => {
      const rule = { threshold: 80, operator: 'eq' };

      expect(service.evaluateRule(rule as any, 80)).toBe(true);
      expect(service.evaluateRule(rule as any, 81)).toBe(false);
    });

    it('应该正确评估 gte 操作符', () => {
      const rule = { threshold: 80, operator: 'gte' };

      expect(service.evaluateRule(rule as any, 81)).toBe(true);
      expect(service.evaluateRule(rule as any, 80)).toBe(true);
      expect(service.evaluateRule(rule as any, 79)).toBe(false);
    });

    it('应该正确评估 lte 操作符', () => {
      const rule = { threshold: 80, operator: 'lte' };

      expect(service.evaluateRule(rule as any, 79)).toBe(true);
      expect(service.evaluateRule(rule as any, 80)).toBe(true);
      expect(service.evaluateRule(rule as any, 81)).toBe(false);
    });

    it('应该处理未知操作符', () => {
      const rule = { threshold: 80, operator: 'unknown' };

      expect(service.evaluateRule(rule as any, 50)).toBe(true);
    });
  });

  describe('QualityGateResult', () => {
    it('应该包含完整的结果信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', type: 'coverage', threshold: 80, operator: 'gte', blocking: true },
          { id: 'r2', type: 'security', threshold: 0, operator: 'eq', blocking: true },
        ],
      });

      const result = await service.evaluateGate('run1', {
        coverage: 85,
        security: 0,
      });

      expect(result.gate_id).toBe('run1');
      expect(result.pipeline_run_id).toBe('run1');
      expect(result.checked_at).toBeDefined();
    });

    it('应该正确计算通过的规则数', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', type: 'coverage', threshold: 80, operator: 'gte', blocking: true },
          { id: 'r2', type: 'complexity', threshold: 100, operator: 'lt', blocking: true },
        ],
      });

      const result = await service.evaluateGate('run1', {
        coverage: 85,  // passes
        complexity: 150, // fails
      });

      expect(result.rules_checked).toBe(2);
      expect(result.rules_passed).toBe(1);
      expect(result.rules_failed.length).toBe(1);
    });
  });
});