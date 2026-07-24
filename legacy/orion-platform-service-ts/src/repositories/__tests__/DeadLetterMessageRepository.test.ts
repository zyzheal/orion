/**
 * DeadLetterMessageRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DeadLetterMessageRepository } from '../DeadLetterMessageRepository';

const mockQuery = jest.fn();

describe('DeadLetterMessageRepository', () => {
  let repo: DeadLetterMessageRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DeadLetterMessageRepository({ query: mockQuery } as any);
  });

  it('should findByQueueName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByQueueName('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateReplayStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateReplayStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });
});
