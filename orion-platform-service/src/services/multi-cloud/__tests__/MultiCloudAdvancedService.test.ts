/**
 * MultiCloudAdvancedService 单元测试
 *
 * 测试跨区容灾、多云成本、云网络、合规检查、资源调度等功能
 * 使用 jest.mock 模拟 MultiCloudRepository
 */

import { MultiCloudAdvancedService } from '../MultiCloudAdvancedService';

// ===================================================================
// Mock repository — all methods called by MultiCloudAdvancedService
// ===================================================================

const mockCreateCrossZoneDR = jest.fn();
const mockFindCrossZoneDRById = jest.fn();
const mockUpdateCrossZoneDRStatus = jest.fn();
const mockCreateDRTestResult = jest.fn();
const mockCreateCloudNetwork = jest.fn();
const mockCreateSchedulingPolicy = jest.fn();
const mockFindSchedulingPoliciesByTenant = jest.fn();
const mockFindSchedulingPolicyById = jest.fn();
const mockCreateSchedulingDecision = jest.fn();
const mockFindSchedulingDecisionsByPolicyId = jest.fn();

const mockMultiCloudRepository = {
  createCrossZoneDR: mockCreateCrossZoneDR,
  findCrossZoneDRById: mockFindCrossZoneDRById,
  updateCrossZoneDRStatus: mockUpdateCrossZoneDRStatus,
  createDRTestResult: mockCreateDRTestResult,
  createCloudNetwork: mockCreateCloudNetwork,
  createSchedulingPolicy: mockCreateSchedulingPolicy,
  findSchedulingPoliciesByTenant: mockFindSchedulingPoliciesByTenant,
  findSchedulingPolicyById: mockFindSchedulingPolicyById,
  createSchedulingDecision: mockCreateSchedulingDecision,
  findSchedulingDecisionsByPolicyId: mockFindSchedulingDecisionsByPolicyId,
};

jest.mock('../../../repositories/MultiCloudRepository', () => ({
  MultiCloudRepository: jest.fn().mockImplementation(() => mockMultiCloudRepository),
}));

// ===================================================================
// Helper to produce a minimal mock database pool
// ===================================================================

