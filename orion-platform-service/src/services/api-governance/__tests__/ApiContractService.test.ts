/**
 * ApiContractService 单元测试
 */

import { ApiContractService, ApiContract, ContractViolation } from '../ApiContractService';

// Mock repositories
const mockContractRepo = {
  createContract: jest.fn(),
  findById: jest.fn(),
  findByTenant: jest.fn(),
  updateContract: jest.fn(),
  deleteContract: jest.fn(),
};

const mockViolationRepo = {
  findByContract: jest.fn(),
  createViolation: jest.fn(),
  deleteByContract: jest.fn(),
};

// Mock the repository modules
jest.mock('../../../repositories/ApiContractRepository', () => ({
  ApiContractRepository: jest.fn().mockImplementation(() => mockContractRepo),
  ApiContractViolationRepository: jest.fn().mockImplementation(() => mockViolationRepo),
}));

describe('ApiContractService', () => {
  let service: ApiContractService;
  let serviceWithDb: ApiContractService;
  const mockDb = { query: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();

    // Service without DB (in-memory fallback)
    service = new ApiContractService();

    // Service with DB
    serviceWithDb = new ApiContractService(mockDb as any);
  });

  describe('constructor', () => {
    it('should create service without DB', () => {
      const svc = new ApiContractService();
      expect(svc).toBeDefined();
    });

    it('should create service with DB', () => {
      const svc = new ApiContractService(mockDb as any);
      expect(svc).toBeDefined();
    });

    it('should create service with undefined db', () => {
      const svc = new ApiContractService(undefined);
      expect(svc).toBeDefined();
    });
  });

  describe('registerContract', () => {
    it('should register contract without DB (in-memory fallback)', async () => {
      const result = await service.registerContract('tenant1', {
        name: 'User API',
        endpoint: '/api/users',
        method: 'GET',
        schema: { id: 'number', name: 'string' },
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('User API');
      expect(result.endpoint).toBe('/api/users');
      expect(result.method).toBe('GET');
      expect(result.tenantId).toBe('tenant1');
      expect(result.version).toBe('1.0.0');
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should register contract with custom version when no DB', async () => {
      const result = await service.registerContract('tenant1', {
        name: 'Order API',
        endpoint: '/api/orders',
        method: 'POST',
        schema: { orderId: 'string' },
        version: '2.0.0',
      });

      expect(result.version).toBe('2.0.0');
    });

    it('should register contract with DB', async () => {
      const now = new Date();
      mockContractRepo.createContract.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'User API',
        description: null,
        endpoint: '/api/users',
        method: 'GET',
        schema: { id: 'number' },
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.registerContract('tenant1', {
        name: 'User API',
        endpoint: '/api/users',
        method: 'GET',
        schema: { id: 'number' },
      });

      expect(result.id).toBe('c1');
      expect(result.name).toBe('User API');
      expect(mockContractRepo.createContract).toHaveBeenCalledTimes(1);
    });

    it('should register contract with description when using DB', async () => {
      const now = new Date();
      mockContractRepo.createContract.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'User API',
        description: 'User management API',
        endpoint: '/api/users',
        method: 'GET',
        schema: {},
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.registerContract('tenant1', {
        name: 'User API',
        description: 'User management API',
        endpoint: '/api/users',
        method: 'GET',
        schema: {},
      });

      expect(result.description).toBe('User management API');
    });

    it('should handle undefined description when using DB', async () => {
      const now = new Date();
      mockContractRepo.createContract.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: {},
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.registerContract('tenant1', {
        name: 'API',
        endpoint: '/test',
        method: 'GET',
        schema: {},
      });

      expect(result.description).toBeUndefined();
    });
  });

  describe('evaluateContract', () => {
    it('should return critical violation when contract not found (no DB)', async () => {
      const result = await service.evaluateContract('nonexistent', { id: 1 });

      expect(result.compliant).toBe(false);
      expect(result.score).toBe(0);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].violationType).toBe('schema_mismatch');
      expect(result.violations[0].description).toBe('Contract not found');
      expect(result.violations[0].severity).toBe('critical');
    });

    it('should return critical violation when contract not found in DB', async () => {
      mockContractRepo.findById.mockResolvedValue(null);

      const result = await serviceWithDb.evaluateContract('nonexistent', { id: 1 });

      expect(result.compliant).toBe(false);
      expect(result.score).toBe(0);
      expect(result.violations[0].severity).toBe('critical');
    });

    it('should return compliant when all fields match', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        // Use actual typed values so typeof matches
        schema: { id: 0, name: '' },
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });
      mockViolationRepo.deleteByContract.mockResolvedValue(0);
      mockViolationRepo.createViolation.mockResolvedValue({});

      const result = await serviceWithDb.evaluateContract('c1', { id: 42, name: 'test' });

      expect(result.compliant).toBe(true);
      expect(result.score).toBe(100);
      expect(result.violations.length).toBe(0);
    });

    it('should detect missing fields', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: { id: 0, name: '', email: '' },
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });
      mockViolationRepo.deleteByContract.mockResolvedValue(0);
      mockViolationRepo.createViolation.mockResolvedValue({});

      const result = await serviceWithDb.evaluateContract('c1', { id: 42 });

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBe(2); // missing name and email
      expect(result.violations.every(v => v.violationType === 'missing_field')).toBe(true);
      expect(result.violations.every(v => v.severity === 'high')).toBe(true);
      expect(result.score).toBeLessThan(100);
    });

    it('should detect type mismatches', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: { count: 0 }, // expected number
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });
      mockViolationRepo.deleteByContract.mockResolvedValue(0);
      mockViolationRepo.createViolation.mockResolvedValue({});

      const result = await serviceWithDb.evaluateContract('c1', { count: 'not-a-number' });

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].violationType).toBe('type_error');
      expect(result.violations[0].severity).toBe('medium');
    });

    it('should return 100 score when schema is empty', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: {},
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });
      mockViolationRepo.deleteByContract.mockResolvedValue(0);

      const result = await serviceWithDb.evaluateContract('c1', {});

      expect(result.compliant).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should persist violations to DB when repository is available', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: { required_field: 'string' },
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });
      mockViolationRepo.deleteByContract.mockResolvedValue(1);
      mockViolationRepo.createViolation.mockResolvedValue({});

      await serviceWithDb.evaluateContract('c1', {});

      expect(mockViolationRepo.deleteByContract).toHaveBeenCalledWith('c1');
      expect(mockViolationRepo.createViolation).toHaveBeenCalledTimes(1);
    });

    it('should not persist violations when no violation repository', async () => {
      // This service has no DB at all, so no violations are persisted
      const result = await service.evaluateContract('nonexistent', {});

      expect(result.violations.length).toBe(1); // contract not found
      expect(mockViolationRepo.createViolation).not.toHaveBeenCalled();
    });

    it('should include evaluatedAt timestamp', async () => {
      const result = await service.evaluateContract('c1', {});

      expect(result.evaluatedAt).toBeDefined();
      expect(typeof result.evaluatedAt).toBe('string');
    });
  });

  describe('getContractViolations', () => {
    it('should return empty array when no violation repository', async () => {
      const result = await service.getContractViolations('c1');

      expect(result).toEqual([]);
    });

    it('should return violations from repository', async () => {
      const now = new Date();
      mockViolationRepo.findByContract.mockResolvedValue([
        {
          id: 'v1',
          contractId: 'c1',
          violationType: 'missing_field',
          description: 'Missing field: name',
          severity: 'high',
          detectedAt: now,
          sampleData: null,
        },
      ]);

      const result = await serviceWithDb.getContractViolations('c1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('v1');
      expect(result[0].violationType).toBe('missing_field');
      expect(result[0].severity).toBe('high');
    });

    it('should map sampleData correctly', async () => {
      const now = new Date();
      mockViolationRepo.findByContract.mockResolvedValue([
        {
          id: 'v1',
          contractId: 'c1',
          violationType: 'type_error',
          description: 'Type mismatch',
          severity: 'medium',
          detectedAt: now,
          sampleData: { actual: 'string', expected: 'number' },
        },
      ]);

      const result = await serviceWithDb.getContractViolations('c1');

      expect(result[0].sampleData).toEqual({ actual: 'string', expected: 'number' });
    });

    it('should return empty array when repository returns empty', async () => {
      mockViolationRepo.findByContract.mockResolvedValue([]);

      const result = await serviceWithDb.getContractViolations('c1');

      expect(result).toEqual([]);
    });
  });

  describe('getContract', () => {
    it('should return null when no contract repository', async () => {
      const result = await service.getContract('c1');

      expect(result).toBeNull();
    });

    it('should return null when contract not found in DB', async () => {
      mockContractRepo.findById.mockResolvedValue(null);

      const result = await serviceWithDb.getContract('nonexistent');

      expect(result).toBeNull();
    });

    it('should return contract from repository', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'User API',
        description: 'desc',
        endpoint: '/api/users',
        method: 'GET',
        schema: { id: 'number' },
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.getContract('c1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('c1');
      expect(result!.name).toBe('User API');
      expect(result!.description).toBe('desc');
    });

    it('should handle null description from entity', async () => {
      const now = new Date();
      mockContractRepo.findById.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: {},
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.getContract('c1');

      expect(result!.description).toBeUndefined();
    });
  });

  describe('listContracts', () => {
    it('should return empty array when no contract repository', async () => {
      const result = await service.listContracts('tenant1');

      expect(result).toEqual([]);
    });

    it('should return contracts from repository', async () => {
      const now = new Date();
      mockContractRepo.findByTenant.mockResolvedValue([
        {
          id: 'c1',
          tenantId: 'tenant1',
          name: 'API 1',
          description: null,
          endpoint: '/api/1',
          method: 'GET',
          schema: {},
          version: '1.0.0',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'c2',
          tenantId: 'tenant1',
          name: 'API 2',
          description: 'desc',
          endpoint: '/api/2',
          method: 'POST',
          schema: {},
          version: '2.0.0',
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await serviceWithDb.listContracts('tenant1');

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('API 1');
      expect(result[1].name).toBe('API 2');
    });

    it('should return empty array when no contracts exist', async () => {
      mockContractRepo.findByTenant.mockResolvedValue([]);

      const result = await serviceWithDb.listContracts('tenant1');

      expect(result).toEqual([]);
    });
  });

  describe('updateContract', () => {
    it('should return null when no contract repository', async () => {
      const result = await service.updateContract('c1', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should return null when contract not found in DB', async () => {
      mockContractRepo.updateContract.mockResolvedValue(null);

      const result = await serviceWithDb.updateContract('nonexistent', { name: 'Updated' });

      expect(result).toBeNull();
    });

    it('should update contract and return result', async () => {
      const now = new Date();
      mockContractRepo.updateContract.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'Updated API',
        description: 'new desc',
        endpoint: '/api/users',
        method: 'GET',
        schema: {},
        version: '2.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.updateContract('c1', {
        name: 'Updated API',
        description: 'new desc',
        version: '2.0.0',
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated API');
      expect(result!.description).toBe('new desc');
    });

    it('should handle partial updates', async () => {
      const now = new Date();
      mockContractRepo.updateContract.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant1',
        name: 'API',
        description: null,
        endpoint: '/test',
        method: 'GET',
        schema: {},
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
      });

      const result = await serviceWithDb.updateContract('c1', { endpoint: '/new-endpoint' });

      expect(mockContractRepo.updateContract).toHaveBeenCalledWith('c1', {
        name: undefined,
        description: undefined,
        endpoint: '/new-endpoint',
        method: undefined,
        schema: undefined,
        version: undefined,
      });
      expect(result).not.toBeNull();
    });
  });

  describe('deleteContract', () => {
    it('should return false when no contract repository', async () => {
      const result = await service.deleteContract('c1');

      expect(result).toBe(false);
    });

    it('should delete contract and its violations when repos are available', async () => {
      mockViolationRepo.deleteByContract.mockResolvedValue(3);
      mockContractRepo.deleteContract.mockResolvedValue(true);

      const result = await serviceWithDb.deleteContract('c1');

      expect(result).toBe(true);
      expect(mockViolationRepo.deleteByContract).toHaveBeenCalledWith('c1');
      expect(mockContractRepo.deleteContract).toHaveBeenCalledWith('c1');
    });

    it('should return false when contract does not exist', async () => {
      mockViolationRepo.deleteByContract.mockResolvedValue(0);
      mockContractRepo.deleteContract.mockResolvedValue(false);

      const result = await serviceWithDb.deleteContract('nonexistent');

      expect(result).toBe(false);
    });
  });
});
