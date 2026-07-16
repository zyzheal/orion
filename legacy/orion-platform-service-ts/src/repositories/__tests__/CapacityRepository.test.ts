/**
 * CapacityRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { CapacityMetricRepository, CapacityForecastRepository, CapacityAlertRepository, CapacityReportRepository } from '../CapacityRepository';

const mockQuery = jest.fn();

describe('CapacityMetricRepository', () => {
  let repo: CapacityMetricRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CapacityMetricRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findLatestByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findLatestByTenant('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('CapacityForecastRepository', () => {
  let repo: CapacityForecastRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CapacityForecastRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('CapacityAlertRepository', () => {
  let repo: CapacityAlertRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CapacityAlertRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('CapacityReportRepository', () => {
  let repo: CapacityReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CapacityReportRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
