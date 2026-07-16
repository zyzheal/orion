/**
 * ProviderCircuitBreakerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ProviderCBStateRepository, ProviderCBMetricsRepository, ProviderCBRequestHistoryRepository } from '../ProviderCircuitBreakerRepository';

const mockQuery = jest.fn();

describe('ProviderCBStateRepository', () => {
  let repo: ProviderCBStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProviderCBStateRepository({ query: mockQuery } as any);
  });

  it('should findByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByProviderId('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ProviderCBMetricsRepository', () => {
  let repo: ProviderCBMetricsRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProviderCBMetricsRepository({ query: mockQuery } as any);
  });

  it('should findByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByProviderId('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ProviderCBRequestHistoryRepository', () => {
  let repo: ProviderCBRequestHistoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ProviderCBRequestHistoryRepository({ query: mockQuery } as any);
  });

  it('should findByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should pruneOldRecords', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.pruneOldRecords('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
