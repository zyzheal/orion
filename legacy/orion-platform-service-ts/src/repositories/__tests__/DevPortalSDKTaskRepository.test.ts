/**
 * DevPortalSDKTaskRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DevPortalSDKTaskRepository } from '../DevPortalSDKTaskRepository';

const mockQuery = jest.fn();

describe('DevPortalSDKTaskRepository', () => {
  let repo: DevPortalSDKTaskRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DevPortalSDKTaskRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
