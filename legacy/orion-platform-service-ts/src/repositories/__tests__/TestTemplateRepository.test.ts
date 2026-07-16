/**
 * TestTemplateRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TestTemplateRepository } from '../TestTemplateRepository';

const mockQuery = jest.fn();

describe('TestTemplateRepository', () => {
  let repo: TestTemplateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestTemplateRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByFramework', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByFramework('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
