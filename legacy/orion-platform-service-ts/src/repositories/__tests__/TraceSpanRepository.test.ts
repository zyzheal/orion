/**
 * TraceSpanRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TraceSpanRepository } from '../TraceSpanRepository';

const mockQuery = jest.fn();

describe('TraceSpanRepository', () => {
  let repo: TraceSpanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TraceSpanRepository({ query: mockQuery } as any);
  });

  it('should findByTraceId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTraceId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should searchTraces', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.searchTraces('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByServiceName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByServiceName('test-id', 'test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTraceId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTraceId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteOlderThan', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteOlderThan('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
