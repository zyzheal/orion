/**
 * DevPortalSubscriptionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DevPortalSubscriptionRepository, DevPortalUsageRecordRepository } from '../DevPortalSubscriptionRepository';

const mockQuery = jest.fn();

describe('DevPortalSubscriptionRepository', () => {
  let repo: DevPortalSubscriptionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DevPortalSubscriptionRepository({ query: mockQuery } as any);
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

  it('should findDuplicate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findDuplicate('test-id', 'test-id', 'test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should incrementUsage', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.incrementUsage('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('DevPortalUsageRecordRepository', () => {
  let repo: DevPortalUsageRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DevPortalUsageRecordRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg', 'test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySubscription', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySubscription('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countBySubscription', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countBySubscription('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
