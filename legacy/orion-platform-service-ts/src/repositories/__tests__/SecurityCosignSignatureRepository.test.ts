/**
 * SecurityCosignSignatureRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SecurityCosignSignatureRepository } from '../SecurityCosignSignatureRepository';

const mockQuery = jest.fn();

describe('SecurityCosignSignatureRepository', () => {
  let repo: SecurityCosignSignatureRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SecurityCosignSignatureRepository({ query: mockQuery } as any);
  });

  it('should findByImageName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByImageName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });
});
