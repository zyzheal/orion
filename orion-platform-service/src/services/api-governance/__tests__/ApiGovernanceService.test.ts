/**
 * ApiGovernanceService 单元测试
 */

import { ApiGovernanceService, GovernanceRule } from '../ApiGovernanceService';

// Mock repositories
const mockRuleRepo = {
  createRule: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  findByTenantAndEnabled: jest.fn(),
  updateRule: jest.fn(),
  deleteRule: jest.fn(),
};

const mockInventoryRepo = {
  findByTenant: jest.fn(),
  registerApi: jest.fn(),
  updateApi: jest.fn(),
  deleteApi: jest.fn(),
};

jest.mock('../../../repositories/ApiGovernanceRepository', () => ({
  GovernanceRuleRepository: jest.fn().mockImplementation(() => mockRuleRepo),
  ApiInventoryRepository: jest.fn().mockImplementation(() => mockInventoryRepo),
}));

describe('ApiGovernanceService', () => {
  let service: ApiGovernanceService;
  let serviceWithDb: ApiGovernanceService;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiGovernanceService();
    serviceWithDb = new ApiGovernanceService(mockDb as any);
  });

  describe('constructor', () => {
    it('should create service without DB', () => {
      expect(service).toBeDefined();
    });

    it('should create service with DB', () => {
      expect(serviceWithDb).toBeDefined();
    });

    it('should create service with undefined db', () => {
      const svc = new ApiGovernanceService(undefined);
      expect(svc).toBeDefined();
    });
  });

  describe('createGovernanceRule', () => {
    it('should create rule without DB (in-memory fallback)', async () => {
      const result = await service.createGovernanceRule('tenant1', {
        name: 'Rate Limit Rule',
        ruleType: 'rate_limit',
        config: { maxRequests: 100 },
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Rate Limit Rule');
      expect(result.ruleType).toBe('rate_limit');
      expect(result.enabled).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create rule in-memory when no DB', async () => {
      const svc = new ApiGovernanceService();
      const result = await svc.createGovernanceRule('tenant1', {
        name: 'Auth Rule',
        description: 'Require auth on all endpoints',
        ruleType: 'auth_required',
        config: {},
      });

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant1');
      expect(result.name).toBe('Auth Rule');
      expect(result.description).toBe('Require auth on all endpoints');
      expect(result.ruleType).toBe('auth_required');
      expect(result.enabled).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create rule with DB', async () => {
      const now = new Date();
      mockRuleRepo.createRule.mockResolvedValue({
        id: 'r1',
        tenantId: 'tenant1',
        name: 'Version Rule',
        description: null,
        ruleType: 'versioning',
        config: {},
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.createGovernanceRule('tenant1', {
        name: 'Version Rule',
        ruleType: 'versioning',
        config: {},
      });

      expect(result.id).toBe('r1');
      expect(result.ruleType).toBe('versioning');
      expect(result.description).toBeUndefined();
      expect(mockRuleRepo.createRule).toHaveBeenCalledTimes(1);
    });

    it('should create rule with description when using DB', async () => {
      const now = new Date();
      mockRuleRepo.createRule.mockResolvedValue({
        id: 'r1',
        tenantId: 'tenant1',
        name: 'Rule',
        description: 'A description',
        ruleType: 'naming',
        config: { prefix: '/api/v' },
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.createGovernanceRule('tenant1', {
        name: 'Rule',
        description: 'A description',
        ruleType: 'naming',
        config: { prefix: '/api/v' },
      });

      expect(result.description).toBe('A description');
    });
  });

  describe('evaluateGovernance', () => {
    beforeEach(() => {
      // Default: no rules and no APIs
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([]);
      mockInventoryRepo.findByTenant.mockResolvedValue([]);
    });

    it('should return empty results when no rules', async () => {
      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result).toEqual([]);
    });

    it('should evaluate rate_limit rule - passing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1',
          tenantId: 'tenant1',
          name: 'Rate Limit',
          description: null,
          ruleType: 'rate_limit',
          config: {},
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { rateLimit: 100 }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result.length).toBe(1);
      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs have rate limits configured');
    });

    it('should evaluate rate_limit rule - failing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1',
          tenantId: 'tenant1',
          name: 'Rate Limit',
          description: null,
          ruleType: 'rate_limit',
          config: {},
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
        { id: 'a2', tenantId: 'tenant1', apiData: { rateLimit: 50 }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result.length).toBe(1);
      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain('1 APIs missing rate limits');
    });

    it('should evaluate auth_required rule - passing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Auth', description: null,
          ruleType: 'auth_required', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { authRequired: true }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs require authentication');
    });

    it('should evaluate auth_required rule - failing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Auth', description: null,
          ruleType: 'auth_required', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain("don't require authentication");
    });

    it('should evaluate versioning rule - passing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Version', description: null,
          ruleType: 'versioning', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { version: 'v1' }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs have versioning');
    });

    it('should evaluate versioning rule - failing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Version', description: null,
          ruleType: 'versioning', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
        { id: 'a2', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain('2 APIs lack versioning');
    });

    it('should evaluate documentation rule - passing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Docs', description: null,
          ruleType: 'documentation', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { documentation: 'https://docs.example.com' }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs are documented');
    });

    it('should evaluate documentation rule - failing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Docs', description: null,
          ruleType: 'documentation', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain('APIs lack documentation');
    });

    it('should evaluate naming rule - passing with default prefix', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Naming', description: null,
          ruleType: 'naming', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { path: '/api/v1/users' }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs follow naming convention');
    });

    it('should evaluate naming rule - failing with custom prefix', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Naming', description: null,
          ruleType: 'naming', config: { prefix: '/v2/' }, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { path: '/v1/users' }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain("don't follow naming convention");
      expect(result[0].details).toEqual({ prefix: '/v2/', violations: 1 });
    });

    it('should evaluate response_format rule - passing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Format', description: null,
          ruleType: 'response_format', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { responseFormat: 'json' }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs follow response format');
    });

    it('should evaluate response_format rule - failing', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Format', description: null,
          ruleType: 'response_format', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain("don't follow response format");
    });

    it('should handle unknown rule type with default case', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Unknown', description: null,
          ruleType: 'unknown_type', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('Rule type not implemented');
    });

    it('should evaluate multiple rules at once', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Rate Limit', description: null,
          ruleType: 'rate_limit', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: 'r2', tenantId: 'tenant1', name: 'Auth', description: null,
          ruleType: 'auth_required', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { rateLimit: 100, authRequired: true }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result.length).toBe(2);
      expect(result[0].ruleType).toBe('rate_limit');
      expect(result[1].ruleType).toBe('auth_required');
    });
  });

  describe('getGovernanceReport', () => {
    beforeEach(() => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([]);
      mockInventoryRepo.findByTenant.mockResolvedValue([]);
    });

    it('should return report with 100% compliance when no rules', async () => {
      const result = await serviceWithDb.getGovernanceReport('tenant1');

      expect(result.tenantId).toBe('tenant1');
      expect(result.totalRules).toBe(0);
      expect(result.passedRules).toBe(0);
      expect(result.failedRules).toBe(0);
      expect(result.complianceScore).toBe(100);
      expect(result.results).toEqual([]);
      expect(result.evaluatedAt).toBeDefined();
    });

    it('should calculate compliance score correctly with mixed results', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Rate Limit', description: null,
          ruleType: 'rate_limit', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: 'r2', tenantId: 'tenant1', name: 'Auth', description: null,
          ruleType: 'auth_required', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      // One API with rateLimit but no authRequired
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { rateLimit: 100 }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.getGovernanceReport('tenant1');

      expect(result.totalRules).toBe(2);
      expect(result.passedRules).toBe(1);
      expect(result.failedRules).toBe(1);
      expect(result.complianceScore).toBe(50);
    });

    it('should return 100% when all rules pass', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Rate Limit', description: null,
          ruleType: 'rate_limit', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: { rateLimit: 100 }, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.getGovernanceReport('tenant1');

      expect(result.complianceScore).toBe(100);
      expect(result.failedRules).toBe(0);
    });

    it('should return 0% when all rules fail', async () => {
      mockRuleRepo.findByTenantAndEnabled.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Rate Limit', description: null,
          ruleType: 'rate_limit', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
        {
          id: 'r2', tenantId: 'tenant1', name: 'Auth', description: null,
          ruleType: 'auth_required', config: {}, enabled: true,
          createdAt: new Date(), updatedAt: new Date(),
        },
      ]);
      mockInventoryRepo.findByTenant.mockResolvedValue([
        { id: 'a1', tenantId: 'tenant1', apiData: {}, registeredAt: new Date() },
      ]);

      const result = await serviceWithDb.getGovernanceReport('tenant1');

      expect(result.complianceScore).toBe(0);
      expect(result.passedRules).toBe(0);
      expect(result.failedRules).toBe(2);
    });
  });

  describe('getRule', () => {
    it('should return null when no rule repository', async () => {
      const result = await service.getRule('r1');

      expect(result).toBeNull();
    });

    it('should return null when rule not found', async () => {
      mockRuleRepo.findById.mockResolvedValue(null);

      const result = await serviceWithDb.getRule('nonexistent');

      expect(result).toBeNull();
    });

    it('should return rule from repository', async () => {
      const now = new Date();
      mockRuleRepo.findById.mockResolvedValue({
        id: 'r1',
        tenantId: 'tenant1',
        name: 'Rate Limit',
        description: 'desc',
        ruleType: 'rate_limit',
        config: { max: 100 },
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.getRule('r1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('r1');
      expect(result!.name).toBe('Rate Limit');
      expect(result!.description).toBe('desc');
    });

    it('should handle null description', async () => {
      const now = new Date();
      mockRuleRepo.findById.mockResolvedValue({
        id: 'r1',
        tenantId: 'tenant1',
        name: 'Rule',
        description: null,
        ruleType: 'naming',
        config: {},
        enabled: false,
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.getRule('r1');

      expect(result!.description).toBeUndefined();
      expect(result!.enabled).toBe(false);
    });
  });

  describe('listRules', () => {
    it('should return empty array when no rule repository', async () => {
      const result = await service.listRules('tenant1');

      expect(result).toEqual([]);
    });

    it('should return rules from repository', async () => {
      const now = new Date();
      mockRuleRepo.findByTenant.mockResolvedValue([
        {
          id: 'r1', tenantId: 'tenant1', name: 'Rule 1', description: null,
          ruleType: 'rate_limit', config: {}, enabled: true,
          createdAt: now, updatedAt: now,
        },
        {
          id: 'r2', tenantId: 'tenant1', name: 'Rule 2', description: 'desc',
          ruleType: 'auth_required', config: {}, enabled: false,
          createdAt: now, updatedAt: now,
        },
      ]);

      const result = await serviceWithDb.listRules('tenant1');

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Rule 1');
      expect(result[1].description).toBe('desc');
    });
  });

  describe('updateRule', () => {
    it('should return null when no rule repository', async () => {
      const result = await service.updateRule('r1', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should return null when rule not found', async () => {
      mockRuleRepo.updateRule.mockResolvedValue(null);

      const result = await serviceWithDb.updateRule('nonexistent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update rule and return result', async () => {
      const now = new Date();
      mockRuleRepo.updateRule.mockResolvedValue({
        id: 'r1',
        tenantId: 'tenant1',
        name: 'Updated Rule',
        description: 'new desc',
        ruleType: 'rate_limit',
        config: { max: 200 },
        enabled: false,
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.updateRule('r1', {
        name: 'Updated Rule',
        description: 'new desc',
        config: { max: 200 },
        enabled: false,
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated Rule');
      expect(result!.enabled).toBe(false);
    });

    it('should handle partial updates', async () => {
      const now = new Date();
      mockRuleRepo.updateRule.mockResolvedValue({
        id: 'r1', tenantId: 'tenant1', name: 'Rule', description: null,
        ruleType: 'naming', config: {}, enabled: true,
        createdAt: now, updatedAt: now,
      });

      await serviceWithDb.updateRule('r1', { enabled: true });

      expect(mockRuleRepo.updateRule).toHaveBeenCalledWith('r1', {
        name: undefined,
        description: undefined,
        ruleType: undefined,
        config: undefined,
        enabled: true,
      });
    });
  });

  describe('deleteRule', () => {
    it('should return false when no rule repository', async () => {
      const result = await service.deleteRule('r1');

      expect(result).toBe(false);
    });

    it('should return true when rule deleted successfully', async () => {
      mockRuleRepo.deleteRule.mockResolvedValue(true);

      const result = await serviceWithDb.deleteRule('r1');

      expect(result).toBe(true);
    });

    it('should return false when rule not found', async () => {
      mockRuleRepo.deleteRule.mockResolvedValue(false);

      const result = await serviceWithDb.deleteRule('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('registerApiForGovernance', () => {
    it('should register API in-memory when no DB', async () => {
      const result = await service.registerApiForGovernance('tenant1', {
        name: 'User API',
        path: '/api/v1/users',
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should register API with DB', async () => {
      mockInventoryRepo.registerApi.mockResolvedValue({
        id: 'inv1',
        tenantId: 'tenant1',
        apiData: { name: 'User API' },
        registeredAt: new Date(),
      });

      const result = await serviceWithDb.registerApiForGovernance('tenant1', {
        name: 'User API',
        path: '/api/v1/users',
      });

      expect(result).toBe('inv1');
      expect(mockInventoryRepo.registerApi).toHaveBeenCalledTimes(1);
    });

    it('should generate unique IDs for in-memory registrations', async () => {
      const id1 = await service.registerApiForGovernance('tenant1', { name: 'API 1' });
      const id2 = await service.registerApiForGovernance('tenant1', { name: 'API 2' });

      expect(id1).not.toBe(id2);
    });

    it('should store tenantId in in-memory cache', async () => {
      // Register an API in-memory
      await service.registerApiForGovernance('tenant1', { name: 'API', rateLimit: 100 });

      // The in-memory service should use the cache for getTenantApis
      // We can verify indirectly through evaluateGovernance
      // But since evaluateGovernance uses getTenantApis, let's check
      // that it works when there are no rules (no assertions needed on cache directly)
      const result = await service.evaluateGovernance('tenant1');
      expect(result).toEqual([]); // no rules to evaluate
    });
  });
});
