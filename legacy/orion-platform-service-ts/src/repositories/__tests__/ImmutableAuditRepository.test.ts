/**
 * ImmutableAuditRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { ImmutableAuditEntryRepository, ImmutableAuditFileRepository } from '../ImmutableAuditRepository';

const mockQuery = jest.fn();

describe('ImmutableAuditEntryRepository', () => {
  let repo: ImmutableAuditEntryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ImmutableAuditEntryRepository({ query: mockQuery } as any);
  });

  it('should findBySequenceRange', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBySequenceRange('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByTenantId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTenantId('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should getMaxSequenceNumber', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.getMaxSequenceNumber();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createFromChainedEntry', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createFromChainedEntry('test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('ImmutableAuditFileRepository', () => {
  let repo: ImmutableAuditFileRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ImmutableAuditFileRepository({ query: mockQuery } as any);
  });

  it('should findByFilePath', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByFilePath('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateEntryCount', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateEntryCount('test-id', 'test-arg', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should setReadOnly', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.setReadOnly('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updateFileHash', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updateFileHash('test-id', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });
});
