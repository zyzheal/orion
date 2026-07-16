/**
 * MonitoringEscalationPolicyRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { MonitoringEscalationPolicyRepository } from '../MonitoringEscalationPolicyRepository';

const mockQuery = jest.fn();

describe('MonitoringEscalationPolicyRepository', () => {
  let repo: MonitoringEscalationPolicyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MonitoringEscalationPolicyRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should toggleEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.toggleEnabled('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
