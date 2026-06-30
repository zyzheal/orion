/**
 * Phase3Repository Tests
 */
import { CompliancePolicyRepository } from '../Phase3Repository';

jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

const mockQuery = jest.fn();
let repo: CompliancePolicyRepository;

const sampleRow = {
  id: 'cp-1', tenant_id: 'test-tenant', name: 'SOC2', description: 'SOC2 policy',
  framework_type: 'SOC2', requirements: '{"access_control": true}',
  rules: '[]', severity_threshold: 'high', enabled: true,
  created_by: 'admin', created_at: new Date(), updated_at: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  repo = new CompliancePolicyRepository({ query: mockQuery } as any);
});

describe('CompliancePolicyRepository', () => {
  it('should find by tenant', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findByTenant('test-tenant');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('SOC2');
  });

  it('should find by framework', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findByFramework('test-tenant', 'SOC2');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('framework_type = $2'),
      ['test-tenant', 'SOC2'],
    );
  });

  it('should map row preserving snake_case fields', async () => {
    mockQuery.mockResolvedValue({ rows: [sampleRow], rowCount: 1 });
    const result = await repo.findByTenant('test-tenant');
    expect(result[0].tenant_id).toBe('test-tenant');
    expect(result[0].framework_type).toBe('SOC2');
  });
});
