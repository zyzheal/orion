/**
 * HealingAuditRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { HealingAuditRepository } from '../HealingAuditRepository';

const mockQuery = jest.fn();

describe('HealingAuditRepository', () => {
  let repo: HealingAuditRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new HealingAuditRepository({ query: mockQuery } as any);
  });

  it('should insert', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.insert('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByIncident', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByIncident('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByStatus('active', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByEnvironment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByEnvironment('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByStatus', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByStatus();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByRiskLevel', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByRiskLevel();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countByEnvironment', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countByEnvironment();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should totalCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.totalCount();
    expect(mockQuery).toHaveBeenCalled();
  });
});
