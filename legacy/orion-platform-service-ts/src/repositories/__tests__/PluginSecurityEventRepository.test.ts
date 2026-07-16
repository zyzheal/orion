/**
 * PluginSecurityEventRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { PluginSecurityEventRepository } from '../PluginSecurityEventRepository';

const mockQuery = jest.fn();

describe('PluginSecurityEventRepository', () => {
  let repo: PluginSecurityEventRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PluginSecurityEventRepository({ query: mockQuery } as any);
  });

  it('should findByPluginId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPluginId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTaskId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTaskId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySeverity', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySeverity('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupExpired('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
