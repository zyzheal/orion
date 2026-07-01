/**
 * QualityGateEnhancementService 单元测试
 */

import { QualityGateEnhancementService } from '../QualityGateEnhancementService';
import { getCurrentTenantId } from '../../../db/tenant-context-storage';

jest.mock('../../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant-001'),
}));

// Mock DatabasePool
const mockPool = {
  query: jest.fn(),
};

describe('QualityGateEnhancementService', () => {
  let service: QualityGateEnhancementService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentTenantId as jest.Mock).mockReturnValue('test-tenant-001');
    service = new QualityGateEnhancementService(mockPool as any);
  });

  describe('createRule', () => {
    it('应该创建质量门规则', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          tenant_id: 'test-tenant-001',
          name: 'coverage-threshold',
          type: 'coverage',
          threshold: 80,
          operator: 'gte',
          blocking: true,
          enabled: true,
        }],
      });

      const result = await service.createRule({
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

    it('应该使用当前租户ID', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', tenant_id: 'test-tenant-001', enabled: true }],
      });

      await service.createRule({
        name: 'rule',
        type: 'coverage',
        threshold: 80,
        operator: 'gte',
      });

      const sql = mockPool.query.mock.calls[0][0];
      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant-001');
    });

    it('应该支持不同的规则类型', async () => {
      const ruleTypes = ['coverage', 'complexity', 'security', 'performance', 'custom'];

      for (const type of ruleTypes) {
        mockPool.query.mockResolvedValue({
          rows: [{ id: 'r1', type }],
        });

        const result = await service.createRule({
          name: `${type}-rule`,
          type,
          threshold: 50,
          operator: 'lt',
        });

        expect(result.type).toBe(type);
      }
    });
  });

  describe('findById', () => {
    it('应该返回规则详情', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', name: 'coverage', tenant_id: 'test-tenant-001' }],
      });

      const result = await service.findById('r1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('r1');
    });

    it('应该支持租户过滤', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', tenant_id: 'other-tenant' }],
      });

      const result = await service.findById('r1', 'other-tenant');

      expect(result).not.toBeNull();
      const params = mockPool.query.mock.calls[0][1];
      expect(params).toContain('other-tenant');
    });

    it('找不到时应返回 null', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
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

      const result = await service.listRules();

      expect(result.length).toBe(2);
    });

    it('应该使用当前租户', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.listRules();

      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('test-tenant-001');
    });

    it('应该只返回启用的规则', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'r1', enabled: true }] });

      await service.listRules();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('enabled = true'),
        expect.any(Array)
      );
    });
  });

  describe('updateRule', () => {
    it('应该更新规则字段', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', threshold: 90, tenant_id: 'test-tenant-001' }],
      });

      const result = await service.updateRule('r1', { threshold: 90 });

      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(90);
    });

    it('找不到时应返回 null', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await service.updateRule('nonexistent', { threshold: 90 });

      expect(result).toBeNull();
    });

    it('空更新应返回原规则', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', name: 'coverage', tenant_id: 'test-tenant-001' }],
      });

      const result = await service.updateRule('r1', {});

      expect(result).not.toBeNull();
    });
  });

  describe('deleteRule', () => {
    it('应该删除规则并返回 true', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await service.deleteRule('r1');

      expect(result).toBe(true);
    });

    it('找不到时应返回 false', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.deleteRule('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('toggleRule', () => {
    it('应该切换规则启用状态', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'r1', enabled: false, tenant_id: 'test-tenant-001' }],
      });

      const result = await service.toggleRule('r1', false);

      expect(result).not.toBeNull();
      expect(result!.enabled).toBe(false);
    });
  });

  describe('evaluateGate', () => {
    it('应该评估质量门并返回通过结果', async () => {
      // First call: listRules, Second call: could be used by sub-queries
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'r1',
          name: 'coverage',
          type: 'coverage',
          threshold: 80,
          operator: 'gte',
          blocking: true,
          enabled: true,
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
          enabled: true,
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
          enabled: true,
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

    it('应该使用当前租户上下文', async () => {
      (getCurrentTenantId as jest.Mock).mockReturnValue('tenant-abc');

      mockPool.query.mockResolvedValue({ rows: [] });

      await service.evaluateGate('run1', {});

      // listRules call should use tenant-abc
      const calls = mockPool.query.mock.calls;
      const listRulesCall = calls.find((c: any[]) => c[0].includes('tenant_id'));
      expect(listRulesCall).toBeDefined();
      expect(listRulesCall![1][0]).toBe('tenant-abc');
    });
  });

  describe('evaluateRule', () => {
    it('应该正确评估 gt 操作符', () => {
      const rule = { threshold: 80, operator: 'gt' };

      expect((service as any).evaluateRule(rule, 81)).toBe(true);
      expect((service as any).evaluateRule(rule, 80)).toBe(false);
      expect((service as any).evaluateRule(rule, 79)).toBe(false);
    });

    it('应该正确评估 lt 操作符', () => {
      const rule = { threshold: 80, operator: 'lt' };

      expect((service as any).evaluateRule(rule, 79)).toBe(true);
      expect((service as any).evaluateRule(rule, 80)).toBe(false);
      expect((service as any).evaluateRule(rule, 81)).toBe(false);
    });

    it('应该正确评估 eq 操作符', () => {
      const rule = { threshold: 80, operator: 'eq' };

      expect((service as any).evaluateRule(rule, 80)).toBe(true);
      expect((service as any).evaluateRule(rule, 81)).toBe(false);
    });

    it('应该正确评估 gte 操作符', () => {
      const rule = { threshold: 80, operator: 'gte' };

      expect((service as any).evaluateRule(rule, 81)).toBe(true);
      expect((service as any).evaluateRule(rule, 80)).toBe(true);
      expect((service as any).evaluateRule(rule, 79)).toBe(false);
    });

    it('应该正确评估 lte 操作符', () => {
      const rule = { threshold: 80, operator: 'lte' };

      expect((service as any).evaluateRule(rule, 79)).toBe(true);
      expect((service as any).evaluateRule(rule, 80)).toBe(true);
      expect((service as any).evaluateRule(rule, 81)).toBe(false);
    });

    it('应该处理未知操作符', () => {
      const rule = { threshold: 80, operator: 'unknown' };

      expect((service as any).evaluateRule(rule, 50)).toBe(true);
    });
  });

  describe('QualityGateResult', () => {
    it('应该包含完整的结果信息', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', type: 'coverage', threshold: 80, operator: 'gte', blocking: true, enabled: true },
          { id: 'r2', type: 'security', threshold: 0, operator: 'eq', blocking: true, enabled: true },
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
          { id: 'r1', type: 'coverage', threshold: 80, operator: 'gte', blocking: true, enabled: true },
          { id: 'r2', type: 'complexity', threshold: 100, operator: 'lt', blocking: true, enabled: true },
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
