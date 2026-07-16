/**
 * DispatchResultRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DispatchResultRepository } from '../DispatchResultRepository';

const mockQuery = jest.fn();

describe('DispatchResultRepository', () => {
  let repo: DispatchResultRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DispatchResultRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAssignee', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAssignee('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPeriod', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPeriod('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateAccepted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateAccepted('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
