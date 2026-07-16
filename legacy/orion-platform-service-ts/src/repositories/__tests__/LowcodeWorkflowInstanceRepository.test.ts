/**
 * LowcodeWorkflowInstanceRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { LowcodeWorkflowInstancePgRepository } from '../LowcodeWorkflowInstanceRepository';

const mockQuery = jest.fn();

describe('LowcodeWorkflowInstancePgRepository', () => {
  let repo: LowcodeWorkflowInstancePgRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new LowcodeWorkflowInstancePgRepository({ query: mockQuery } as any);
  });

  it('should findByWorkflowId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByWorkflowId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByDefinitionId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByDefinitionId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should cleanupExpired', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.cleanupExpired('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
