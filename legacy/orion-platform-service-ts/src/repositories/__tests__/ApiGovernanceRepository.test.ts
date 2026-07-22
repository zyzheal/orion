/**
 * ApiGovernanceRepository Unit Tests
 */

import { ApiGovernanceRepository } from '../ApiGovernanceRepository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: jest.fn(() => 'test-tenant-001'),
}));

const createMockPool = (rows: any[] = [], rowCount: number = 0) => ({
  query: jest.fn().mockResolvedValue({ rows, rowCount }),
});

describe('ApiGovernanceRepository', () => {
  let repo: ApiGovernanceRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    repo = new ApiGovernanceRepository(mockPool as any);
  });

  // ==================== API Contracts ====================

  describe('createContract', () => {
    it('should insert a contract and return entity', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'contract-1',
          tenant_id: 'test-tenant-001',
          api_name: 'UserAPI',
          version: 'v1',
          method: 'GET',
          path: '/users',
          request_schema: {},
          response_schema: {},
          status: 'active',
          deprecation_date: null,
          retirement_date: null,
          replacement_version: null,
          created_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createContract({
        apiName: 'UserAPI',
        version: 'v1',
        method: 'GET',
        path: '/users',
        requestSchema: {},
        responseSchema: {},
      });

      expect(result.id).toBe('contract-1');
      expect(result.api_name).toBe('UserAPI');
      expect(result.status).toBe('active');
    });
  });

  describe('findContractById', () => {
    it('should return contract when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'contract-1',
          tenant_id: 'test-tenant-001',
          api_name: 'A',
          version: 'v1',
          method: 'GET',
          path: '/a',
          request_schema: {},
          response_schema: {},
          status: 'active',
          deprecation_date: null,
          retirement_date: null,
          replacement_version: null,
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.findContractById('contract-1');
      expect(result).toBeDefined();
      expect(result!.api_name).toBe('A');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findContractById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAllContracts', () => {
    it('should return all contracts', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'c1', tenant_id: 'test-tenant-001', api_name: 'A', version: 'v1', method: 'GET', path: '/a', request_schema: {}, response_schema: {}, status: 'active', deprecation_date: null, retirement_date: null, replacement_version: null, created_at: new Date() },
        ],
        rowCount: 1,
      });

      const result = await repo.findAllContracts();
      expect(result).toHaveLength(1);
    });

    it('should filter by apiName and status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await repo.findAllContracts(undefined, { apiName: 'UserAPI', status: 'active' });
      const querySql = mockPool.query.mock.calls[0][0];
      expect(querySql).toContain('api_name');
      expect(querySql).toContain('status');
    });
  });

  describe('updateContract', () => {
    it('should update contract status', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'contract-1',
          tenant_id: 'test-tenant-001',
          api_name: 'A',
          version: 'v1',
          method: 'GET',
          path: '/a',
          request_schema: {},
          response_schema: {},
          status: 'deprecated',
          deprecation_date: '2026-07-01',
          retirement_date: null,
          replacement_version: 'v2',
          created_at: new Date(),
        }],
        rowCount: 1,
      });

      const result = await repo.updateContract('contract-1', { status: 'deprecated' });
      expect(result).toBeDefined();
      expect(result!.status).toBe('deprecated');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.updateContract('nonexistent', { status: 'deprecated' });
      expect(result).toBeUndefined();
    });
  });

  // ==================== Violations ====================

  describe('createViolation', () => {
    it('should insert a violation', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'viol-1',
          contract_id: 'contract-1',
          tenant_id: 'test-tenant-001',
          violation_type: 'missing_field',
          description: 'Required field missing',
          severity: 'critical',
          detected_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createViolation({
        contractId: 'contract-1',
        violationType: 'missing_field',
        description: 'Required field missing',
        severity: 'critical',
      });

      expect(result.id).toBe('viol-1');
      expect(result.contract_id).toBe('contract-1');
      expect(result.severity).toBe('critical');
    });
  });

  describe('findViolations', () => {
    it('should return all violations', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'v1', contract_id: 'c1', tenant_id: 'test-tenant-001', violation_type: 't', description: 'd', severity: 'info', detected_at: new Date() },
        ],
        rowCount: 1,
      });

      const result = await repo.findViolations();
      expect(result).toHaveLength(1);
    });

    it('should filter by contractId and severity', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await repo.findViolations(undefined, { contractId: 'c1', severity: 'critical' });
      const querySql = mockPool.query.mock.calls[0][0];
      expect(querySql).toContain('contract_id');
      expect(querySql).toContain('severity');
    });
  });

  // ==================== API Versions ====================

  describe('createApiVersion', () => {
    it('should insert a version', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'ver-1',
          tenant_id: 'test-tenant-001',
          api_name: 'UserAPI',
          version: 'v2',
          status: 'active',
          registered_at: new Date('2026-07-01T00:00:00Z'),
          deprecation_date: null,
          retirement_date: null,
          replacement_version: null,
          changelog: 'Breaking changes',
        }],
        rowCount: 1,
      });

      const result = await repo.createApiVersion({
        apiName: 'UserAPI',
        version: 'v2',
        changelog: 'Breaking changes',
      });

      expect(result.id).toBe('ver-1');
      expect(result.changelog).toBe('Breaking changes');
    });
  });

  describe('findApiVersionById', () => {
    it('should return version when found', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'ver-1',
          tenant_id: 'test-tenant-001',
          api_name: 'A',
          version: 'v1',
          status: 'active',
          registered_at: new Date(),
          deprecation_date: null,
          retirement_date: null,
          replacement_version: null,
          changelog: null,
        }],
        rowCount: 1,
      });

      const result = await repo.findApiVersionById('ver-1');
      expect(result).toBeDefined();
      expect(result!.api_name).toBe('A');
    });

    it('should return undefined when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      expect(await repo.findApiVersionById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAllApiVersions', () => {
    it('should return all versions', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'v1', tenant_id: 'test-tenant-001', api_name: 'A', version: 'v1', status: 'active', registered_at: new Date(), deprecation_date: null, retirement_date: null, replacement_version: null, changelog: null },
        ],
        rowCount: 1,
      });

      const result = await repo.findAllApiVersions();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateApiVersion', () => {
    it('should update version status to deprecated', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'ver-1',
          tenant_id: 'test-tenant-001',
          api_name: 'A',
          version: 'v1',
          status: 'deprecated',
          registered_at: new Date(),
          deprecation_date: '2026-07-01',
          retirement_date: null,
          replacement_version: 'v2',
          changelog: null,
        }],
        rowCount: 1,
      });

      const result = await repo.updateApiVersion('ver-1', { status: 'deprecated' });
      expect(result).toBeDefined();
      expect(result!.status).toBe('deprecated');
    });
  });

  describe('findDeprecatedVersions', () => {
    it('should return deprecated versions', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'v1', tenant_id: 'test-tenant-001', api_name: 'A', version: 'v1', status: 'deprecated', registered_at: new Date(), deprecation_date: '2026-07-01', retirement_date: null, replacement_version: 'v2', changelog: null },
        ],
        rowCount: 1,
      });

      const result = await repo.findDeprecatedVersions();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('deprecated');
    });
  });

  // ==================== Governance Rules ====================

  describe('createRule', () => {
    it('should insert a rule', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'rule-1',
          tenant_id: 'test-tenant-001',
          name: 'No wildcard',
          description: 'Disallow wildcard paths',
          type: 'security',
          enabled: true,
          created_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createRule({
        name: 'No wildcard',
        description: 'Disallow wildcard paths',
        type: 'security',
      });

      expect(result.id).toBe('rule-1');
      expect(result.name).toBe('No wildcard');
      expect(result.enabled).toBe(true);
    });
  });

  describe('findAllRules', () => {
    it('should return all rules', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'r1', tenant_id: 'test-tenant-001', name: 'Rule 1', description: 'd', type: 'security', enabled: true, created_at: new Date() },
        ],
        rowCount: 1,
      });

      const result = await repo.findAllRules();
      expect(result).toHaveLength(1);
    });
  });

  // ==================== Verification History ====================

  describe('createVerification', () => {
    it('should insert a verification record', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{
          id: 'verify-1',
          contract_id: 'contract-1',
          tenant_id: 'test-tenant-001',
          passed: true,
          violations: [],
          endpoint: '/users',
          method: 'GET',
          verified_at: new Date('2026-07-01T00:00:00Z'),
        }],
        rowCount: 1,
      });

      const result = await repo.createVerification({
        contractId: 'contract-1',
        passed: true,
        violations: [],
        endpoint: '/users',
        method: 'GET',
      });

      expect(result.id).toBe('verify-1');
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  describe('findVerificationHistoryByContractId', () => {
    it('should return verification history for a contract', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'v1', contract_id: 'contract-1', tenant_id: 'test-tenant-001', passed: true, violations: [], endpoint: '/users', method: 'GET', verified_at: new Date('2026-07-01T00:00:01Z') },
          { id: 'v2', contract_id: 'contract-1', tenant_id: 'test-tenant-001', passed: false, violations: ['missing x'], endpoint: '/users', method: 'POST', verified_at: new Date('2026-07-01T00:00:02Z') },
        ],
        rowCount: 2,
      });

      const result = await repo.findVerificationHistoryByContractId('contract-1');
      expect(result).toHaveLength(2);
      expect(result[0].passed).toBe(true);
      expect(result[1].passed).toBe(false);
    });
  });

  // ==================== Governance Stats ====================

  describe('getGovernanceStats', () => {
    it('should return correct stats', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }], rowCount: 1 })   // contracts
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })    // versions
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })    // rules
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })    // active rules
        .mockResolvedValueOnce({ rows: [{ count: '7' }], rowCount: 1 })    // violations
        .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 });   // deprecated

      const stats = await repo.getGovernanceStats();

      expect(stats.totalContracts).toBe(10);
      expect(stats.totalVersions).toBe(5);
      expect(stats.totalRules).toBe(3);
      expect(stats.activeRules).toBe(2);
      expect(stats.totalViolations).toBe(7);
      expect(stats.deprecatedVersions).toBe(1);
    });
  });
});
