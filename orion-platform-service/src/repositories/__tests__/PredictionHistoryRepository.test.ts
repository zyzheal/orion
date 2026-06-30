/**
 * PredictionHistoryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PredictionHistoryRepository } from '../PredictionHistoryRepository';

const mockQuery = jest.fn();

describe('PredictionHistoryRepository', () => {
  let repo: PredictionHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PredictionHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByModel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByModel('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByModelCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByModelCount('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByModel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByModel('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneOldRecords', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneOldRecords('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
