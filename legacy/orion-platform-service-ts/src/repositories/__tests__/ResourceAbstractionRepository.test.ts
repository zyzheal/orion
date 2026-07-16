/**
 * ResourceAbstractionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { UnifiedResourceRepository, DeploymentResultRepository } from '../ResourceAbstractionRepository';

const mockQuery = jest.fn();

describe('UnifiedResourceRepository', () => {
  let repo: UnifiedResourceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new UnifiedResourceRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createResource', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createResource('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteResource', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteResource('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('DeploymentResultRepository', () => {
  let repo: DeploymentResultRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DeploymentResultRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createDeployment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createDeployment('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
