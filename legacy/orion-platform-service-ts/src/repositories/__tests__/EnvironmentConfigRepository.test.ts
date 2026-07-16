/**
 * EnvironmentConfigRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { EnvironmentConfigRepository } from '../EnvironmentConfigRepository';

const mockQuery = jest.fn();

describe('EnvironmentConfigRepository', () => {
  let repo: EnvironmentConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EnvironmentConfigRepository({ query: mockQuery } as any);
  });

  it('should findByProjectId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProjectId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should lock', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.lock('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should unlock', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.unlock('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
