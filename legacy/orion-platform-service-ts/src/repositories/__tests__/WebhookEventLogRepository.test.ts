/**
 * WebhookEventLogRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { WebhookEventLogRepository } from '../WebhookEventLogRepository';

const mockQuery = jest.fn();

describe('WebhookEventLogRepository', () => {
  let repo: WebhookEventLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WebhookEventLogRepository({ query: mockQuery } as any);
  });

  it('should findByEventType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEventType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRepoType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRepoType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRecent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRecent('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanup', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanup('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
