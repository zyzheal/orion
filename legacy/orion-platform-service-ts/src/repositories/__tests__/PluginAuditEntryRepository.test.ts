/**
 * PluginAuditEntryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PluginAuditEntryRepository } from '../PluginAuditEntryRepository';

const mockQuery = jest.fn();

describe('PluginAuditEntryRepository', () => {
  let repo: PluginAuditEntryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PluginAuditEntryRepository({ query: mockQuery } as any);
  });

  it('should findByTaskId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTaskId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPluginId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPluginId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByLevel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByLevel('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAction', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAction('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByFilters', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByFilters('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupExpired('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByFilters', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByFilters('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
