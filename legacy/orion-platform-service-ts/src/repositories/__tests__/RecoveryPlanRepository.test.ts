/**
 * RecoveryPlanRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { RecoveryPlanRepository, RecoveryExecutionRepository } from '../RecoveryPlanRepository';

const mockQuery = jest.fn();

describe('RecoveryPlanRepository', () => {
  let repo: RecoveryPlanRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RecoveryPlanRepository({ query: mockQuery } as any);
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should markTested', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.markTested('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should toggleEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.toggleEnabled('test-id', true);
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('RecoveryExecutionRepository', () => {
  let repo: RecoveryExecutionRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new RecoveryExecutionRepository({ query: mockQuery } as any);
  });

  it('should findByPlanId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPlanId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateStatus('test-id', 'active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateRtoRpo', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.updateRtoRpo('test-id', 'test-arg');
    expect(result).toBeUndefined();
  });

  it('should updateStepExecutions', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.updateStepExecutions('test-id', 'test-arg');
    expect(result).toBeUndefined();
  });
});
