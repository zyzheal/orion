/**
 * RiskReportRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RiskReportRepository } from '../RiskReportRepository';

const mockQuery = jest.fn();

describe('RiskReportRepository', () => {
  let repo: RiskReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RiskReportRepository({ query: mockQuery } as any);
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAssessment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAssessment('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRiskLevel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRiskLevel('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findDeployable', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findDeployable('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAll('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findById', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findById('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createReport', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createReport('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
