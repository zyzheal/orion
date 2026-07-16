/**
 * DigitalTwinSnapshotRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DigitalTwinSnapshotRepository } from '../DigitalTwinSnapshotRepository';

const mockQuery = jest.fn();

describe('DigitalTwinSnapshotRepository', () => {
  let repo: DigitalTwinSnapshotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DigitalTwinSnapshotRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantAndActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantAndActive('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createSnapshot', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createSnapshot('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
