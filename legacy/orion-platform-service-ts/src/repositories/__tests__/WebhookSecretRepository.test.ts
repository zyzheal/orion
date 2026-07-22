/**
 * WebhookSecretRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { WebhookSecretRepository } from '../WebhookSecretRepository';

const mockQuery = jest.fn();

describe('WebhookSecretRepository', () => {
  let repo: WebhookSecretRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WebhookSecretRepository({ query: mockQuery } as any);
  });

  it('should findByRepoId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRepoId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByRepoId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByRepoId('test-id', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
