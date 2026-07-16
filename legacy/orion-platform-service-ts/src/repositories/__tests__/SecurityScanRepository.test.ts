/**
 * SecurityScanRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { SecurityScanRepository, SecurityFindingRepository } from '../SecurityScanRepository';

const mockQuery = jest.fn();

describe('SecurityScanRepository', () => {
  let repo: SecurityScanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SecurityScanRepository({ query: mockQuery } as any);
  });

  it('should findByRepository', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRepository('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findFailedGates', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findFailedGates('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getScanStats', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getScanStats('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findRecent', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findRecent('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('SecurityFindingRepository', () => {
  let repo: SecurityFindingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SecurityFindingRepository({ query: mockQuery } as any);
  });

  it('should findByScanId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByScanId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySeverity', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySeverity('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should batchCreate', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.batchCreate('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
