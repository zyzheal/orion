/**
 * ChatOpsSSEConnectionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ChatOpsSSEConnectionRepository } from '../ChatOpsSSEConnectionRepository';

const mockQuery = jest.fn();

describe('ChatOpsSSEConnectionRepository', () => {
  let repo: ChatOpsSSEConnectionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChatOpsSSEConnectionRepository({ query: mockQuery } as any);
  });

  it('should findByUserId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByUserId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByUserId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByUserId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countActive('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateHeartbeat', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateHeartbeat('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markDisconnected', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markDisconnected('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should disconnectAllByUserId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.disconnectAllByUserId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should disconnectAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.disconnectAll('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
