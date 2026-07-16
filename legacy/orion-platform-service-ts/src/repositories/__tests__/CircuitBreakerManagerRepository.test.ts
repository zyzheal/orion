/**
 * CircuitBreakerManagerRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CBManagerScenarioStateRepository, CBManagerProviderRepository } from '../CircuitBreakerManagerRepository';

const mockQuery = jest.fn();

describe('CBManagerScenarioStateRepository', () => {
  let repo: CBManagerScenarioStateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CBManagerScenarioStateRepository({ query: mockQuery } as any);
  });

  it('should findByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByScenario', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByScenario('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('CBManagerProviderRepository', () => {
  let repo: CBManagerProviderRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CBManagerProviderRepository({ query: mockQuery } as any);
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

  it('should listEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should upsertByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.upsertByProviderId('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByProviderId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByProviderId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
