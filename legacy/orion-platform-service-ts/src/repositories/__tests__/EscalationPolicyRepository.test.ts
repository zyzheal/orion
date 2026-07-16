/**
 * EscalationPolicyRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { EscalationPolicyRepository } from '../EscalationPolicyRepository';

const mockQuery = jest.fn();

describe('EscalationPolicyRepository', () => {
  let repo: EscalationPolicyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EscalationPolicyRepository({ query: mockQuery } as any);
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEntityType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEntityType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsert('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
