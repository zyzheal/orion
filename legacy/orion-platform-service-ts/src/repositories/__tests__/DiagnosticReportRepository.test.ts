/**
 * DiagnosticReportRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DiagnosticReportRepository } from '../DiagnosticReportRepository';

const mockQuery = jest.fn();

describe('DiagnosticReportRepository', () => {
  let repo: DiagnosticReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DiagnosticReportRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findBySessionId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySessionId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
