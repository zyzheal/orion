/**
 * DeploymentTrafficStateRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DeploymentTrafficStateRepository } from '../DeploymentTrafficStateRepository';

const mockQuery = jest.fn();

describe('DeploymentTrafficStateRepository', () => {
  let repo: DeploymentTrafficStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DeploymentTrafficStateRepository({ query: mockQuery } as any);
  });

  it('should findByAppAndEnvironment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAppAndEnvironment('test-name', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByAppEnvironment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByAppEnvironment('test-id', 'test-id', 'test-name', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByAppAndEnvironment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByAppAndEnvironment('test-name', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
