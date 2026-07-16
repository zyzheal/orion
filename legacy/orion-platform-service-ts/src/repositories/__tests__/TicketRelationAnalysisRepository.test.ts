/**
 * TicketRelationAnalysisRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TicketRelationAnalysisRepository } from '../TicketRelationAnalysisRepository';

const mockQuery = jest.fn();

describe('TicketRelationAnalysisRepository', () => {
  let repo: TicketRelationAnalysisRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TicketRelationAnalysisRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByRelationType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByRelationType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findExistingRelation', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findExistingRelation('test-id', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});
