/**
 * NatsRegistryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ServiceInstanceRepository } from '../NatsRegistryRepository';

const mockQuery = jest.fn();

describe('ServiceInstanceRepository', () => {
  let repo: ServiceInstanceRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ServiceInstanceRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findHealthyByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findHealthyByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateHeartbeat', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateHeartbeat('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markUnhealthy', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markUnhealthy('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
