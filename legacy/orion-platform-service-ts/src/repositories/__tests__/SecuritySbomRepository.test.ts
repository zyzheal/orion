/**
 * SecuritySbomRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SecuritySbomRepository } from '../SecuritySbomRepository';

const mockQuery = jest.fn();

describe('SecuritySbomRepository', () => {
  let repo: SecuritySbomRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SecuritySbomRepository({ query: mockQuery } as any);
  });

  it('should findByImageName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByImageName('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
