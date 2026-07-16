/**
 * ChatOpsSubscriptionFailureRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ChatOpsSubscriptionFailureRepository } from '../ChatOpsSubscriptionFailureRepository';

const mockQuery = jest.fn();

describe('ChatOpsSubscriptionFailureRepository', () => {
  let repo: ChatOpsSubscriptionFailureRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ChatOpsSubscriptionFailureRepository({ query: mockQuery } as any);
  });

  it('should findByEventType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEventType('test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findUnresolved', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findUnresolved('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markResolved', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markResolved('test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should incrementRetryCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.incrementRetryCount('test-type');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertFailure', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertFailure('test-type', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
