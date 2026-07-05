/**
 * DegradedStateRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DegradedStateRepository } from '../DegradedStateRepository';

const mockQuery = jest.fn();

describe('DegradedStateRepository', () => {
  let repo: DegradedStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DegradedStateRepository({ query: mockQuery } as any);
  });

  it('should findByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsert('test-id', 'test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should removeByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.removeByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllDegraded', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllDegraded();
    expect(mockQuery).toHaveBeenCalled();
  });
});
