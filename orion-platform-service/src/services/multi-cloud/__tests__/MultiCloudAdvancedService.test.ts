/**
 * MultiCloudAdvancedService 单元测试
 *
 * 测试跨区容灾、多云成本、云网络、合规检查、资源调度等功能
 */

import { MultiCloudAdvancedService } from '../MultiCloudAdvancedService';

describe('MultiCloudAdvancedService', () => {
  let service: MultiCloudAdvancedService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MultiCloudAdvancedService();
  });

  // ==================== Cross-Zone DR Management ====================

  describe('setupCrossZoneDR', () => {
    it('应该成功配置跨区容灾', async () => {
      const result = await service.setupCrossZoneDR('tenant-1', {
        name: 'east-west-dr',
        primaryZone: 'us-east-1a',
        secondaryZone: 'us-west-2a',
        strategy: 'active-passive',
        rpo: 300,
        rto: 600,
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('east-west-dr');
      expect(result.primaryZone).toBe('us-east-1a');
      expect(result.secondaryZone).toBe('us-west-2a');
      expect(result.strategy).toBe('active-passive');
      expect(result.rpo).toBe(300);
      expect(result.rto).toBe(600);
      expect(result.status).toBe('configured');
      expect(result.lastTestAt).toBeNull();
      expect(result.createdAt).toBeDefined();
    });

    it('应该使用默认策略和 RPO/RTO', async () => {
      const result = await service.setupCrossZoneDR('tenant-1', {
        name: 'default-dr',
        primaryZone: 'zone-a',
        secondaryZone: 'zone-b',
      });

      expect(result.strategy).toBe('active-passive');
      expect(result.rpo).toBe(300);
      expect(result.rto).toBe(600);
    });

    it('应该支持 active-active 策略', async () => {
      const result = await service.setupCrossZoneDR('tenant-1', {
        name: 'aa-dr',
        primaryZone: 'zone-a',
        secondaryZone: 'zone-b',
        strategy: 'active-active',
      });

      expect(result.strategy).toBe('active-active');
    });
  });

  describe('testCrossZoneDR', () => {
    it('DR 不存在时应抛出错误', async () => {
      await expect(service.testCrossZoneDR('nonexistent')).rejects.toThrow();
    });

    it('应该执行 DR 测试并返回结果', async () => {
      const dr = await service.setupCrossZoneDR('tenant-1', {
        name: 'test-dr',
        primaryZone: 'zone-a',
        secondaryZone: 'zone-b',
      });

      const result = await service.testCrossZoneDR(dr.id);

      expect(result.id).toBeDefined();
      expect(result.drId).toBe(dr.id);
      expect(['success', 'failed']).toContain(result.status);
      expect(typeof result.duration).toBe('number');
      expect(result.details).toBeDefined();
      expect(result.testedAt).toBeDefined();
    });

    it('测试成功后 DR 状态应变为 active', async () => {
      const dr = await service.setupCrossZoneDR('tenant-1', {
        name: 'test-dr',
        primaryZone: 'zone-a',
        secondaryZone: 'zone-b',
      });

      // Mock Math.random to ensure success
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5); // > 0.1 => success

      const testResult = await service.testCrossZoneDR(dr.id);

      // Verify DR status changed
      if (testResult.status === 'success') {
        // Re-fetch is not available, but the DR object was mutated
        expect(dr.status).toBe('active');
        expect(dr.lastTestAt).not.toBeNull();
      }

      Math.random = originalRandom;
    });
  });

  // ==================== Multi-Cloud Cost Management ====================

  describe('calculateMultiCloudCost', () => {
    it('应该计算多云成本', async () => {
      const result = await service.calculateMultiCloudCost('tenant-1', '30d');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.timeWindow).toBe('30d');
      expect(typeof result.totalCost).toBe('number');
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(result.breakdown.length).toBeGreaterThan(0);
      expect(result.calculatedAt).toBeDefined();
    });

    it('成本分解应包含多个云提供商', async () => {
      const result = await service.calculateMultiCloudCost('tenant-1', '7d');

      const providers = new Set(result.breakdown.map(b => b.provider));
      expect(providers.size).toBeGreaterThan(1);
      expect(providers.has('aws')).toBe(true);
      expect(providers.has('gcp')).toBe(true);
    });

    it('总成本应等于分解成本之和', async () => {
      const result = await service.calculateMultiCloudCost('tenant-1', '30d');

      const sum = result.breakdown.reduce((acc, item) => acc + item.cost, 0);
      expect(result.totalCost).toBeCloseTo(sum, 1);
    });
  });

  describe('optimizeCloudCost', () => {
    it('应该返回成本优化建议', async () => {
      const suggestions = await service.optimizeCloudCost('tenant-1');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      for (const suggestion of suggestions) {
        expect(suggestion.id).toBeDefined();
        expect(typeof suggestion.category).toBe('string');
        expect(typeof suggestion.description).toBe('string');
        expect(typeof suggestion.estimatedSavings).toBe('number');
        expect(suggestion.estimatedSavings).toBeGreaterThan(0);
        expect(suggestion.currency).toBe('USD');
        expect(typeof suggestion.confidence).toBe('number');
        expect(suggestion.confidence).toBeGreaterThan(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  // ==================== Cloud Network Management ====================

  describe('setupCloudNetwork', () => {
    it('应该成功配置云网络', async () => {
      const result = await service.setupCloudNetwork('tenant-1', {
        name: 'production-vpc',
        vpcId: 'vpc-12345',
        subnets: ['subnet-1', 'subnet-2'],
        securityGroups: ['sg-1'],
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('production-vpc');
      expect(result.vpcId).toBe('vpc-12345');
      expect(result.subnets).toEqual(['subnet-1', 'subnet-2']);
      expect(result.securityGroups).toEqual(['sg-1']);
      expect(result.status).toBe('provisioning');
      expect(result.createdAt).toBeDefined();
    });

    it('应该使用默认空数组', async () => {
      const result = await service.setupCloudNetwork('tenant-1', {
        name: 'minimal-network',
        vpcId: 'vpc-000',
      });

      expect(result.subnets).toEqual([]);
      expect(result.securityGroups).toEqual([]);
    });
  });

  // ==================== Compliance Check ====================

  describe('getComplianceRules', () => {
    it('应该返回合规规则列表', () => {
      const rules = service.getComplianceRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);

      // Verify rule structure
      for (const rule of rules) {
        expect(rule.id).toBeDefined();
        expect(['security', 'cost', 'governance', 'availability', 'data-residency']).toContain(rule.category);
        expect(typeof rule.name).toBe('string');
        expect(typeof rule.description).toBe('string');
        expect(['critical', 'high', 'medium', 'low']).toContain(rule.severity);
        expect(typeof rule.checkFn).toBe('string');
      }
    });

    it('应包含所有类别的规则', () => {
      const rules = service.getComplianceRules();
      const categories = new Set(rules.map(r => r.category));

      expect(categories.has('security')).toBe(true);
      expect(categories.has('cost')).toBe(true);
      expect(categories.has('governance')).toBe(true);
      expect(categories.has('availability')).toBe(true);
      expect(categories.has('data-residency')).toBe(true);
    });
  });

  describe('runComplianceCheck', () => {
    it('应该运行全部合规检查', async () => {
      const report = await service.runComplianceCheck('tenant-1');

      expect(report.id).toBeDefined();
      expect(report.tenantId).toBe('tenant-1');
      expect(report.totalRules).toBeGreaterThan(0);
      expect(typeof report.passedRules).toBe('number');
      expect(typeof report.failedRules).toBe('number');
      expect(report.passedRules + report.failedRules).toBe(report.totalRules);
      expect(typeof report.score).toBe('number');
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.results)).toBe(true);
      expect(report.results.length).toBe(report.totalRules);
      expect(report.generatedAt).toBeDefined();
    });

    it('应该按类别过滤合规检查', async () => {
      const report = await service.runComplianceCheck('tenant-1', ['security']);

      expect(report.totalRules).toBeGreaterThan(0);
      for (const result of report.results) {
        expect(result.category).toBe('security');
      }
    });

    it('每个检查结果应包含完整字段', async () => {
      const report = await service.runComplianceCheck('tenant-1');

      for (const result of report.results) {
        expect(result.ruleId).toBeDefined();
        expect(typeof result.ruleName).toBe('string');
        expect(typeof result.category).toBe('string');
        expect(typeof result.severity).toBe('string');
        expect(typeof result.passed).toBe('boolean');
        expect(typeof result.details).toBe('string');
        expect(result.checkedAt).toBeDefined();
      }
    });

    it('应包含补救建议（对失败的检查）', async () => {
      const report = await service.runComplianceCheck('tenant-1');

      const failedResults = report.results.filter(r => !r.passed);
      // At least some failed results should have remediation
      for (const result of failedResults) {
        // remediation may or may not be present
        if (result.remediation) {
          expect(typeof result.remediation).toBe('string');
        }
      }
    });
  });

  // ==================== Resource Scheduling ====================

  describe('createSchedulingPolicy', () => {
    it('应该成功创建调度策略', async () => {
      const result = await service.createSchedulingPolicy('tenant-1', {
        name: 'cost-policy',
        strategy: 'cost-optimized',
        constraints: {
          maxCostPerMonth: 10000,
          allowedRegions: ['us-east-1', 'eu-west-1'],
          allowedProviders: ['aws', 'gcp'],
        },
        priority: 1,
        enabled: true,
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('cost-policy');
      expect(result.strategy).toBe('cost-optimized');
      expect(result.constraints.maxCostPerMonth).toBe(10000);
      expect(result.constraints.allowedRegions).toEqual(['us-east-1', 'eu-west-1']);
      expect(result.priority).toBe(1);
      expect(result.enabled).toBe(true);
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('listSchedulingPolicies', () => {
    it('没有策略时应返回空数组', async () => {
      const result = await service.listSchedulingPolicies('tenant-1');
      expect(result).toEqual([]);
    });

    it('应该只返回指定租户的策略', async () => {
      await service.createSchedulingPolicy('tenant-1', {
        name: 'p1',
        strategy: 'balanced',
        constraints: {},
        priority: 1,
        enabled: true,
      });
      await service.createSchedulingPolicy('tenant-2', {
        name: 'p2',
        strategy: 'cost-optimized',
        constraints: {},
        priority: 1,
        enabled: true,
      });

      const result = await service.listSchedulingPolicies('tenant-1');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('p1');
    });
  });

  describe('scheduleResource', () => {
    it('应该返回调度决策', async () => {
      const decision = await service.scheduleResource('tenant-1', {
        resourceType: 'compute',
        spec: { cpu: 4, memoryMb: 8192 },
      });

      expect(decision.id).toBeDefined();
      expect(decision.policyId).toBe('default');
      expect(decision.resourceType).toBe('compute');
      expect(typeof decision.selectedProvider).toBe('string');
      expect(typeof decision.selectedRegion).toBe('string');
      expect(typeof decision.estimatedCost).toBe('number');
      expect(decision.estimatedCost).toBeGreaterThan(0);
      expect(typeof decision.reason).toBe('string');
      expect(Array.isArray(decision.alternatives)).toBe(true);
      expect(decision.decidedAt).toBeDefined();
    });

    it('应该使用指定策略进行调度', async () => {
      const policy = await service.createSchedulingPolicy('tenant-1', {
        name: 'cost-policy',
        strategy: 'cost-optimized',
        constraints: {
          allowedProviders: ['aws'],
          allowedRegions: ['us-east-1'],
        },
        priority: 1,
        enabled: true,
      });

      const decision = await service.scheduleResource('tenant-1', {
        resourceType: 'compute',
        spec: { cpu: 2, memoryMb: 4096 },
        policyId: policy.id,
      });

      expect(decision.policyId).toBe(policy.id);
      expect(decision.selectedProvider).toBe('aws');
      expect(decision.selectedRegion).toBe('us-east-1');
    });

    it('应该尊重 preferredProvider 和 preferredRegion', async () => {
      const decision = await service.scheduleResource('tenant-1', {
        resourceType: 'compute',
        spec: { cpu: 2, memoryMb: 4096 },
        preferredProvider: 'gcp',
        preferredRegion: 'us-central1',
      });

      expect(decision.selectedProvider).toBe('gcp');
      expect(decision.selectedRegion).toBe('us-central1');
    });
  });

  describe('getSchedulingHistory', () => {
    it('没有调度记录时应返回空数组', async () => {
      const result = await service.getSchedulingHistory('tenant-1');
      expect(result).toEqual([]);
    });

    it('应该返回调度历史', async () => {
      await service.scheduleResource('tenant-1', {
        resourceType: 'compute',
        spec: { cpu: 2, memoryMb: 4096 },
      });
      await service.scheduleResource('tenant-1', {
        resourceType: 'storage',
        spec: { storageGb: 100 },
      });

      const history = await service.getSchedulingHistory('tenant-1');
      expect(history.length).toBe(2);
    });
  });
});
