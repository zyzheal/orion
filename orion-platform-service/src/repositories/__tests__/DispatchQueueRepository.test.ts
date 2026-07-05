/**
 * DispatchQueueRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { DispatchQueueEntryRepository, SLATargetRepository, SLAAlertRepository } from '../DispatchQueueRepository';

const mockQuery = jest.fn();

describe('DispatchQueueEntryRepository', () => {
  let repo: DispatchQueueEntryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new DispatchQueueEntryRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findHighestPriority', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findHighestPriority();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAllSorted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAllSorted();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should updatePriority', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.updatePriority('test-id', 'test-arg', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should recordDispatchAttempt', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.recordDispatchAttempt('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countAll();
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should existsByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.existsByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('SLATargetRepository', () => {
  let repo: SLATargetRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLATargetRepository({ query: mockQuery } as any);
  });

  it('should findByPriority', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByPriority('test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findEnabled', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findEnabled();
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('SLAAlertRepository', () => {
  let repo: SLAAlertRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new SLAAlertRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findByType', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByType('test-type', 'test-arg');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should deleteByQueueEntryId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.deleteByQueueEntryId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should findAlertForQueueEntry', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findAlertForQueueEntry('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should countAll', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.countAll();
    expect(mockQuery).toHaveBeenCalled();
  });
});
