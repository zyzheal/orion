/**
 * ModuleRegistryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ModuleRegistryRepository } from '../ModuleRegistryRepository';

const mockQuery = jest.fn();

describe('ModuleRegistryRepository', () => {
  let repo: ModuleRegistryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ModuleRegistryRepository({ query: mockQuery } as any);
  });

  it('should findByLevel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByLevel('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByState', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByState('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByDomain', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDomain('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertModule', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertModule('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateState', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateState('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllModules', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllModules();
    expect(mockQuery).toHaveBeenCalled();
  });
});
