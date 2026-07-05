/**
 * QualityGateResultRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { QualityGateResultRepository } from '../QualityGateResultRepository';

const mockQuery = jest.fn();

describe('QualityGateResultRepository', () => {
  let repo: QualityGateResultRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new QualityGateResultRepository({ query: mockQuery } as any);
  });

  it('should findByRunId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRunId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStageName', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStageName('test-id', 'test-name');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createResult', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createResult('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