function createMockDb() {
  return { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

describe('MultiCloudAdvancedService', () => {
  let service: MultiCloudAdvancedService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MultiCloudAdvancedService(createMockDb());
  });

  // ==================== Constructor ====================

  describe('constructor', () => {
    it('应该在未提供 database 时抛出错误', () => {
      expect(() => new MultiCloudAdvancedService(undefined as any)).toThrow('DatabasePool is required');
    });
  });

  // ==================== Cross-Zone DR Management ====================

  describe('setupCrossZoneDR', () => {
    it('应该成功配置跨区容灾并调用 repository', async () => {
      mockCreateCrossZoneDR.mockResolvedValue(undefined);

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

      expect(mockCreateCrossZoneDR).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          name: 'east-west-dr',
          primary_zone: 'us-east-1a',
          secondary_zone: 'us-west-2a',
          strategy: 'active-passive',
          rpo: 300,
          rto: 600,
          status: 'configured',
          last_test_at: null,
        }),
      );
    });

    it('应该使用默认策略和 RPO/RTO', async () => {
      mockCreateCrossZoneDR.mockResolvedValue(undefined);

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
      mockCreateCrossZoneDR.mockResolvedValue(undefined);

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
      mockFindCrossZoneDRById.mockResolvedValue(undefined);

      await expect(service.testCrossZoneDR('nonexistent')).rejects.toThrow('Cross-zone DR not found');
    });

    it('应该执行 DR 测试并返回结果', async () => {
      const mockDr = {
        id: 'dr-1',
        tenant_id: 'tenant-1',
        name: 'test-dr',
        primary_zone: 'zone-a',
        secondary_zone: 'zone-b',
        strategy: 'active-passive',
        rpo: 300,
        rto: 600,
        status: 'configured' as const,
        last_test_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockFindCrossZoneDRById.mockResolvedValue(mockDr);
      mockCreateDRTestResult.mockResolvedValue({ id: 'test-1' });

      const result = await service.testCrossZoneDR('dr-1');

      expect(result.id).toBeDefined();
      expect(result.drId).toBe('dr-1');
      expect(['success', 'failed']).toContain(result.status);
      expect(typeof result.duration).toBe('number');
      expect(result.details).toBeDefined();
      expect(result.testedAt).toBeDefined();

      // Verify repository was called in sequence
      expect(mockFindCrossZoneDRById).toHaveBeenCalledWith('dr-1');
      expect(mockUpdateCrossZoneDRStatus).toHaveBeenNthCalledWith(1, 'dr-1', 'testing');
      expect(mockCreateDRTestResult).toHaveBeenCalledWith(
        expect.objectContaining({ dr_id: 'dr-1' }),
      );
      expect(mockUpdateCrossZoneDRStatus).toHaveBeenLastCalledWith('dr-1', expect.any(String), expect.any(Date));
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
    it('应该成功配置云网络并调用 repository', async () => {
      mockCreateCloudNetwork.mockResolvedValue(undefined);

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

      expect(mockCreateCloudNetwork).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          name: 'production-vpc',
          vpc_id: 'vpc-12345',
          subnets: ['subnet-1', 'subnet-2'],
          security_groups: ['sg-1'],
          status: 'provisioning',
        }),
      );
    });

    it('应该使用默认空数组', async () => {
      mockCreateCloudNetwork.mockResolvedValue(undefined);

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
      for (const result of failedResults) {
        if (result.remediation) {
          expect(typeof result.remediation).toBe('string');
        }
      }
    });
  });

  // ==================== Resource Scheduling ====================

  describe('createSchedulingPolicy', () => {
    it('应该成功创建调度策略并调用 repository', async () => {
      mockCreateSchedulingPolicy.mockResolvedValue(undefined);

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

      expect(mockCreateSchedulingPolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-1',
          name: 'cost-policy',
          strategy: 'cost-optimized',
          constraints: expect.objectContaining({
            maxCostPerMonth: 10000,
          }),
          priority: 1,
          enabled: true,
        }),
      );
    });
  });

  describe('listSchedulingPolicies', () => {
    it('没有策略时应返回空数组', async () => {
      mockFindSchedulingPoliciesByTenant.mockResolvedValue([]);

      const result = await service.listSchedulingPolicies('tenant-1');
      expect(result).toEqual([]);
    });

    it('应该从 repository 读取策略并转换', async () => {
      mockFindSchedulingPoliciesByTenant.mockResolvedValue([
        {
          id: 'pol-1',
          tenant_id: 'tenant-1',
          name: 'p1',
          strategy: 'balanced',
          constraints: { maxCostPerMonth: 5000 },
          priority: 1,
          enabled: true,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-01'),
        },
      ]);

      const result = await service.listSchedulingPolicies('tenant-1');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('pol-1');
      expect(result[0].name).toBe('p1');
    });
  });

  describe('scheduleResource', () => {
    it('应该返回调度决策并调用 repository', async () => {
      mockFindSchedulingPolicyById.mockResolvedValue(undefined); // no policy, use defaults
      mockCreateSchedulingDecision.mockResolvedValue(undefined);

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

      expect(mockCreateSchedulingDecision).toHaveBeenCalled();
    });

    it('应该使用指定策略进行调度', async () => {
      const mockPolicyEntity = {
        id: 'pol-cost',
        tenant_id: 'tenant-1',
        name: 'cost-policy',
        strategy: 'cost-optimized',
        constraints: {
          allowedProviders: ['aws'],
          allowedRegions: ['us-east-1'],
        },
        priority: 1,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockFindSchedulingPolicyById.mockResolvedValue(mockPolicyEntity);
      mockCreateSchedulingDecision.mockResolvedValue(undefined);

      const decision = await service.scheduleResource('tenant-1', {
        resourceType: 'compute',
        spec: { cpu: 2, memoryMb: 4096 },
        policyId: 'pol-cost',
      });

      expect(decision.policyId).toBe('pol-cost');
      expect(decision.selectedProvider).toBe('aws');
      expect(decision.selectedRegion).toBe('us-east-1');
    });

    it('应该尊重 preferredProvider 和 preferredRegion', async () => {
      mockFindSchedulingPolicyById.mockResolvedValue(undefined);
      mockCreateSchedulingDecision.mockResolvedValue(undefined);

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
      mockFindSchedulingPoliciesByTenant.mockResolvedValue([]);

      const result = await service.getSchedulingHistory('tenant-1');
      expect(result).toEqual([]);
    });

    it('应该从 repository 读取策略和决策', async () => {
      const mockPolicy = {
        id: 'pol-1',
        tenant_id: 'tenant-1',
        name: 'test-policy',
        strategy: 'balanced',
        constraints: {},
        priority: 1,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const mockDecision = {
        id: 'sched-1',
        policy_id: 'pol-1',
        resource_type: 'compute',
        selected_provider: 'aws',
        selected_region: 'us-east-1',
        estimated_cost: 100,
        reason: 'test',
        alternatives: [{ provider: 'gcp', region: 'us-central1', cost: 92 }],
        decided_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFindSchedulingPoliciesByTenant.mockResolvedValue([mockPolicy]);
      mockFindSchedulingDecisionsByPolicyId.mockResolvedValue([mockDecision]);

      const history = await service.getSchedulingHistory('tenant-1');
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('sched-1');
      expect(history[0].resourceType).toBe('compute');
    });
  });
});
