/**
 * K8sProvisionerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { K8sNamespaceRepository } from '../K8sProvisionerRepository';

const mockQuery = jest.fn();

describe('K8sNamespaceRepository', () => {
  let repo: K8sNamespaceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new K8sNamespaceRepository({ query: mockQuery } as any);
  });

  it('should findByNamespace', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByNamespace('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActive();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByPr', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPr('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markDestroyed', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markDestroyed('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
