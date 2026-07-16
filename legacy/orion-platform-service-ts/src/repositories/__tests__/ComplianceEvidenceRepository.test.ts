/**
 * ComplianceEvidenceRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ComplianceEvidenceRepository } from '../ComplianceEvidenceRepository';

const mockQuery = jest.fn();

describe('ComplianceEvidenceRepository', () => {
  let repo: ComplianceEvidenceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ComplianceEvidenceRepository({ query: mockQuery } as any);
  });

  it('should findByPolicyId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPolicyId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
