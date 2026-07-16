/**
 * EnvironmentExecutorRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { EnvironmentExecutorRepository } from '../EnvironmentExecutorRepository';

const mockQuery = jest.fn();

describe('EnvironmentExecutorRepository', () => {
  let repo: EnvironmentExecutorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EnvironmentExecutorRepository({ query: mockQuery } as any);
  });

  it('should findByTenantAndEnv', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantAndEnv('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActiveByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsert('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should update', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.update('test-id', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
