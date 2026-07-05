/**
 * TraceSamplingConfigRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TraceSamplingConfigRepository } from '../TraceSamplingConfigRepository';

const mockQuery = jest.fn();

describe('TraceSamplingConfigRepository', () => {
  let repo: TraceSamplingConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TraceSamplingConfigRepository({ query: mockQuery } as any);
  });

  it('should findByServiceName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByServiceName('test-id', 'test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByServiceName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByServiceName('test-id', 'test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
