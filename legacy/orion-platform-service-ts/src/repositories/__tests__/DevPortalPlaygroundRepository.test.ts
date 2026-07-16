/**
 * DevPortalPlaygroundRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DevPortalPlaygroundRequestRepository, DevPortalPlaygroundResponseRepository } from '../DevPortalPlaygroundRepository';

const mockQuery = jest.fn();

describe('DevPortalPlaygroundRequestRepository', () => {
  let repo: DevPortalPlaygroundRequestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DevPortalPlaygroundRequestRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByUser', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByUser('test-id', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByUser', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByUser('test-id', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('DevPortalPlaygroundResponseRepository', () => {
  let repo: DevPortalPlaygroundResponseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DevPortalPlaygroundResponseRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRequestId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRequestId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByRequestId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByRequestId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByRequestId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByRequestId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
