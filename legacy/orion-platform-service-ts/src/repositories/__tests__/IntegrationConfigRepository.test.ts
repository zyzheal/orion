/**
 * IntegrationConfigRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { IntegrationConfigRepository } from '../IntegrationConfigRepository';

const mockQuery = jest.fn();

describe('IntegrationConfigRepository', () => {
  let repo: IntegrationConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IntegrationConfigRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByProvider', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProvider('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
