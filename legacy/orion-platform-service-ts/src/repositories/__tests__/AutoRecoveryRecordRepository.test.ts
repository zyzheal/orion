/**
 * AutoRecoveryRecordRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AutoRecoveryRecordRepository } from '../AutoRecoveryRecordRepository';

const mockQuery = jest.fn();

describe('AutoRecoveryRecordRepository', () => {
  let repo: AutoRecoveryRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AutoRecoveryRecordRepository({ query: mockQuery } as any);
  });

  it('should findByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProviderId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findDegradedProviders', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findDegradedProviders();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getAttemptStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getAttemptStats('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getOverallStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getOverallStats();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getDistinctProviderIds', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getDistinctProviderIds();
    expect(mockQuery).toHaveBeenCalled();
  });
});
