/**
 * IntegrationMappingRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { IntegrationMappingRepository } from '../IntegrationMappingRepository';

const mockQuery = jest.fn();

describe('IntegrationMappingRepository', () => {
  let repo: IntegrationMappingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new IntegrationMappingRepository({ query: mockQuery } as any);
  });

  it('should findByIntegrationId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByIntegrationId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
