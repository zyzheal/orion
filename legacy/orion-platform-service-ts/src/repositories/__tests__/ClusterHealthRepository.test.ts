/**
 * ClusterHealthRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ClusterRecordRepository, ClusterHealthCheckRepository, ClusterMetricsRepository, ClusterAnomalyRepository } from '../ClusterHealthRepository';

const mockQuery = jest.fn();

describe('ClusterRecordRepository', () => {
  let repo: ClusterRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ClusterRecordRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateLastHealthCheck', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateLastHealthCheck('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ClusterHealthCheckRepository', () => {
  let repo: ClusterHealthCheckRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ClusterHealthCheckRepository({ query: mockQuery } as any);
  });

  it('should findByClusterId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByClusterId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getLatestByClusterId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getLatestByClusterId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ClusterMetricsRepository', () => {
  let repo: ClusterMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ClusterMetricsRepository({ query: mockQuery } as any);
  });

  it('should findByClusterId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByClusterId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getLatestByClusterId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getLatestByClusterId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ClusterAnomalyRepository', () => {
  let repo: ClusterAnomalyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ClusterAnomalyRepository({ query: mockQuery } as any);
  });

  it('should findByClusterId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByClusterId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySeverity', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySeverity('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createBatch', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createBatch('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
