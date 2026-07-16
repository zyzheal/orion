/**
 * AuditChainEntryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { AuditChainEntryRepository } from '../AuditChainEntryRepository';

const mockQuery = jest.fn();

describe('AuditChainEntryRepository', () => {
  let repo: AuditChainEntryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AuditChainEntryRepository({ query: mockQuery } as any);
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByUserId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByUserId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByAction', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByAction('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getMaxSequenceNumber', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getMaxSequenceNumber();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getEntries', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getEntries('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getLastEntry', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getLastEntry();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getNextSequenceNumber', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getNextSequenceNumber();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should verifyChain', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.verifyChain('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createFromChainedEntry', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createFromChainedEntry('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
