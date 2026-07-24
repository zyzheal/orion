/**
 * BuildLogRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { BuildLogRepository } from '../BuildLogRepository';

const mockQuery = jest.fn();

describe('BuildLogRepository', () => {
  let repo: BuildLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BuildLogRepository({ query: mockQuery } as any);
  });

  it('should findByBuildId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByBuildId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByProjectId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProjectId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should appendLogContent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.appendLogContent('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
