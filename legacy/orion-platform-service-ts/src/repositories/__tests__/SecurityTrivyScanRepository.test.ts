/**
 * SecurityTrivyScanRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SecurityTrivyScanRepository } from '../SecurityTrivyScanRepository';

const mockQuery = jest.fn();

describe('SecurityTrivyScanRepository', () => {
  let repo: SecurityTrivyScanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SecurityTrivyScanRepository({ query: mockQuery } as any);
  });

  it('should findByImageName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByImageName('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
