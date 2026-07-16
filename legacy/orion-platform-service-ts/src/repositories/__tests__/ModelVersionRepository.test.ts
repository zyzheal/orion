/**
 * ModelVersionRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ModelVersionRepository, ABTestRepository, ABTestMetricRepository } from '../ModelVersionRepository';

const mockQuery = jest.fn();

describe('ModelVersionRepository', () => {
  let repo: ModelVersionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ModelVersionRepository({ query: mockQuery } as any);
  });

  it('should findByNameAndVersion', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByNameAndVersion('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findActiveByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findActiveByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllActive', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllActive();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should listAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.listAll('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateMetrics', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateMetrics('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should clearActiveByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.clearActiveByName('test-name');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ABTestRepository', () => {
  let repo: ABTestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ABTestRepository({ query: mockQuery } as any);
  });

  it('should findByName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByName('test-name', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ABTestMetricRepository', () => {
  let repo: ABTestMetricRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ABTestMetricRepository({ query: mockQuery } as any);
  });

  it('should findByABTest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByABTest('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByABTestAndModel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByABTestAndModel('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should incrementRequestCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.incrementRequestCount('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateMetrics', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateMetrics('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
