/**
 * EfficiencyPipelineRecordRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { EfficiencyPipelineRecordRepository } from '../EfficiencyPipelineRecordRepository';

const mockQuery = jest.fn();

describe('EfficiencyPipelineRecordRepository', () => {
  let repo: EfficiencyPipelineRecordRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new EfficiencyPipelineRecordRepository({ query: mockQuery } as any);
  });

  it('should create', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.create('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenant', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenant('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findUnsynced', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findUnsynced('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markSynced', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markSynced('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
