/**
 * InlineScriptApprovalRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { InlineScriptApprovalRepository } from '../InlineScriptApprovalRepository';

const mockQuery = jest.fn();

describe('InlineScriptApprovalRepository', () => {
  let repo: InlineScriptApprovalRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new InlineScriptApprovalRepository({ query: mockQuery } as any);
  });

  it('should findByApprovalId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByApprovalId('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should incrementApprovals', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.incrementApprovals('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateUsageCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateUsageCount('test-id', 'test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'test-id', 'active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createApproval', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createApproval('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findExpired('active');
    expect(mockQuery).toHaveBeenCalled();
  });
});
