/**
 * PluginVersionSnapshotRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PluginVersionSnapshotRepository } from '../PluginVersionSnapshotRepository';

const mockQuery = jest.fn();

describe('PluginVersionSnapshotRepository', () => {
  let repo: PluginVersionSnapshotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PluginVersionSnapshotRepository({ query: mockQuery } as any);
  });

  it('should findByPluginId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPluginId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findLatestByPluginId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findLatestByPluginId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPluginIdAndVersion', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPluginIdAndVersion('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneOldSnapshots', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneOldSnapshots('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByPluginId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByPluginId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
