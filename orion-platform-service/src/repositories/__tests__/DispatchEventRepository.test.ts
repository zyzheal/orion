/**
 * DispatchEventRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DispatchEventRepository } from '../DispatchEventRepository';

const mockQuery = jest.fn();

describe('DispatchEventRepository', () => {
  let repo: DispatchEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DispatchEventRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateAssignment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateAssignment('test-id', 'test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateAcceptance', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateAcceptance('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateResolution', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateResolution('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPeriod', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPeriod('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
