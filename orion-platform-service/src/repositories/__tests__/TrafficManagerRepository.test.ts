/**
 * TrafficManagerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TrafficConfigRepository, TrafficHistoryRepository } from '../TrafficManagerRepository';

const mockQuery = jest.fn();

describe('TrafficConfigRepository', () => {
  let repo: TrafficConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TrafficConfigRepository({ query: mockQuery } as any);
  });

  it('should findByCanaryId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCanaryId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertConfig', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertConfig('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('TrafficHistoryRepository', () => {
  let repo: TrafficHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TrafficHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByCanaryId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByCanaryId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createEntry', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createEntry('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
