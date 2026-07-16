/**
 * AIModelRegistryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AIModelRegistryRepository } from '../AIModelRegistryRepository';

const mockQuery = jest.fn();

describe('AIModelRegistryRepository', () => {
  let repo: AIModelRegistryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AIModelRegistryRepository({ query: mockQuery } as any);
  });

  it('should findByModelId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByModelId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateVersions', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateVersions('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll();
    expect(mockQuery).toHaveBeenCalled();
  });
});
