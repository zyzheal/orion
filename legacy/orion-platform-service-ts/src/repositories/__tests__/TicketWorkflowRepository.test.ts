/**
 * TicketWorkflowRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
}));

import { TicketWorkflowRepository, TicketSLARepository } from '../TicketWorkflowRepository';

const mockQuery = jest.fn();

describe('TicketWorkflowRepository', () => {
  let repo: TicketWorkflowRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TicketWorkflowRepository({ query: mockQuery } as any);
  });

  it('should findByTicketId', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findByTicketId('test-id');
    expect(mockQuery).toHaveBeenCalled();
  });

  it('should createEntry', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.createEntry('test-arg', 'test-id');
    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('TicketSLARepository', () => {
  let repo: TicketSLARepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TicketSLARepository({ query: mockQuery } as any);
  });

  it('should createSLA', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.createSLA('test-arg', 'test-id');
    expect(result).toBeUndefined();
  });

  it('should updateSLA', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await repo.updateSLA('test-id', '2026-01-01', 'test-id');
    expect(result).toBeUndefined();
  });

  it('should findBreached', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'test-1', created_at: new Date(), updated_at: new Date() }], rowCount: 1 });
    const result = await repo.findBreached();
    expect(mockQuery).toHaveBeenCalled();
  });
});
