/**
 * ConsumerRegistryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ConsumerRegistryRepository } from '../ConsumerRegistryRepository';

const mockQuery = jest.fn();

describe('ConsumerRegistryRepository', () => {
  let repo: ConsumerRegistryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ConsumerRegistryRepository({ query: mockQuery } as any);
  });

  it('should findByQueueName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByQueueName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should heartbeat', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.heartbeat('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markDead', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markDead('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
