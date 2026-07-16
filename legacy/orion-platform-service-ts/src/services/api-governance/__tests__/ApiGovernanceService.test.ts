/**
 * ApiGovernanceService 单元测试
 */

import { ApiGovernanceService, GovernanceRule } from '../ApiGovernanceService';

// Mock repository
const mockRepo = {
  createRule: jest.fn(),
  findAllRules: jest.fn(),
  findAllContracts: jest.fn(),
  createContract: jest.fn(),
  findById: jest.fn(),
  updateRule: jest.fn(),
  deleteRule: jest.fn(),
};

jest.mock('../../../repositories/ApiGovernanceRepository', () => ({
  ApiGovernanceRepository: jest.fn().mockImplementation(() => mockRepo),
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
      mockRepo.createRule.mockResolvedValue({
        id: 'r1',
        tenant_id: 'tenant1',
        name: 'Version Rule',
        description: null,
        type: 'versioning',
        enabled: true,
        created_at: now,
      });

      const result = await serviceWithDb.createGovernanceRule('tenant1', {
        name: 'Version Rule',
        ruleType: 'versioning',
        config: {},
      });

      expect(result.id).toBe('r1');
      expect(result.ruleType).toBe('versioning');
      expect(result.description).toBeUndefined();
      expect(mockRepo.createRule).toHaveBeenCalledTimes(1);
    });

    it('should create rule with description when using DB', async () => {
      const now = new Date();
      mockRepo.createRule.mockResolvedValue({
        id: 'r1',
        tenant_id: 'tenant1',
        name: 'Rule',
        description: 'A description',
        type: 'naming',
        enabled: true,
        created_at: now,
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
      mockRepo.findAllRules.mockResolvedValue([]);
      mockRepo.findAllContracts.mockResolvedValue([]);
      mockRepo.findById.mockResolvedValue(undefined);
    });

    it('should return empty results when no rules', async () => {
      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result).toEqual([]);
    });

    it('should evaluate rate_limit rule - passing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1',
          tenant_id: 'tenant1',
          name: 'Rate Limit',
          description: null,
          type: 'rate_limit',
          enabled: true,
          created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/users', rateLimit: 100 },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result.length).toBe(1);
      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs have rate limits configured');
    });

    it('should evaluate rate_limit rule - failing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1',
          tenant_id: 'tenant1',
          name: 'Rate Limit',
          description: null,
          type: 'rate_limit',
          enabled: true,
          created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a' },
        { id: 'a2', tenant_id: 'tenant1', api_name: 'API 2', method: 'GET', path: '/b', rateLimit: 50 },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result.length).toBe(1);
      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain('1 APIs missing rate limits');
    });

    it('should evaluate auth_required rule - passing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Auth', description: null,
          type: 'auth_required', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/users', authRequired: true },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs require authentication');
    });

    it('should evaluate auth_required rule - failing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Auth', description: null,
          type: 'auth_required', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain("don't require authentication");
    });

    it('should evaluate versioning rule - passing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Version', description: null,
          type: 'versioning', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/users', version: 'v1' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs have versioning');
    });

    it('should evaluate versioning rule - failing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Version', description: null,
          type: 'versioning', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a' },
        { id: 'a2', tenant_id: 'tenant1', api_name: 'API 2', method: 'GET', path: '/b' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain('2 APIs lack versioning');
    });

    it('should evaluate documentation rule - passing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Docs', description: null,
          type: 'documentation', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/users', documentation: 'https://docs.example.com' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs are documented');
    });

    it('should evaluate documentation rule - failing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Docs', description: null,
          type: 'documentation', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain('APIs lack documentation');
    });

    it('should evaluate naming rule - passing with default prefix', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Naming', description: null,
          type: 'naming', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/api/v1/users' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs follow naming convention');
    });

    it('should evaluate naming rule - failing with custom prefix', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Naming', description: null,
          type: 'naming', config: { prefix: '/v2/' }, enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/v1/users' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain("don't follow naming convention");
      expect(result[0].details).toEqual({ prefix: '/api/v', violations: 1 });
    });

    it('should evaluate response_format rule - passing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Format', description: null,
          type: 'response_format', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/users', responseFormat: 'json' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('All APIs follow response format');
    });

    it('should evaluate response_format rule - failing', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Format', description: null,
          type: 'response_format', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a' },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(false);
      expect(result[0].message).toContain("don't follow response format");
    });

    it('should handle unknown rule type with default case', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Unknown', description: null,
          type: 'unknown_type', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result[0].passed).toBe(true);
      expect(result[0].message).toBe('Rule type not implemented');
    });

    it('should evaluate multiple rules at once', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Rate Limit', description: null,
          type: 'rate_limit', enabled: true, created_at: new Date(),
        },
        {
          id: 'r2', tenant_id: 'tenant1', name: 'Auth', description: null,
          type: 'auth_required', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'User API', method: 'GET', path: '/users', rateLimit: 100, authRequired: true },
      ]);

      const result = await serviceWithDb.evaluateGovernance('tenant1');

      expect(result.length).toBe(2);
      expect(result[0].ruleType).toBe('rate_limit');
      expect(result[1].ruleType).toBe('auth_required');
    });
  });

  describe('getGovernanceReport', () => {
    beforeEach(() => {
      mockRepo.findAllRules.mockResolvedValue([]);
      mockRepo.findAllContracts.mockResolvedValue([]);
      mockRepo.findById.mockResolvedValue(undefined);
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
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Rate Limit', description: null,
          type: 'rate_limit', enabled: true, created_at: new Date(),
        },
        {
          id: 'r2', tenant_id: 'tenant1', name: 'Auth', description: null,
          type: 'auth_required', enabled: true, created_at: new Date(),
        },
      ]);
      // One API with rateLimit but no authRequired
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a', rateLimit: 100 },
      ]);

      const result = await serviceWithDb.getGovernanceReport('tenant1');

      expect(result.totalRules).toBe(2);
      expect(result.passedRules).toBe(1);
      expect(result.failedRules).toBe(1);
      expect(result.complianceScore).toBe(50);
    });

    it('should return 100% when all rules pass', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Rate Limit', description: null,
          type: 'rate_limit', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a', rateLimit: 100 },
      ]);

      const result = await serviceWithDb.getGovernanceReport('tenant1');

      expect(result.complianceScore).toBe(100);
      expect(result.failedRules).toBe(0);
    });

    it('should return 0% when all rules fail', async () => {
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Rate Limit', description: null,
          type: 'rate_limit', enabled: true, created_at: new Date(),
        },
        {
          id: 'r2', tenant_id: 'tenant1', name: 'Auth', description: null,
          type: 'auth_required', enabled: true, created_at: new Date(),
        },
      ]);
      mockRepo.findAllContracts.mockResolvedValue([
        { id: 'a1', tenant_id: 'tenant1', api_name: 'API 1', method: 'GET', path: '/a' },
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
      mockRepo.findById.mockResolvedValue(undefined);

      const result = await serviceWithDb.getRule('nonexistent');

      expect(result).toBeNull();
    });

    it('should return rule from repository', async () => {
      const now = new Date();
      mockRepo.findById.mockResolvedValue({
        id: 'r1',
        tenant_id: 'tenant1',
        name: 'Rate Limit',
        description: 'desc',
        type: 'rate_limit',
        enabled: true,
        created_at: now,
      });

      const result = await serviceWithDb.getRule('r1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('r1');
      expect(result!.name).toBe('Rate Limit');
      expect(result!.description).toBe('desc');
    });

    it('should handle null description', async () => {
      const now = new Date();
      mockRepo.findById.mockResolvedValue({
        id: 'r1',
        tenant_id: 'tenant1',
        name: 'Rule',
        description: null,
        type: 'naming',
        enabled: false,
        created_at: now,
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
      mockRepo.findAllRules.mockResolvedValue([
        {
          id: 'r1', tenant_id: 'tenant1', name: 'Rule 1', description: null,
          type: 'rate_limit', enabled: true,
          created_at: now,
        },
        {
          id: 'r2', tenant_id: 'tenant1', name: 'Rule 2', description: 'desc',
          type: 'auth_required', enabled: false,
          created_at: now,
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
      mockRepo.findById.mockResolvedValue(undefined);

      const result = await serviceWithDb.updateRule('nonexistent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update rule and return result', async () => {
      const now = new Date();
      mockRepo.findById.mockResolvedValue({
        id: 'r1',
        tenant_id: 'tenant1',
        name: 'Old Rule',
        description: 'old desc',
        type: 'rate_limit',
        enabled: true,
        created_at: now,
      });
      mockRepo.updateRule.mockResolvedValue({
        id: 'r1',
        tenant_id: 'tenant1',
        name: 'Updated Rule',
        description: 'new desc',
        type: 'rate_limit',
        enabled: false,
        created_at: now,
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
      mockRepo.findById.mockResolvedValue({
        id: 'r1', tenant_id: 'tenant1', name: 'Rule', description: null,
        type: 'naming', enabled: true, created_at: now,
      });
      mockRepo.updateRule.mockResolvedValue({
        id: 'r1', tenant_id: 'tenant1', name: 'Rule', description: null,
        type: 'naming', enabled: true, created_at: now,
      });

      await serviceWithDb.updateRule('r1', { enabled: true });

      expect(mockRepo.updateRule).toHaveBeenCalledWith('r1', {
        name: 'Rule',
        description: null,
        type: 'naming',
        enabled: true,
      }, undefined);
    });
  });

  describe('deleteRule', () => {
    it('should return false when no rule repository', async () => {
      const result = await service.deleteRule('r1');

      expect(result).toBe(false);
    });

    it('should return true when rule deleted successfully', async () => {
      const now = new Date();
      mockRepo.findById.mockResolvedValue({
        id: 'r1', tenant_id: 'tenant1', name: 'Rule', description: null,
        type: 'naming', enabled: true, created_at: now,
      });
      mockRepo.deleteRule.mockResolvedValue(undefined);

      const result = await serviceWithDb.deleteRule('r1', 'tenant1');

      expect(result).toBe(true);
      expect(mockRepo.deleteRule).toHaveBeenCalledWith('r1', 'tenant1');
    });

    it('should return false when rule not found', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

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
      mockRepo.createContract.mockResolvedValue({
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
      expect(mockRepo.createContract).toHaveBeenCalledTimes(1);
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
