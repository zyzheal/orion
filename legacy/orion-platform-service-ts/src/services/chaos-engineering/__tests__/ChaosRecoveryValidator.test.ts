/**
 * ChaosRecoveryValidator 单元测试
 */

import { ChaosRecoveryValidator, RecoveryCheck } from '../ChaosRecoveryValidator';

describe('ChaosRecoveryValidator', () => {
  let validator: ChaosRecoveryValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new ChaosRecoveryValidator();
  });

  describe('validateRecovery', () => {
    it('应该返回恢复验证结果', async () => {
      const result = await validator.validateRecovery('exp-1');

      expect(result.experimentId).toBe('exp-1');
      expect(result.checks).toBeDefined();
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('应该包含所有健康检查项', async () => {
      const result = await validator.validateRecovery('exp-1');

      expect(result.checks.length).toBe(3);
      const checkTypes = result.checks.map(c => c.checkType);
      expect(checkTypes).toContain('service_availability');
      expect(checkTypes).toContain('resource_utilization');
      expect(checkTypes).toContain('error_rate');
    });

    it('所有检查通过时应返回 recovered 状态', async () => {
      const result = await validator.validateRecovery('exp-1');

      expect(result.overallStatus).toBe('recovered');
    });

    it('每个检查项应有正确的结构', async () => {
      const result = await validator.validateRecovery('exp-1');

      for (const check of result.checks) {
        expect(check).toHaveProperty('checkType');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('details');
        expect(check).toHaveProperty('timestamp');
        expect(['passed', 'failed', 'timeout']).toContain(check.status);
      }
    });

    it('应该包含有效的 ISO 时间戳', async () => {
      const result = await validator.validateRecovery('exp-1');

      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('checkSystemHealth', () => {
    it('应该返回服务健康检查结果', async () => {
      const result = await validator.checkSystemHealth('service-a');

      expect(result.checkType).toBe('service_health');
      expect(result.status).toBe('passed');
      expect(result.details).toContain('service-a');
      expect(result.details).toContain('responding normally');
    });

    it('应该包含有效的时间戳', async () => {
      const result = await validator.checkSystemHealth('service-b');

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('应该对不同目标返回正确的详情', async () => {
      const result1 = await validator.checkSystemHealth('pod-1');
      const result2 = await validator.checkSystemHealth('pod-2');

      expect(result1.details).toContain('pod-1');
      expect(result2.details).toContain('pod-2');
    });
  });

  describe('generateRecoveryReport', () => {
    it('应该生成恢复报告', async () => {
      const report = await validator.generateRecoveryReport('exp-1');

      expect(report.experimentId).toBe('exp-1');
      expect(report.reportType).toBe('recovery');
      expect(report.status).toBeDefined();
      expect(report.checks).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it('报告状态应与验证结果一致', async () => {
      const validation = await validator.validateRecovery('exp-1');
      const report = await validator.generateRecoveryReport('exp-1');

      expect(report.status).toBe(validation.overallStatus);
    });

    it('报告应包含所有检查项', async () => {
      const report = await validator.generateRecoveryReport('exp-1');

      expect(report.checks.length).toBe(3);
    });

    it('应该对不同实验 ID 生成独立报告', async () => {
      const report1 = await validator.generateRecoveryReport('exp-1');
      const report2 = await validator.generateRecoveryReport('exp-2');

      expect(report1.experimentId).toBe('exp-1');
      expect(report2.experimentId).toBe('exp-2');
    });
  });
});
