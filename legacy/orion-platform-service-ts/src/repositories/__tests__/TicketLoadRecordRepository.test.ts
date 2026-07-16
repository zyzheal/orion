/**
 * TicketLoadRecordRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TicketLoadRecordRepository } from '../TicketLoadRecordRepository';

const mockQuery = jest.fn();

describe('TicketLoadRecordRepository', () => {
  let repo: TicketLoadRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TicketLoadRecordRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEngineerId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEngineerId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByEngineerId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByEngineerId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByEngineerId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByEngineerId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
