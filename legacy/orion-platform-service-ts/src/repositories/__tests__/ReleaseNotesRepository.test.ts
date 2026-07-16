/**
 * ReleaseNotesRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ReleaseNotesRepository } from '../ReleaseNotesRepository';

const mockQuery = jest.fn();

describe('ReleaseNotesRepository', () => {
  let repo: ReleaseNotesRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ReleaseNotesRepository({ query: mockQuery } as any);
  });

  it('should findByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDeploymentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByVersion', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByVersion('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEnvironment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEnvironment('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByDeploymentId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByDeploymentId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByDeploymentId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
